// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The row list of the board and the Gantt (ADR 0089, Loading by time chunk): production orders by
// page of a Relay connection, in order from the first, apart from the job orders' placements,
// which load per time chunk.
import { useCallback, useEffect, useState } from 'react';
import type { GanttFrame, GanttOrder, GanttPageRequest, GanttRowsPage } from './gantt-data.ts';
import { ganttPageSize } from './gantt-data.ts';
import { isPlanningRefusal } from './planning-preview.ts';

/** Reads a page of the row list, the same function while the source and the filter stay. */
export type LoadRows = (page: GanttPageRequest) => Promise<GanttRowsPage>;

export interface GanttRows {
  /** The plant, its calendar and its machines, from the first page. */
  readonly frame: GanttFrame | undefined;
  /** The orders of the pages loaded, in the row list's order. */
  readonly orders: readonly GanttOrder[];
  /** Every order the filter matches, loaded or not. */
  readonly totalCount: number | undefined;
  /**
   * The first page: loading, ready, failed, or refused because the filter matches more than
   * `ganttMaxOrders` orders (`planning.gantt.too_many_orders`).
   */
  readonly status: 'loading' | 'ready' | 'failed' | 'refused';
  /** The error of a failed first page. */
  readonly error: unknown;
  /** The pages after the first: idle with more to load, loading, failed, or done. */
  readonly next: 'idle' | 'loading' | 'failed' | 'done';
  /** Loads the next page, when there is one and none is loading. */
  readonly loadNext: () => void;
  /** Loads the failed page again, the first or a later one. */
  readonly retry: () => void;
}

/** A page the view asked for: the first, or the next after a cursor. */
interface PageRequest {
  readonly kind: 'first' | 'next';
  readonly page: GanttPageRequest;
}

interface RowsState {
  readonly load: LoadRows;
  readonly frame?: GanttFrame;
  readonly orders: readonly GanttOrder[];
  readonly totalCount?: number;
  readonly endCursor?: string;
  readonly status: GanttRows['status'];
  readonly error?: unknown;
  readonly next: GanttRows['next'];
  /** The latest request, a new object each time, so each loads its page once. */
  readonly request: PageRequest;
  /** How many orders a reload loads again before it waits for the view to ask for more. */
  readonly target?: number;
  /** The reset key the rows belong to. */
  readonly resetKey?: string;
}

const firstRequest = (): PageRequest => ({ kind: 'first', page: { first: ganttPageSize } });

const firstPage = (load: LoadRows, resetKey: string | undefined): RowsState => ({
  load,
  orders: [],
  status: 'loading',
  next: 'idle',
  request: firstRequest(),
  ...(resetKey !== undefined && { resetKey }),
});

/** The request of the page after the last one loaded. */
const nextRequest = (state: RowsState): PageRequest => ({
  kind: 'next',
  page:
    state.endCursor === undefined
      ? { first: ganttPageSize }
      : { first: ganttPageSize, after: state.endCursor },
});

/**
 * The row list by page. The first page loads at once and a later page when the view asks for it,
 * or every page in order when `all` is set, as the board needs every order for its blocks.
 */
export function useGanttRows({
  load,
  all = false,
  resetKey,
}: {
  readonly load: LoadRows;
  readonly all?: boolean;
  /** A key whose change drops the rows shown, as the board's preview of a page state does. */
  readonly resetKey?: string;
}): GanttRows {
  const [stored, setState] = useState<RowsState>(() => firstPage(load, resetKey));
  // A new source or filter starts again from the first page (ADR 0016: a cursor belongs to its
  // query) and loads again as many orders as were loaded, in order (ADR 0089). The rows shown
  // stay until the first page answers, so a reload never empties the view.
  let state = stored;
  if (state.resetKey !== resetKey) {
    state = firstPage(load, resetKey);
    setState(state);
  } else if (state.load !== load) {
    const previous = state;
    state =
      previous.frame === undefined
        ? firstPage(load, resetKey)
        : {
            ...firstPage(load, resetKey),
            frame: previous.frame,
            orders: previous.orders,
            ...(previous.totalCount !== undefined && { totalCount: previous.totalCount }),
            status: 'ready',
            next: 'loading',
            target: previous.orders.length,
          };
    setState(state);
  }

  const { request } = state;
  useEffect(() => {
    let cancelled = false;
    load(request.page)
      .then((answer) => {
        if (cancelled) return;
        setState((current) => {
          if (current.load !== load || current.request !== request) return current;
          const more = answer.pageInfo.hasNextPage;
          const orders =
            request.kind === 'first' ? answer.orders : [...current.orders, ...answer.orders];
          // A reload loads on until it holds as many orders as were loaded before it.
          const onward = more && (all || orders.length < (current.target ?? 0));
          const { target: _, ...settled } = current;
          const loaded: RowsState = {
            ...(onward ? current : settled),
            // The frame comes with the first page; a later page's frame is the same plant.
            frame:
              request.kind === 'first' || current.frame === undefined
                ? answer.frame
                : current.frame,
            orders,
            totalCount: answer.totalCount,
            ...(answer.pageInfo.endCursor !== undefined && {
              endCursor: answer.pageInfo.endCursor,
            }),
            status: 'ready',
            next: more ? (onward ? 'loading' : 'idle') : 'done',
          };
          return onward ? { ...loaded, request: nextRequest(loaded) } : loaded;
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState((current) => {
          if (current.load !== load || current.request !== request) return current;
          // A later page, or the first page of a reload while rows are shown, fails beside the rows.
          if (request.kind === 'next' || current.frame !== undefined) {
            return { ...current, next: 'failed' };
          }
          const refused = isPlanningRefusal(error, 'planning.gantt.too_many_orders');
          return { ...current, status: refused ? 'refused' : 'failed', error };
        });
      });
    return () => {
      cancelled = true;
    };
  }, [load, request, all]);

  const loadNext = useCallback(
    () =>
      setState((current) =>
        current.status === 'ready' && current.next === 'idle'
          ? { ...current, next: 'loading', request: nextRequest(current) }
          : current,
      ),
    [],
  );
  const retry = useCallback(
    () =>
      setState((current) => {
        if (current.status === 'failed' || current.status === 'refused') {
          return { ...current, status: 'loading', request: firstRequest() };
        }
        if (current.next === 'failed') {
          // A failed reload starts again from its first page; a failed later page loads again.
          const again = current.request.kind === 'first' ? firstRequest() : nextRequest(current);
          return { ...current, next: 'loading', request: again };
        }
        return current;
      }),
    [],
  );

  return {
    frame: state.frame,
    orders: state.orders,
    totalCount: state.totalCount,
    status: state.status,
    error: state.error,
    next: state.next,
    loadNext,
    retry,
  };
}
