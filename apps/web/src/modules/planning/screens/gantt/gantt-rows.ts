// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDate, formatSpan } from '@northmes/contracts/format';
import type {
  GanttJobOrder,
  GanttOperation,
  GanttOrder,
  GanttSnapshot,
  JobOrderAnalysis,
  OrderAnalysis,
} from '../../gantt-data.ts';

/** The three levels of the order Gantt tree (plan 18, Rows and the tree). */
export type GanttRow = OrderRow | OperationRow | JobOrderRow;

export interface OrderRow {
  readonly kind: 'order';
  readonly id: string;
  readonly order: GanttOrder;
  readonly analysis: OrderAnalysis | undefined;
  readonly subRows: readonly OperationRow[];
}

export interface OperationRow {
  readonly kind: 'operation';
  readonly id: string;
  readonly order: GanttOrder;
  readonly operation: GanttOperation;
  /** How many of the operation's job orders sit in the Not placed row. */
  readonly notPlaced: number;
  readonly subRows: readonly JobOrderRow[];
}

export interface JobOrderRow {
  readonly kind: 'jobOrder';
  readonly id: string;
  readonly order: GanttOrder;
  readonly operation: GanttOperation;
  readonly jobOrder: GanttJobOrder;
  readonly analysis: JobOrderAnalysis | undefined;
  readonly subRows: readonly never[];
}

/** The ids of the rows: an order by its id, an operation and a job order by theirs. */
export const rowIds = {
  order: (order: GanttOrder) => order.id,
  operation: (operation: GanttOperation) => `op-${operation.id}`,
  jobOrder: (jobOrder: GanttJobOrder) => jobOrder.id,
};

/** The row heights of plan 18, in rem: 36 px for summary rows, 52 px for job order rows. */
export const rowHeightRem = { order: 2.25, operation: 2.25, jobOrder: 3.25 } as const;

/** The workload lane's height, 40 px, in rem. */
export const laneHeightRem = 2.5;

/**
 * The autoplan order of the orders (plan 18): deadline instant, priority with null last, order
 * number by code units, then id.
 */
export function compareOrders(a: GanttOrder, b: GanttOrder): number {
  if (a.deadlineMs !== b.deadlineMs) return a.deadlineMs - b.deadlineMs;
  if (a.priority !== b.priority) {
    if (a.priority === null) return 1;
    if (b.priority === null) return -1;
    return a.priority - b.priority;
  }
  if (a.number !== b.number) return a.number < b.number ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Job orders by planned start, unplaced last, then id. */
function compareJobOrders(a: GanttJobOrder, b: GanttJobOrder): number {
  const aStart = a.placement?.setupStartMs;
  const bStart = b.placement?.setupStartMs;
  if (aStart !== bStart) {
    if (aStart === undefined) return 1;
    if (bStart === undefined) return -1;
    return aStart - bStart;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The tree of a snapshot: orders in the autoplan order, operations by sequence, job orders by start. */
export function buildGanttRows(snapshot: GanttSnapshot): OrderRow[] {
  return [...snapshot.productionOrders].sort(compareOrders).map((order) => ({
    kind: 'order',
    id: rowIds.order(order),
    order,
    analysis: snapshot.analysis.orders[order.id],
    subRows: [...order.operations]
      .sort((a, b) => a.sequence - b.sequence)
      .map((operation) => {
        const jobOrders = order.jobOrders
          .filter((jobOrder) => jobOrder.operationId === operation.id)
          .sort(compareJobOrders);
        return {
          kind: 'operation',
          id: rowIds.operation(operation),
          order,
          operation,
          notPlaced: jobOrders.filter((jobOrder) => jobOrder.placement === undefined).length,
          subRows: jobOrders.map((jobOrder) => ({
            kind: 'jobOrder',
            id: rowIds.jobOrder(jobOrder),
            order,
            operation,
            jobOrder,
            analysis: snapshot.analysis.jobOrders[jobOrder.id],
            subRows: [],
          })),
        };
      }),
  }));
}

/** Every job order of a snapshot without a placement, for the Not placed row. */
export function notPlacedRows(rows: readonly OrderRow[]): JobOrderRow[] {
  return rows.flatMap((order) =>
    order.subRows.flatMap((operation) =>
      operation.subRows.filter((row) => row.jobOrder.placement === undefined),
    ),
  );
}

/** The span of a summary row: from the earliest setup start to the latest end of its placed rows. */
export function summarySpan(
  rows: readonly JobOrderRow[],
): { readonly fromMs: number; readonly toMs: number } | undefined {
  let fromMs: number | undefined;
  let toMs: number | undefined;
  for (const { jobOrder } of rows) {
    if (jobOrder.placement === undefined) continue;
    fromMs =
      fromMs === undefined
        ? jobOrder.placement.setupStartMs
        : Math.min(fromMs, jobOrder.placement.setupStartMs);
    toMs = toMs === undefined ? jobOrder.placement.endMs : Math.max(toMs, jobOrder.placement.endMs);
  }
  return fromMs === undefined || toMs === undefined ? undefined : { fromMs, toMs };
}

/** The job order rows under an order. */
export function jobOrderRowsOf(row: OrderRow | OperationRow): JobOrderRow[] {
  return row.kind === 'order'
    ? row.subRows.flatMap((operation) => operation.subRows)
    : [...row.subRows];
}

/** The planned seconds of a row, or the sum over a summary row's job orders. */
export function workingSecondsOf(row: GanttRow): number {
  if (row.kind === 'jobOrder') return row.jobOrder.plannedSetupS + row.jobOrder.plannedRunS;
  return jobOrderRowsOf(row).reduce(
    (sum, each) => sum + each.jobOrder.plannedSetupS + each.jobOrder.plannedRunS,
    0,
  );
}

/** "late by 15 h 15 min" for a late order, "on time" otherwise. */
export function latenessText(analysis: OrderAnalysis | undefined): string {
  if (analysis === undefined) return 'on time';
  return analysis.late ? `late by ${formatDuration(-analysis.slackElapsedS)}` : 'on time';
}

/**
 * The accessible name of a summary bar (plan 18, Additions the core needs): the row header plus
 * the span and, for an order, whether it is on time: "Order 1001, Tue 3 Nov 11:30 to Thu 5 Nov
 * 10:45, on time".
 */
export function summaryName(row: OrderRow | OperationRow, timeZone: string): string {
  const span = summarySpan(jobOrderRowsOf(row));
  const spanText = span === undefined ? 'not placed' : formatSpan(span.fromMs, span.toMs, timeZone);
  if (row.kind === 'order') {
    return `Order ${row.order.number}, ${spanText}, ${latenessText(row.analysis)}`;
  }
  return `Operation ${row.operation.displayNumber} ${row.operation.name}, ${spanText}`;
}

/** The words of a status, as the board draws them. */
export function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** "600 pcs": the quantity in the stock unit; G1 counts pieces. */
export function quantityText(quantity: number): string {
  return `${quantity} pcs`;
}

/** The second line of an order's row header: article, quantity, deadline date and status. */
export function orderSubtext(order: GanttOrder, timeZone: string): string {
  return `${order.article}, ${quantityText(order.quantity)}, deadline ${formatPlantDate(order.deadlineMs, timeZone)}, ${statusLabel(order.status)}`;
}

/** The machines of an operation as a count with the default one: "2 machines, default CNC 1". */
export function machinesText(
  operation: GanttOperation,
  machineName: (code: string) => string,
): string {
  const [first] = operation.allowedEquipment;
  const count = operation.allowedEquipment.length;
  const name = first === undefined ? 'no machine' : machineName(first);
  return count === 1 ? `1 machine, ${name}` : `${count} machines, default ${name}`;
}
