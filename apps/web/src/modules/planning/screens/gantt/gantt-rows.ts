// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDate, formatSpan } from '@northmes/contracts/format';
import type {
  EarlyOrder,
  GanttJobOrder,
  GanttOperation,
  GanttOrder,
  GanttSnapshot,
  JobOrderAnalysis,
  OrderAnalysis,
  Run,
  SavedSetup,
} from '../../gantt-data.ts';
import { orderNumbersText } from '../../gantt-draft.ts';

/** The levels of the order Gantt tree (plan 18, Rows and the tree): a run above its orders, then operations and job orders. */
export type GanttRow = RunRow | OrderRow | OperationRow | JobOrderRow;

/** A level 1 row: an order, or a run with its orders under it (plan 18, Runs). */
export type Level1Row = RunRow | OrderRow;

/** What the run row shows: whether the run ends after its deadline, and its span. */
export interface RunAnalysis {
  readonly late: boolean;
  /** Elapsed seconds the run ends after its deadline; zero when on time. */
  readonly lateByS: number;
  readonly plannedStartMs?: number;
  readonly plannedEndMs?: number;
}

export interface RunRow {
  readonly kind: 'run';
  readonly id: string;
  readonly run: Run;
  /** The first order of the run, whose color the summary bar takes and which a click selects. */
  readonly order: GanttOrder;
  readonly orders: readonly GanttOrder[];
  readonly analysis: RunAnalysis;
  readonly subRows: readonly OrderRow[];
}

export interface OrderRow {
  readonly kind: 'order';
  readonly id: string;
  readonly order: GanttOrder;
  readonly analysis: OrderAnalysis | undefined;
  /** The run the order is in, when it is. */
  readonly runId?: string;
  /** The early flag of an order whose own deadline is later than its run's (ADR 0083 rule 5). */
  readonly early?: EarlyOrder;
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

/** The ids of the rows: a run and an order by their ids, an operation and a job order by theirs. */
export const rowIds = {
  run: (run: Run) => run.id,
  order: (order: GanttOrder) => order.id,
  operation: (operation: GanttOperation) => `op-${operation.id}`,
  jobOrder: (jobOrder: GanttJobOrder) => jobOrder.id,
};

/** The row heights of plan 18, in rem: 36 px for summary rows, 52 px for job order rows. */
export const rowHeightRem = { run: 2.25, order: 2.25, operation: 2.25, jobOrder: 3.25 } as const;

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

function orderRowOf(snapshot: GanttSnapshot, order: GanttOrder, run: Run | undefined): OrderRow {
  const early = run?.early.find((each) => each.orderId === order.id);
  return {
    kind: 'order',
    id: rowIds.order(order),
    order,
    analysis: snapshot.analysis.orders[order.id],
    ...(run !== undefined && { runId: run.id }),
    ...(early !== undefined && { early }),
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
  };
}

/** The span and the late-by of a run over its orders' placed rows, against the run's deadline. */
function runAnalysisOf(run: Run, orders: readonly OrderRow[]): RunAnalysis {
  const span = summarySpan(orders.flatMap((order) => jobOrderRowsOf(order)));
  const lateByS = span === undefined ? 0 : Math.max(0, (span.toMs - run.deadlineMs) / 1000);
  return {
    late: lateByS > 0,
    lateByS,
    ...(span !== undefined && { plannedStartMs: span.fromMs, plannedEndMs: span.toMs }),
  };
}

/** The autoplan order over level 1 rows: a run sorts by its deadline and its first order's priority, number and id. */
function compareLevel1(a: Level1Row, b: Level1Row): number {
  const deadline = (row: Level1Row) =>
    row.kind === 'run' ? row.run.deadlineMs : row.order.deadlineMs;
  if (deadline(a) !== deadline(b)) return deadline(a) - deadline(b);
  return compareOrders(a.order, b.order);
}

/**
 * The tree of a snapshot: runs and the orders outside them in the autoplan order, a run's orders
 * under it, operations by sequence, job orders by start.
 */
export function buildGanttRows(snapshot: GanttSnapshot): Level1Row[] {
  const runs = snapshot.runs ?? [];
  const byId = new Map(snapshot.productionOrders.map((order) => [order.id, order]));
  const inRun = new Set(runs.flatMap((run) => run.orderIds));
  const rows: Level1Row[] = [];
  for (const run of runs) {
    const orders = run.orderIds.flatMap((id) => {
      const order = byId.get(id);
      return order === undefined ? [] : [order];
    });
    const [first] = orders;
    if (first === undefined) continue;
    const subRows = orders.map((order) => orderRowOf(snapshot, order, run));
    rows.push({
      kind: 'run',
      id: rowIds.run(run),
      run,
      order: first,
      orders,
      analysis: runAnalysisOf(run, subRows),
      subRows,
    });
  }
  for (const order of snapshot.productionOrders) {
    if (!inRun.has(order.id)) rows.push(orderRowOf(snapshot, order, undefined));
  }
  return rows.sort(compareLevel1);
}

/** Every job order of a snapshot without a placement, for the Not placed row. */
export function notPlacedRows(rows: readonly Level1Row[]): JobOrderRow[] {
  return rows.flatMap((row) =>
    jobOrderRowsOf(row).filter((each) => each.jobOrder.placement === undefined),
  );
}

/** The setup a run saves on a row, if any (ADR 0083 rule 4). */
export function savedSetupOf(snapshot: GanttSnapshot, jobOrderId: string): SavedSetup | undefined {
  for (const run of snapshot.runs ?? []) {
    const saved = run.savedSetups.find((each) => each.jobOrderId === jobOrderId);
    if (saved !== undefined) return saved;
  }
  return undefined;
}

/** "Run of Bracket L". */
export function runTitle(run: Run): string {
  return `Run of ${run.article}`;
}

/** "late by 2 days 16 h 45 min" for a late run, "on time" otherwise. */
export function runLatenessText(analysis: RunAnalysis): string {
  return analysis.late ? `late by ${formatDuration(analysis.lateByS)}` : 'on time';
}

/** "early by 7 days": the early flag of an order in a run. */
export function earlyText(early: EarlyOrder): string {
  return `early by ${formatDuration(early.earlyByS)}`;
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

/** The job order rows under a run, an order or an operation. */
export function jobOrderRowsOf(row: RunRow | OrderRow | OperationRow): JobOrderRow[] {
  if (row.kind === 'run') return row.subRows.flatMap((order) => jobOrderRowsOf(order));
  return row.kind === 'order'
    ? row.subRows.flatMap((operation) => operation.subRows)
    : [...row.subRows];
}

/**
 * The row a selected order stands for: its run when it is in one, since a click on a run row
 * selects the run's first order, else the order itself.
 */
export function selectionRowOf(
  row: GanttRow | undefined,
  rowById: ReadonlyMap<string, GanttRow>,
): GanttRow | undefined {
  if (row?.kind !== 'order' || row.runId === undefined) return row;
  return rowById.get(row.runId) ?? row;
}

/**
 * What Zoom to fit fits on the Gantt (ADR 0089, Zoom levels): a row's span, which for a run, an
 * order or an operation runs from its first setup start to its last end, and its name; with no
 * row, every loaded row. A row with nothing placed has no span.
 */
export function fitTargetOf(
  row: GanttRow | undefined,
  rows: readonly Level1Row[],
): {
  readonly span: { readonly fromMs: number; readonly toMs: number } | undefined;
  readonly name: string;
} {
  if (row === undefined) {
    return {
      span: summarySpan(rows.flatMap((each) => jobOrderRowsOf(each))),
      name: 'every loaded row',
    };
  }
  if (row.kind === 'jobOrder') {
    const { placement } = row.jobOrder;
    return {
      span:
        placement === undefined
          ? undefined
          : { fromMs: placement.setupStartMs, toMs: placement.endMs },
      name: `job order ${row.jobOrder.displayNumber}`,
    };
  }
  const name =
    row.kind === 'run'
      ? `the run of ${row.run.article}`
      : row.kind === 'order'
        ? `order ${row.order.number}`
        : `operation ${row.operation.displayNumber}`;
  return { span: summarySpan(jobOrderRowsOf(row)), name };
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
export function summaryName(row: RunRow | OrderRow | OperationRow, timeZone: string): string {
  const span = summarySpan(jobOrderRowsOf(row));
  const spanText = span === undefined ? 'not placed' : formatSpan(span.fromMs, span.toMs, timeZone);
  if (row.kind === 'run') {
    return `${runTitle(row.run)}, ${orderNumbersText(row.run.orderNumbers)}, ${spanText}, ${runLatenessText(row.analysis)}`;
  }
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

/** The second line of a run's row header: quantity, orders and the deadline date. */
export function runSubtext(row: RunRow, timeZone: string): string {
  const quantity = row.orders.reduce((sum, order) => sum + order.quantity, 0);
  return `${quantityText(quantity)}, orders ${orderNumbersText(row.run.orderNumbers)}, deadline ${formatPlantDate(row.run.deadlineMs, timeZone)}`;
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
