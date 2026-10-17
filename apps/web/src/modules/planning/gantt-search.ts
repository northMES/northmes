// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';
import type { ZoomPreset } from './gantt-data.ts';

/** The views of the board route (plan 18, URL state): the board, the order Gantt and the table. */
export type BoardView = 'board' | 'gantt' | 'table';

/**
 * The view state of the board route in the URL (ADR 0062, plan 18): the view, the zoom preset,
 * the first plant date of the range, the selected order and the chain highlight. zoom, from and
 * order keep their meaning in every view, so switching the view keeps the range and the selected
 * order. The board, the default view, stays out of the URL; chain needs order, and the screen drops
 * it with the polite status message when the order is missing.
 */
export interface BoardSearch {
  readonly view?: 'gantt' | 'table';
  readonly zoom?: ZoomPreset;
  /** The first plant date of the visible range, "2026-11-02". */
  readonly from?: string;
  /** The selected order, by id. */
  readonly order?: string;
  /** 1 highlights the selected order's critical chain. */
  readonly chain?: 1;
}

/** The URL keys, each of which falls back to its default on its own (ADR 0062). */
const searchKeys = z.object({
  view: z.enum(['board', 'gantt', 'table']).optional().catch(undefined),
  zoom: z.enum(['hours', 'day', 'week', '4weeks']).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  order: z
    .union([z.string(), z.number()])
    .transform(String)
    .pipe(z.string().min(1).max(64))
    .optional()
    .catch(undefined),
  chain: z
    .union([z.literal(1), z.literal('1'), z.literal(true)])
    .transform(() => 1 as const)
    .optional()
    .catch(undefined),
});

/** The view state that a URL's search describes, for the route's validateSearch, defaults stripped. */
export function boardSearch(raw: Record<string, unknown>): BoardSearch {
  const { view, zoom, from, order, chain } = searchKeys.parse(raw);
  return {
    ...(view !== undefined && view !== 'board' && { view }),
    ...(zoom !== undefined && { zoom }),
    ...(from !== undefined && { from }),
    ...(order !== undefined && { order }),
    ...(chain !== undefined && { chain }),
  };
}

/** The same range and order in another view. */
export function withView(search: BoardSearch, view: BoardView): BoardSearch {
  const { view: _, ...rest } = search;
  return view === 'board' ? rest : { ...rest, view };
}

export function withZoom(search: BoardSearch, zoom: ZoomPreset): BoardSearch {
  return { ...search, zoom };
}

export function withFrom(search: BoardSearch, from: string): BoardSearch {
  return { ...search, from };
}

/** The view with an order selected, or none; a change of order ends the chain highlight. */
export function withOrder(search: BoardSearch, order: string | undefined): BoardSearch {
  const { order: _, chain: __, ...rest } = search;
  return order === undefined ? rest : { ...rest, order };
}

/** The view with the selected order's chain shown or hidden; without an order it stays hidden. */
export function withChain(search: BoardSearch, shown: boolean): BoardSearch {
  const { chain: _, ...rest } = search;
  return shown && search.order !== undefined ? { ...rest, chain: 1 } : rest;
}

/** The status message of ADR 0062 for a key the link carried that no longer applies. */
export const droppedKeyMessage =
  'This link had 1 setting that no longer applies, so it was ignored.';
