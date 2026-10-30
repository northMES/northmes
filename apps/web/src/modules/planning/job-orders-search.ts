// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';
import type { ZoomPreset } from './gantt-data.ts';
import { presetOfLevel, zoomLevelIds } from './timeline/time-scale.ts';

/** The sortable columns of the job order table, by their column ids. */
export const jobOrdersSortIds = [
  'jobOrder',
  'machine',
  'start',
  'end',
  'deadline',
  'plannedEnd',
  'lateBy',
] as const;

export type JobOrdersSortId = (typeof jobOrdersSortIds)[number];

/** A sort in the URL's sort key: a column id, with a leading minus for descending (ui-222). */
export type JobOrdersSort = JobOrdersSortId | `-${JobOrdersSortId}`;

/**
 * The view state of the job orders page in the URL (ADR 0062, plan 18): the zoom preset and the
 * first plant date of the range, which mean the same on the board and the Gantt (a level of the
 * ladder opens at its nearest preset, ADR 0089), Late only in
 * late=1 (the filter the Gantt shares, plan 18), and the sort. The default sort, machine then
 * start, stays out of the URL.
 */
export interface JobOrdersSearch {
  readonly zoom?: ZoomPreset;
  /** The first plant date of the visible range, "2026-11-02". */
  readonly from?: string;
  /** 1 keeps the job orders of orders that are late at now. */
  readonly late?: 1;
  readonly sort?: JobOrdersSort;
}

const sortValues = [
  ...jobOrdersSortIds,
  ...jobOrdersSortIds.map((id): `-${JobOrdersSortId}` => `-${id}`),
] as [JobOrdersSort, ...JobOrdersSort[]];

/** The URL keys, each of which falls back to its default on its own (ADR 0062). */
const searchKeys = z.object({
  zoom: z.enum(zoomLevelIds).transform(presetOfLevel).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  late: z
    .union([z.literal(1), z.literal('1'), z.literal(true)])
    .transform(() => 1 as const)
    .optional()
    .catch(undefined),
  sort: z.enum(sortValues).optional().catch(undefined),
});

/** The view state that a URL's search describes, for the job orders route's validateSearch. */
export function jobOrdersSearch(raw: Record<string, unknown>): JobOrdersSearch {
  const { zoom, from, late, sort } = searchKeys.parse(raw);
  return {
    ...(zoom !== undefined && { zoom }),
    ...(from !== undefined && { from }),
    ...(late !== undefined && { late }),
    ...(sort !== undefined && { sort }),
  };
}

/** The column and direction of a view's sort; the default, machine ascending, without a key. */
export function sortOf(search: JobOrdersSearch): {
  readonly id: JobOrdersSortId;
  readonly desc: boolean;
} {
  const sort: JobOrdersSort | undefined = search.sort;
  if (sort === undefined) return { id: 'machine', desc: false };
  return sort.startsWith('-')
    ? { id: sort.slice(1) as JobOrdersSortId, desc: true }
    : { id: sort as JobOrdersSortId, desc: false };
}

/** The view sorted on a column; the default sort leaves the key out. */
export function sortedBy(
  search: JobOrdersSearch,
  sort: { readonly id: string; readonly desc: boolean },
): JobOrdersSearch {
  const { sort: _, ...rest } = search;
  const id = sort.id as JobOrdersSortId;
  if (id === 'machine' && !sort.desc) return rest;
  return { ...rest, sort: sort.desc ? `-${id}` : id };
}

/** The view with Late only on or off. */
export function withLateOnly(search: JobOrdersSearch, lateOnly: boolean): JobOrdersSearch {
  const { late: _, ...rest } = search;
  return lateOnly ? { ...rest, late: 1 } : rest;
}
