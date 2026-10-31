// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';
import type { ZoomLevel } from './gantt-data.ts';
import { type PlanningPreview, planningPreviews } from './planning-preview.ts';
import { clampZoom, roundZoom, zoomLevelIds, zoomLevels } from './timeline/time-scale.ts';

/**
 * The view state of the Gantt page in the URL (ADR 0062, plan 18): the zoom, the first
 * plant date of the range, the selected order and the chain highlight. zoom, from and order mean
 * the same on the board, so a link between the pages carries them. chain needs order, and the
 * screen drops it with the polite status message when the order is missing.
 */
export interface GanttSearch {
  /**
   * The width of an hour in pixels (ADR 0090, The URL key zoom), clamped to 0.15 to 240; a level
   * id of ADR 0089 opens at its natural width, and anything else falls back to the default.
   */
  readonly zoom?: number;
  /**
   * The visible start (ADR 0089): the plant-local date-time the view wrote when scrolling stopped,
   * "2026-11-03T13:20", or a plant date, "2026-11-02", which opens at the start of that date at
   * the level.
   */
  readonly from?: string;
  /** The selected order, by id. */
  readonly order?: string;
  /** 1 highlights the selected order's critical chain. */
  readonly chain?: 1;
}

/**
 * A plant-local date-time to the minute, "2026-11-03T13:20", without an offset: the URL holds the
 * plant's wall clock (ADR 0089), and an offset or a Z would name another clock.
 */
export const plantDateTime = z.iso
  .datetime({ local: true, precision: -1 })
  .refine((value) => /T\d{2}:\d{2}$/.test(value));

/** The default zoom, the Week level's natural width, which the URL leaves out (ADR 0090). */
export const defaultZoom = zoomLevels.week.pxPerHour;

/**
 * The URL key zoom: a width per hour, as a number or the text of one, or a level id at its
 * natural width; a number outside 0.15 to 240 is clamped, and the width is kept to three
 * significant digits as the view writes it.
 */
export const zoomKey = z
  .union([
    z.number(),
    z
      .string()
      .regex(/^-?\d+(\.\d+)?$/)
      .transform(Number),
    z.enum(zoomLevelIds).transform((id) => zoomLevels[id].pxPerHour),
  ])
  .pipe(z.number())
  .transform((pxPerHour) => roundZoom(clampZoom(pxPerHour)));

/** The URL keys, each of which falls back to its default on its own (ADR 0062). */
const searchKeys = z.object({
  zoom: zoomKey.optional().catch(undefined),
  from: z.union([z.iso.date(), plantDateTime]).optional().catch(undefined),
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

/**
 * The instant a `from` opens at (ADR 0089): a plain date at the start of that day, which is its
 * production day start at the levels that span hours and its midnight at the others; a date-time
 * at that plant time, the first instant after it in the spring gap (ADR 0024).
 */
export function startOfFrom(
  from: string,
  zoom: ZoomLevel,
  timeZone: string,
  productionDayStart: string,
): number {
  const clock = zoomLevels[zoom].startsAt === 'productionDay' ? productionDayStart : '00:00';
  const local = from.includes('T') ? from : `${from}T${clock}`;
  return Temporal.PlainDateTime.from(local).toZonedDateTime(timeZone, { disambiguation: 'later' })
    .epochMilliseconds;
}

/** The `from` of a visible start: its plant-local date-time to the minute, "2026-11-03T13:20". */
export function fromAt(epochMs: number, timeZone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(epochMs)
    .toZonedDateTimeISO(timeZone)
    .toPlainDateTime()
    .toString({ smallestUnit: 'minute', roundingMode: 'trunc' });
}

/** The view at a zoom; the default zoom leaves the key out (ADR 0090, The URL key zoom). */
export function withZoom<T extends GanttSearch>(search: T, zoom: number): T {
  const { zoom: _, ...rest } = search;
  const rounded = roundZoom(zoom);
  return (rounded === defaultZoom ? rest : { ...rest, zoom: rounded }) as T;
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
