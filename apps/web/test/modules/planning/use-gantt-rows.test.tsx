// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type GanttOrder,
  type GanttPageRequest,
  type GanttRowsPage,
  g1DataSource,
  ganttPageSize,
} from '../../../src/modules/planning/gantt-data.ts';
import { PlanningRefusal } from '../../../src/modules/planning/planning-preview.ts';
import { type LoadRows, useGanttRows } from '../../../src/modules/planning/use-gantt-rows.ts';

afterEach(cleanup);

/**
 * A row list of a number of orders made from G1's first order, paged as a Relay connection, that
 * counts its page loads and fails the pages the test names.
 */
async function pagedRows(count: number, fail: (after: string | undefined) => Error | undefined) {
  const g1 = await g1DataSource.loadRows({}, { first: ganttPageSize });
  const template = g1.orders[0] as GanttOrder;
  const orders = Array.from({ length: count }, (_, index) => ({
    ...template,
    id: `po-${index}`,
    number: String(10_000 + index),
    jobOrders: [],
  }));
  const pages: (string | undefined)[] = [];
  const load: LoadRows = async (page: GanttPageRequest): Promise<GanttRowsPage> => {
    const after = 'first' in page ? page.after : undefined;
    pages.push(after);
    const error = fail(after);
    if (error !== undefined) throw error;
    const start = after === undefined ? 0 : Number(after) + 1;
    const end = Math.min(count, start + ganttPageSize);
    return {
      frame: g1.frame,
      orders: orders.slice(start, end),
      pageInfo: {
        hasNextPage: end < count,
        hasPreviousPage: start > 0,
        startCursor: String(start),
        endCursor: String(end - 1),
      },
      totalCount: count,
    };
  };
  return { load, pages };
}

describe('ADR0089 useGanttRows (the row list by page)', () => {
  it('ADR0089 loads the first page of 100 orders, and the next one when asked', async () => {
    const { load, pages } = await pagedRows(500, () => undefined);
    const { result } = renderHook(() => useGanttRows({ load }));

    await waitFor(() => expect(result.current.orders).toHaveLength(100));
    expect(result.current.totalCount).toBe(500);
    expect(result.current.next).toBe('idle');
    expect(pages).toEqual([undefined]);

    act(() => result.current.loadNext());
    await waitFor(() => expect(result.current.orders).toHaveLength(200));
    expect(pages).toEqual([undefined, '99']);
  });

  it('ADR0089 loads every page in order when the view needs them all, as the board does', async () => {
    const { load, pages } = await pagedRows(500, () => undefined);
    const { result } = renderHook(() => useGanttRows({ load, all: true }));

    await waitFor(() => expect(result.current.next).toBe('done'));
    expect(result.current.orders).toHaveLength(500);
    expect(pages).toEqual([undefined, '99', '199', '299', '399']);
  });

  it('ADR0089 marks a later page that fails as failed, keeps the pages before, and loads it again on Try again', async () => {
    let failing = true;
    const { load, pages } = await pagedRows(250, (after) =>
      failing && after === '99' ? new Error('The plan server did not answer') : undefined,
    );
    const { result } = renderHook(() => useGanttRows({ load }));
    await waitFor(() => expect(result.current.orders).toHaveLength(100));

    act(() => result.current.loadNext());
    await waitFor(() => expect(result.current.next).toBe('failed'));
    expect(result.current.orders).toHaveLength(100);

    failing = false;
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.orders).toHaveLength(200));
    expect(pages).toEqual([undefined, '99', '99']);
  });

  it('ADR0089 says the row list is refused when the filter matches more orders than the Gantt shows, and Try again asks again', async () => {
    let refusing = true;
    const { load, pages } = await pagedRows(10, () =>
      refusing ? new PlanningRefusal('planning.gantt.too_many_orders') : undefined,
    );
    const { result } = renderHook(() => useGanttRows({ load }));

    await waitFor(() => expect(result.current.status).toBe('refused'));
    expect(result.current.orders).toEqual([]);

    refusing = false;
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.orders).toHaveLength(10));
    expect(pages).toHaveLength(2);
  });

  it('ADR0089 loads again as many pages as were loaded when the source changes, as a reload does', async () => {
    const first = await pagedRows(500, () => undefined);
    const second = await pagedRows(500, () => undefined);
    const view = renderHook((props: { load: LoadRows }) => useGanttRows(props), {
      initialProps: { load: first.load },
    });
    await waitFor(() => expect(view.result.current.orders).toHaveLength(100));
    act(() => view.result.current.loadNext());
    await waitFor(() => expect(view.result.current.orders).toHaveLength(200));
    act(() => view.result.current.loadNext());
    await waitFor(() => expect(view.result.current.orders).toHaveLength(300));

    view.rerender({ load: second.load });

    await waitFor(() => expect(second.pages).toHaveLength(3));
    await waitFor(() => expect(view.result.current.next).toBe('idle'));
    expect(view.result.current.orders).toHaveLength(300);
  });

  it('ADR0089 keeps the rows shown when the first page of a reload fails, with Try again from the first page', async () => {
    const first = await pagedRows(30, () => undefined);
    let failing = true;
    const second = await pagedRows(20, () =>
      failing ? new Error('The plan server did not answer') : undefined,
    );
    const view = renderHook((props: { load: LoadRows }) => useGanttRows(props), {
      initialProps: { load: first.load },
    });
    await waitFor(() => expect(view.result.current.orders).toHaveLength(30));

    view.rerender({ load: second.load });
    await waitFor(() => expect(view.result.current.next).toBe('failed'));
    expect(view.result.current.status).toBe('ready');
    expect(view.result.current.orders).toHaveLength(30);

    failing = false;
    act(() => view.result.current.retry());
    await waitFor(() => expect(view.result.current.orders).toHaveLength(20));
    expect(second.pages).toEqual([undefined, undefined]);
  });

  it('ADR0089 drops the rows shown when the reset key changes, as a page state the board previews does', async () => {
    const first = await pagedRows(30, () => undefined);
    const never: LoadRows = () => new Promise(() => {});
    const view = renderHook((props: { load: LoadRows; resetKey?: string }) => useGanttRows(props), {
      initialProps: { load: first.load } as { load: LoadRows; resetKey?: string },
    });
    await waitFor(() => expect(view.result.current.orders).toHaveLength(30));

    view.rerender({ load: never, resetKey: 'loading' });

    expect(view.result.current.status).toBe('loading');
    expect(view.result.current.orders).toEqual([]);
  });

  it('ADR0089 keeps the rows shown while the first page of a new source loads, as a reload after an order is entered does', async () => {
    const first = await pagedRows(30, () => undefined);
    let answer: () => void = () => {};
    const waiting = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const second = await pagedRows(20, () => undefined);
    const slow: LoadRows = async (page) => {
      await waiting;
      return second.load(page);
    };
    const view = renderHook((props: { load: LoadRows }) => useGanttRows(props), {
      initialProps: { load: first.load },
    });
    await waitFor(() => expect(view.result.current.orders).toHaveLength(30));

    view.rerender({ load: slow });

    expect(view.result.current.status).toBe('ready');
    expect(view.result.current.orders).toHaveLength(30);
    answer();
    await waitFor(() => expect(view.result.current.orders).toHaveLength(20));
  });

  it('ADR0089 starts again from the first page when the source changes', async () => {
    const first = await pagedRows(150, () => undefined);
    const second = await pagedRows(30, () => undefined);
    const view = renderHook((props: { load: LoadRows }) => useGanttRows(props), {
      initialProps: { load: first.load },
    });
    await waitFor(() => expect(view.result.current.orders).toHaveLength(100));

    view.rerender({ load: second.load });

    await waitFor(() => expect(view.result.current.orders).toHaveLength(30));
    expect(view.result.current.next).toBe('done');
  });
});
