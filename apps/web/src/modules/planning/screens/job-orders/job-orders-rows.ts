// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type {
  GanttJobOrder,
  GanttOperation,
  GanttOrder,
  GanttSnapshot,
  OrderAnalysis,
} from '../../gantt-data.ts';
import type { JobOrdersSortId } from '../../job-orders-search.ts';
import type { TimeRange } from '../../timeline/time-scale.ts';

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

/**
 * The rows of the table over a range (plan 18, Data loading): every job order whose placement
 * overlaps the range, plus every job order of an order late at now, so a late order whose rows lie
 * in the past still shows; with Late only, the rows of late orders alone.
 */
export function jobOrderTableRows(
  snapshot: GanttSnapshot,
  range: TimeRange,
  lateOnly: boolean,
  draftRowIds: ReadonlySet<string> = new Set(),
): JobOrderTableRow[] {
  const machineIndex = new Map(snapshot.equipment.map((machine, index) => [machine.code, index]));
  const machineName = new Map(snapshot.equipment.map((machine) => [machine.code, machine.name]));
  const rows: JobOrderTableRow[] = [];
  for (const order of snapshot.productionOrders) {
    const analysis = snapshot.analysis.orders[order.id];
    const late = analysis?.late === true;
    if (lateOnly && !late) continue;
    for (const jobOrder of order.jobOrders) {
      const placement = jobOrder.placement;
      const inRange =
        placement !== undefined &&
        placement.endMs > range.fromMs &&
        placement.setupStartMs < range.toMs;
      if (!inRange && !late) continue;
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
            ? 'Not placed'
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

/** The sort key of a row under a column. */
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
