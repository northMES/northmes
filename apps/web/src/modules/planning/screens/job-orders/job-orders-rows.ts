// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDate } from '@northmes/contracts/format';
import type {
  GanttJobOrder,
  GanttOperation,
  GanttOrder,
  GanttSnapshot,
  OrderAnalysis,
} from '../../gantt-data.ts';
import {
  type JobOrderGroupKey,
  type JobOrdersSearch,
  type JobOrdersSortId,
  notPlaced,
  openJobOrderStatuses,
} from '../../job-orders-search.ts';
import { type FacetValue, facetsOf, matches } from '../../order-list-rows.ts';
import { plantDateOf } from '../../timeline/time-scale.ts';

/** One row of the job order table: a job order with its operation, its order and the analysis. */
export interface JobOrderTableRow {
  readonly id: string;
  readonly jobOrder: GanttJobOrder;
  readonly operation: GanttOperation;
  readonly order: GanttOrder;
  readonly analysis: OrderAnalysis | undefined;
  /** The machine's name, or "Not placed" for a row without one. */
  readonly machine: string;
  /** The machine's position among the plant's machines, which the default sort reads. */
  readonly machineIndex: number;
  /** Whether the planner's draft moved the row, which its status names. */
  readonly inDraft?: boolean;
}

/** The sort of the table: a column id and a direction. */
export interface JobOrdersSort {
  readonly id: JobOrdersSortId;
  readonly desc: boolean;
}

/** The filter fields of the job order table (ADR 0091). */
export type JobOrderFilterKey = 'machine' | 'status' | 'article';

const filterKeys: readonly JobOrderFilterKey[] = ['machine', 'status', 'article'];

/** The label of Not placed, in Machine, its filter and its group. */
export const notPlacedLabel = 'Not placed';

/** Every job order of the snapshot as a row, finished ones included; the view filters them. */
export function jobOrderTableRows(
  snapshot: GanttSnapshot,
  draftRowIds: ReadonlySet<string> = new Set(),
): JobOrderTableRow[] {
  const machineIndex = new Map(snapshot.equipment.map((machine, index) => [machine.code, index]));
  const machineName = new Map(snapshot.equipment.map((machine) => [machine.code, machine.name]));
  const rows: JobOrderTableRow[] = [];
  for (const order of snapshot.productionOrders) {
    const analysis = snapshot.analysis.orders[order.id];
    for (const jobOrder of order.jobOrders) {
      const operation = order.operations.find((each) => each.id === jobOrder.operationId);
      if (operation === undefined) continue;
      rows.push({
        id: jobOrder.id,
        jobOrder,
        operation,
        order,
        analysis,
        machine:
          jobOrder.equipment === undefined
            ? notPlacedLabel
            : (machineName.get(jobOrder.equipment) ?? jobOrder.equipment),
        machineIndex:
          jobOrder.equipment === undefined
            ? Number.MAX_SAFE_INTEGER
            : (machineIndex.get(jobOrder.equipment) ?? Number.MAX_SAFE_INTEGER),
        ...(draftRowIds.has(jobOrder.id) && { inDraft: true }),
      });
    }
  }
  return rows;
}

/** The values of a filter field on a row; a row without a machine has Not placed's token. */
function fieldValues(row: JobOrderTableRow, key: JobOrderFilterKey): readonly string[] {
  switch (key) {
    case 'machine':
      return [row.jobOrder.equipment ?? notPlaced];
    case 'status':
      return [row.jobOrder.status];
    case 'article':
      return [row.order.article];
  }
}

/**
 * Whether a row passes the view (ADR 0091): the search on the job order number, the order number
 * and the article, Late only, and each filter field, a field left out aside. Without a picked
 * status, only open job orders pass.
 */
export function jobOrderRowMatches(
  row: JobOrderTableRow,
  view: JobOrdersSearch,
  except?: JobOrderFilterKey,
): boolean {
  if (view.late === 1 && row.analysis?.late !== true) return false;
  if (!matches(view.q, row.jobOrder.displayNumber, row.order.number, row.order.article)) {
    return false;
  }
  if (
    except !== 'status' &&
    view.status === undefined &&
    !openJobOrderStatuses.includes(row.jobOrder.status)
  ) {
    return false;
  }
  return filterKeys.every((key) => {
    const picked: readonly string[] | undefined = key === except ? undefined : view[key];
    return picked === undefined || fieldValues(row, key).some((value) => picked.includes(value));
  });
}

/** The values of a filter field with their counts among the rows that pass the rest of the view. */
export function jobOrderFacets(
  rows: readonly JobOrderTableRow[],
  view: JobOrdersSearch,
  key: JobOrderFilterKey,
  labelOf: (value: string) => string,
): FacetValue[] {
  return facetsOf(
    rows,
    view[key],
    key,
    (row, except) => jobOrderRowMatches(row, view, except),
    fieldValues,
    labelOf,
  );
}

/** The sort key of a row under a column; a row without a placement sorts after the rest. */
function sortKey(row: JobOrderTableRow, id: JobOrdersSortId): number | string {
  switch (id) {
    case 'jobOrder':
      return row.jobOrder.displayNumber;
    case 'machine':
      return row.machineIndex;
    case 'start':
      return row.jobOrder.placement?.setupStartMs ?? Number.MAX_SAFE_INTEGER;
    case 'end':
      return row.jobOrder.placement?.endMs ?? Number.MAX_SAFE_INTEGER;
    case 'deadline':
      return row.order.deadlineMs;
    case 'plannedEnd':
      return row.analysis?.plannedEndMs ?? Number.MAX_SAFE_INTEGER;
    case 'lateBy':
      return row.analysis?.late ? -row.analysis.slackElapsedS : 0;
  }
}

/** The rows sorted on a column, with the start and then the display number breaking ties. */
export function sortedJobOrderRows(
  rows: readonly JobOrderTableRow[],
  sort: JobOrdersSort,
): JobOrderTableRow[] {
  const direction = sort.desc ? -1 : 1;
  const compare = (a: JobOrderTableRow, b: JobOrderTableRow, id: JobOrdersSortId) => {
    const left = sortKey(a, id);
    const right = sortKey(b, id);
    if (left === right) return 0;
    return left < right ? -1 : 1;
  };
  return [...rows].sort((a, b) => {
    const primary = compare(a, b, sort.id) * direction;
    if (primary !== 0) return primary;
    const byStart = compare(a, b, 'start');
    if (byStart !== 0) return byStart;
    return compare(a, b, 'jobOrder');
  });
}

/** One group of the job order table: its id, its name and its rows in the table's sort. */
export interface JobOrderGroup {
  readonly id: string;
  readonly label: string;
  readonly rows: readonly JobOrderTableRow[];
}

/**
 * The sorted rows in groups (ADR 0091): by machine in the plant's machine order, or by the plant
 * date of the setup start in date order, with Not placed last in both.
 */
export function groupedJobOrderRows(
  rows: readonly JobOrderTableRow[],
  key: JobOrderGroupKey,
  timeZone: string,
): JobOrderGroup[] {
  const groups = new Map<
    string,
    { label: string; order: number | string; rows: JobOrderTableRow[] }
  >();
  for (const row of rows) {
    const start = row.jobOrder.placement?.setupStartMs;
    const placed = key === 'machine' ? row.jobOrder.equipment !== undefined : start !== undefined;
    const id = !placed
      ? notPlaced
      : key === 'machine'
        ? (row.jobOrder.equipment ?? notPlaced)
        : plantDateOf(start ?? 0, timeZone);
    const group = groups.get(id) ?? {
      label: !placed
        ? notPlacedLabel
        : key === 'machine'
          ? row.machine
          : formatPlantDate(start ?? 0, timeZone),
      order: !placed ? Number.MAX_SAFE_INTEGER : key === 'machine' ? row.machineIndex : id,
      rows: [],
    };
    group.rows.push(row);
    groups.set(id, group);
  }
  return [...groups.entries()]
    .sort(([, a], [, b]) => {
      if (a.order === b.order) return 0;
      // Not placed sorts last against a date too.
      if (a.order === Number.MAX_SAFE_INTEGER) return 1;
      if (b.order === Number.MAX_SAFE_INTEGER) return -1;
      return a.order < b.order ? -1 : 1;
    })
    .map(([id, { label, rows: members }]) => ({ id, label, rows: members }));
}

/** The count beside a group's name, "4 job orders". */
export function jobOrderCountText(count: number): string {
  return count === 1 ? '1 job order' : `${count} job orders`;
}
