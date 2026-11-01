// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';
import type { JobOrderStatus } from './gantt-data.ts';
import {
  commaList,
  defined,
  lateOnlyKey,
  sortOf as listSortOf,
  type SortKey,
  searchText,
  sortedBy as sortedListBy,
  sortKeys,
} from './order-list-search.ts';

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
export type JobOrdersSort = SortKey<JobOrdersSortId>;

/** The statuses of a job order, which the Status filter offers. */
export const jobOrderStatusValues = [
  'planned',
  'started',
  'finished',
] as const satisfies readonly JobOrderStatus[];

/** The statuses the table lists while the Status filter picks none: the open job orders. */
export const openJobOrderStatuses: readonly JobOrderStatus[] = ['planned', 'started'];

/** The token of the Machine filter for a job order without a machine, Not placed. */
export const notPlaced = 'none';

/** The fields the job order table groups by (ADR 0091). */
export const jobOrderGroupKeys = ['machine', 'startDay'] as const;
export type JobOrderGroupKey = (typeof jobOrderGroupKeys)[number];

/** The default sort, Start ascending, which stays out of the URL. */
const defaultSort: JobOrdersSortId = 'start';

/**
 * The view state of the job orders page in the URL (ADR 0091, ADR 0062): the search in q, Late
 * only in late=1, one key per filter field with a comma list of the picked values, Group by in
 * group, and the sort. The page has no range, so zoom and from are dropped.
 */
export interface JobOrdersSearch {
  readonly q?: string;
  /** 1 keeps the job orders of orders that are late at now. */
  readonly late?: 1;
  /** The picked machines by code, and none for Not placed. */
  readonly machine?: readonly string[];
  readonly status?: readonly JobOrderStatus[];
  readonly article?: readonly string[];
  readonly group?: JobOrderGroupKey;
  readonly sort?: JobOrdersSort;
}

/** The URL keys, each of which falls back to its default on its own (ADR 0062). */
const searchKeys = z.object({
  q: searchText,
  late: lateOnlyKey,
  machine: commaList(z.string().min(1).max(64)),
  status: commaList(z.enum(jobOrderStatusValues)),
  article: commaList(z.string().min(1).max(100)),
  group: z.enum(jobOrderGroupKeys).optional().catch(undefined),
  sort: sortKeys(jobOrdersSortIds),
});

/** The view state that a URL's search describes, for the job orders route's validateSearch. */
export function jobOrdersSearch(raw: Record<string, unknown>): JobOrdersSearch {
  return defined(searchKeys.parse(raw));
}

/** The column and direction of a view's sort; the default, Start ascending, without a key. */
export function sortOf(search: JobOrdersSearch): {
  readonly id: JobOrdersSortId;
  readonly desc: boolean;
} {
  return listSortOf<JobOrdersSortId>(search, defaultSort);
}

/** The view sorted on a column; the default sort leaves the key out. */
export function sortedBy(
  search: JobOrdersSearch,
  sort: { readonly id: string; readonly desc: boolean },
): JobOrdersSearch {
  return sortedListBy<JobOrdersSearch, JobOrdersSortId>(search, sort, defaultSort);
}

/** The view grouped by a field, or not grouped. */
export function groupedBy(
  search: JobOrdersSearch,
  group: JobOrderGroupKey | undefined,
): JobOrdersSearch {
  const { group: _, ...rest } = search;
  return group === undefined ? rest : { ...rest, group };
}
