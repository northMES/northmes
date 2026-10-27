// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';
import type { ZoomPreset } from './gantt-data.ts';
import { type PlanningPreview, planningPreviews } from './planning-preview.ts';

/**
 * The view state of the Gantt page in the URL (ADR 0062, plan 18): the zoom preset, the first
 * plant date of the range, the selected order and the chain highlight. zoom, from and order mean
 * the same on the board, so a link between the pages carries them. chain needs order, and the
 * screen drops it with the polite status message when the order is missing.
 */
export interface GanttSearch {
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

/** The view state that a URL's search describes, for the Gantt route's validateSearch. */
export function ganttSearch(raw: Record<string, unknown>): GanttSearch {
  const { zoom, from, order, chain } = searchKeys.parse(raw);
  return {
    ...(zoom !== undefined && { zoom }),
    ...(from !== undefined && { from }),
    ...(order !== undefined && { order }),
    ...(chain !== undefined && { chain }),
  };
}

/**
 * The board route's search: the Gantt keys, which the board keeps for a link to the Gantt, and the
 * view key of the links from before the Gantt had its own page. `view=gantt` on the board route
 * redirects to the Gantt page with the other keys, so an old link keeps working; any other view
 * is dropped.
 */
export interface BoardSearch extends GanttSearch {
  readonly view?: 'gantt';
  /** The page state the mock source answers with (design D3, DR17 to DR22). */
  readonly preview?: PlanningPreview;
}

const legacyView = z.literal('gantt').optional().catch(undefined);
const previewKey = z.enum(planningPreviews).optional().catch(undefined);

/** The board route's search, for its validateSearch; see BoardSearch. */
export function boardSearch(raw: Record<string, unknown>): BoardSearch {
  const view = legacyView.parse(raw.view);
  const preview = previewKey.parse(raw.preview);
  return {
    ...ganttSearch(raw),
    ...(view !== undefined && { view }),
    ...(preview !== undefined && { preview }),
  };
}

export function withZoom<T extends GanttSearch>(search: T, zoom: ZoomPreset): T {
  return { ...search, zoom };
}

export function withFrom<T extends GanttSearch>(search: T, from: string): T {
  return { ...search, from };
}

/** The view with an order selected, or none; a change of order ends the chain highlight. */
export function withOrder<T extends GanttSearch>(search: T, order: string | undefined): T {
  const { order: _, chain: __, ...rest } = search;
  return (order === undefined ? rest : { ...rest, order }) as T;
}

/** The view with the selected order's chain shown or hidden; without an order it stays hidden. */
export function withChain(search: GanttSearch, shown: boolean): GanttSearch {
  const { chain: _, ...rest } = search;
  return shown && search.order !== undefined ? { ...rest, chain: 1 } : rest;
}

/** The status message of ADR 0062 for a key the link carried that no longer applies. */
export const droppedKeyMessage =
  'This link had 1 setting that no longer applies, so it was ignored.';
