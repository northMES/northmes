// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Runs of production orders of one article (ADR 0083, plan 18 Runs): two or more orders a planner
// combines to plan together. The orders are ranked, the first keeps its placement, and each later
// order's row of an operation with a retool is laid after the previous order's row of that
// operation on its machine with no retool (its fixed time stays), at the later of that row's end
// and its own release, while its other rows are placed under their release past every
// reservation. The run's deadline is the earliest of its orders; the split puts every moved row
// back where it was.
import {
  type CascadeStop,
  type Conflict,
  cascade,
  type PlacedMove,
  placeUnderRelease,
} from './cascade.ts';
import {
  compareCodeUnits,
  compareRows,
  type JobOrderSpan,
  operationsInSequence,
  type PlanContext,
  type PlanJobOrder,
  type PlanOperation,
  type PlanOrder,
  rowsOfOperation,
} from './plan-context.ts';
import { releaseOf } from './release.ts';

/**
 * A retool the run saves (ADR 0083 rule 4): the row that runs without it, after another order's
 * row of the same operation on the machine. The row's fixed time stays its planned setup.
 */
export interface SavedSetup {
  readonly jobOrderId: string;
  readonly displayNumber: string;
  /** The row of the previous order of the run that the row follows on the machine. */
  readonly afterJobOrderId: string;
  readonly afterDisplayNumber: string;
  readonly equipment: string;
  /** The retool seconds the run saves: the row's planned setup less its fixed time. */
  readonly setupS: number;
}

/** Where a row the combine moved was before it (ADR 0083 rule 7), so the split puts it back. */
export interface RowBefore {
  readonly jobOrderId: string;
  readonly displayNumber: string;
  readonly equipment: string;
  readonly placement: JobOrderSpan;
  readonly plannedSetupS: number;
}

/** An order of the run whose own deadline is later than the run's, so the run pulls it forward. */
export interface EarlyOrder {
  readonly orderId: string;
  readonly number: string;
  readonly deadlineMs: number;
  /** Elapsed seconds from the run's deadline to the order's own. */
  readonly earlyByS: number;
}

/** The run record (ADR 0083): the planning record the draft holds and Save commits. */
export interface Run {
  /** Deterministic from the orders, so a run built twice is one run. */
  readonly id: string;
  readonly article: string;
  /** The orders in the run's order: the first keeps its placement, each later one follows. */
  readonly orderIds: readonly string[];
  readonly orderNumbers: readonly string[];
  /** The earliest deadline of the orders. */
  readonly deadlineMs: number;
  readonly savedSetups: readonly SavedSetup[];
  readonly early: readonly EarlyOrder[];
  /** Every row the combine moved, with the placement it had before, in the order of the moves. */
  readonly before: readonly RowBefore[];
}

/**
 * Why orders cannot be combined: fewer than two, of different articles (or an order without an
 * article), an order without a placed row, or an order with a fixed row (ADR 0083, working
 * default: a started, held or hard-locked order joins no run).
 */
export type RunRefusal = 'ONE_ORDER' | 'DIFFERENT_ARTICLES' | 'UNPLACED' | 'FIXED';

export interface RunResult {
  readonly run?: Run;
  /** The draft changes, in the run's order, then by operation sequence and the tie order. */
  readonly moves: readonly PlacedMove[];
  readonly conflicts: readonly Conflict[];
  readonly stops: readonly CascadeStop[];
  readonly refused?: RunRefusal;
  /** The row or order the refusal names. */
  readonly refusedBy?: string;
  /** The orders with the moves applied, in the run's order. */
  readonly orders: readonly PlanOrder[];
  /** The span of the run over its placed rows. */
  readonly startMs?: number;
  readonly endMs?: number;
  readonly late: boolean;
  /** Elapsed seconds the run ends after its deadline; zero when on time. */
  readonly lateByS: number;
}

export interface SplitResult {
  /** The rows the combine moved, back to the placements they had before, with their retool back. */
  readonly moves: readonly PlacedMove[];
  /** The orders as they were before the combine, in the run's order. */
  readonly orders: readonly PlanOrder[];
}

function firstPlacedStart(order: PlanOrder): number | undefined {
  let start: number | undefined;
  for (const row of order.jobOrders) {
    const s = row.placement?.setupStartMs;
    if (s !== undefined && (start === undefined || s < start)) start = s;
  }
  return start;
}

/** The autoplan order of orders (plan 18): deadline, priority with null last, number, id. */
function compareAutoplan(a: PlanOrder, b: PlanOrder): number {
  if (a.deadlineMs !== b.deadlineMs) return a.deadlineMs - b.deadlineMs;
  if (a.priority !== b.priority) {
    if (a.priority === null) return 1;
    if (b.priority === null) return -1;
    return a.priority - b.priority;
  }
  return compareCodeUnits(a.number, b.number) || compareCodeUnits(a.id, b.id);
}

/** The run's order (ADR 0083 rule 3): the setup start of the first placed row, then the autoplan order. */
function compareForRun(a: PlanOrder, b: PlanOrder): number {
  const left = firstPlacedStart(a) ?? Number.POSITIVE_INFINITY;
  const right = firstPlacedStart(b) ?? Number.POSITIVE_INFINITY;
  return left - right || compareAutoplan(a, b);
}

/** The fixed row of an order, if any: hard-locked, started or held. */
function fixedRowOf(order: PlanOrder): PlanJobOrder | undefined {
  const locked = new Set(
    order.operations.filter((operation) => operation.isLocked).map((operation) => operation.id),
  );
  return [...order.jobOrders]
    .sort(compareRows)
    .find((row) => locked.has(row.operationId) || row.status !== 'planned' || row.held === true);
}

function withOrders(context: PlanContext, orders: readonly PlanOrder[]): PlanContext {
  const byId = new Map(orders.map((order) => [order.id, order]));
  return { ...context, orders: context.orders.map((each) => byId.get(each.id) ?? each) };
}

function withRow(
  order: PlanOrder,
  rowId: string,
  change: Partial<Pick<PlanJobOrder, 'equipment' | 'placement' | 'plannedSetupS'>>,
): PlanOrder {
  return {
    ...order,
    jobOrders: order.jobOrders.map((row) => (row.id === rowId ? { ...row, ...change } : row)),
  };
}

/** The latest-ending placed row of an operation, as the run follows it. */
function latestRowOf(order: PlanOrder, operation: PlanOperation): PlanJobOrder | undefined {
  let latest: PlanJobOrder | undefined;
  for (const row of rowsOfOperation(order, operation)) {
    const end = row.placement?.endMs;
    if (end === undefined) continue;
    if (latest?.placement === undefined || end > latest.placement.endMs) latest = row;
  }
  return latest;
}

/** The moves merged by row: the first origin, the last target. */
function mergeMoves(moves: readonly PlacedMove[]): PlacedMove[] {
  const merged: PlacedMove[] = [];
  for (const move of moves) {
    const index = merged.findIndex((each) => each.jobOrderId === move.jobOrderId);
    const existing = merged[index];
    if (existing === undefined) {
      merged.push(move);
      continue;
    }
    merged[index] = {
      ...move,
      ...(existing.from !== undefined && { from: existing.from }),
      reason: existing.reason === 'run' ? 'run' : move.reason,
      ...(existing.setupS !== undefined &&
        move.setupS === undefined && { setupS: existing.setupS }),
    };
  }
  return merged;
}

function mergeConflicts(conflicts: readonly Conflict[]): Conflict[] {
  const seen = new Set<string>();
  return conflicts.filter((conflict) => {
    const key = `${conflict.kind}:${conflict.rows.join(':')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function spanOf(orders: readonly PlanOrder[]): { startMs: number; endMs: number } | undefined {
  let startMs: number | undefined;
  let endMs: number | undefined;
  for (const order of orders) {
    for (const row of order.jobOrders) {
      if (row.placement === undefined) continue;
      if (startMs === undefined || row.placement.setupStartMs < startMs)
        startMs = row.placement.setupStartMs;
      if (endMs === undefined || row.placement.endMs > endMs) endMs = row.placement.endMs;
    }
  }
  return startMs === undefined || endMs === undefined ? undefined : { startMs, endMs };
}

function refusal(orders: readonly PlanOrder[], refused: RunRefusal, refusedBy?: string): RunResult {
  return {
    moves: [],
    conflicts: [],
    stops: [],
    refused,
    ...(refusedBy !== undefined && { refusedBy }),
    orders,
    late: false,
    lateByS: 0,
  };
}

/**
 * Orders of one article combined into a run (ADR 0083): the orders ranked by the setup start of
 * their first placed row and then the autoplan order; the first order unchanged; for each later
 * order, in operation sequence, a row of an operation with a setup laid directly after the previous
 * order's row of the same operation on its machine with no setup (the saved setup), through the
 * cascade, and every other row placed under its release past the reservations on its machine. The
 * run's deadline is the earliest of its orders; an order with a later deadline is early. What the
 * run breaks is reported, never repaired. Pure, deterministic and permutation-invariant.
 */
export function combineIntoRun(orders: readonly PlanOrder[], context: PlanContext): RunResult {
  const ranked = [...orders].sort(compareForRun);
  if (ranked.length < 2) return refusal(ranked, 'ONE_ORDER');
  const articles = new Set(ranked.map((order) => order.article));
  const article = ranked[0]?.article;
  if (articles.size !== 1 || article === undefined) {
    return refusal(ranked, 'DIFFERENT_ARTICLES');
  }
  for (const order of ranked) {
    if (order.jobOrders.some((row) => row.placement === undefined || row.equipment === undefined)) {
      return refusal(ranked, 'UNPLACED', order.number);
    }
    const fixed = fixedRowOf(order);
    if (fixed !== undefined) return refusal(ranked, 'FIXED', fixed.displayNumber);
  }

  const deadlineMs = Math.min(...ranked.map((order) => order.deadlineMs));
  const early: EarlyOrder[] = ranked
    .filter((order) => order.deadlineMs > deadlineMs)
    .map((order) => ({
      orderId: order.id,
      number: order.number,
      deadlineMs: order.deadlineMs,
      earlyByS: (order.deadlineMs - deadlineMs) / 1000,
    }));

  const working: PlanOrder[] = [...ranked];
  let ctx = withOrders(context, working);
  const moves: PlacedMove[] = [];
  const conflicts: Conflict[] = [];
  const stops: CascadeStop[] = [];
  const savedSetups: SavedSetup[] = [];

  for (let index = 1; index < working.length; index += 1) {
    const previous = working[index - 1];
    let order = working[index];
    if (previous === undefined || order === undefined) continue;
    const previousOperations = operationsInSequence(previous);
    for (const operation of operationsInSequence(order)) {
      const counterpart = previousOperations.find((each) => each.sequence === operation.sequence);
      const rows = rowsOfOperation(order, operation);
      // The row the first of this operation's rows follows: the previous order's row of the
      // operation; then each row of a split operation follows the one before it.
      let after = counterpart === undefined ? undefined : latestRowOf(previous, counterpart);
      const saves =
        operation.rates.retoolSeconds > 0 &&
        after?.equipment !== undefined &&
        operation.allowedEquipment.includes(after.equipment);
      for (const row of rows) {
        const current = order.jobOrders.find((each) => each.id === row.id) ?? row;
        // The cascade rules (plan 18, Cascade rule 5), on both paths: a row that already lies
        // inside the frozen window is fixed, keeps its place and its retool, and is reported as a
        // stop; a row placed into the window moves and the break is reported.
        const currentStart = current.placement?.setupStartMs;
        if (currentStart !== undefined && currentStart >= ctx.nowMs && currentStart < ctx.fenceMs) {
          stops.push({
            row: current.displayNumber,
            jobOrderId: current.id,
            reason: 'frozenWindow',
          });
          after = current;
          continue;
        }
        if (saves && after?.placement !== undefined && after.equipment !== undefined) {
          const equipment = after.equipment;
          // The retool goes, the fixed time stays (ADR 0083 rule 4, PO-84).
          const retoolS = Math.min(current.plannedSetupS, current.rates.retoolSeconds);
          const fixedS = current.plannedSetupS - retoolS;
          const stripped = withRow(order, current.id, { plannedSetupS: fixedS });
          const result = cascade(
            stripped,
            { jobOrderId: current.id, setupStartMs: after.placement.endMs, equipment },
            withOrders(ctx, [stripped]),
            { cascade: true },
          );
          if (result.refused !== undefined || result.moves.length === 0) {
            if (result.stop !== undefined) stops.push(result.stop);
            continue;
          }
          const [own, ...successors] = result.moves;
          if (own !== undefined) {
            moves.push({ ...own, reason: 'run', setupS: fixedS });
            savedSetups.push({
              jobOrderId: current.id,
              displayNumber: current.displayNumber,
              afterJobOrderId: after.id,
              afterDisplayNumber: after.displayNumber,
              equipment,
              setupS: retoolS,
            });
          }
          moves.push(...successors);
          conflicts.push(...result.conflicts);
          if (result.stop !== undefined) stops.push(result.stop);
          order = result.order;
          after = order.jobOrders.find((each) => each.id === current.id);
        } else {
          const release = releaseOf(order, operation.id, ctx);
          if (release === undefined) continue;
          const placed = placeUnderRelease(order, current, release, ctx);
          if (placed === null || current.equipment === undefined) {
            stops.push({ row: current.displayNumber, jobOrderId: current.id, reason: 'horizon' });
            continue;
          }
          const span = current.placement;
          if (
            span !== undefined &&
            span.setupStartMs === placed.setupStartMs &&
            span.endMs === placed.endMs
          ) {
            after = current;
            continue;
          }
          moves.push({
            jobOrderId: current.id,
            displayNumber: current.displayNumber,
            equipment: current.equipment,
            ...(span !== undefined && { from: span }),
            to: placed,
            reason: 'cascade',
          });
          if (placed.setupStartMs >= ctx.nowMs && placed.setupStartMs < ctx.fenceMs) {
            conflicts.push({ kind: 'FROZEN_WINDOW', rows: [current.displayNumber] });
          }
          order = withRow(order, current.id, { placement: placed });
          after = order.jobOrders.find((each) => each.id === current.id);
        }
        working[index] = order;
        ctx = withOrders(ctx, [order]);
      }
    }
  }

  const span = spanOf(working);
  const lateByS = span === undefined ? 0 : Math.max(0, (span.endMs - deadlineMs) / 1000);
  const orderIds = ranked.map((order) => order.id);
  const merged = mergeMoves(moves);
  const rowsBefore = new Map(
    ranked.flatMap((order) => order.jobOrders.map((row) => [row.id, row] as const)),
  );
  const before: RowBefore[] = merged.flatMap((move) => {
    const row = rowsBefore.get(move.jobOrderId);
    if (row?.placement === undefined || row.equipment === undefined) return [];
    return [
      {
        jobOrderId: row.id,
        displayNumber: row.displayNumber,
        equipment: row.equipment,
        placement: row.placement,
        plannedSetupS: row.plannedSetupS,
      },
    ];
  });
  return {
    run: {
      id: `run:${orderIds.join('+')}`,
      article,
      orderIds,
      orderNumbers: ranked.map((order) => order.number),
      deadlineMs,
      savedSetups,
      early,
      before,
    },
    moves: merged,
    conflicts: mergeConflicts(conflicts),
    stops,
    orders: working,
    ...(span !== undefined && { startMs: span.startMs, endMs: span.endMs }),
    late: lateByS > 0,
    lateByS,
  };
}

/**
 * A run split (ADR 0083 rule 7): every row the combine moved goes back to the placement the run
 * record holds, on its machine, with its retool back, so the orders are as they were before the
 * combine. Nothing is laid again and nothing cascades: the placements were the plan's own.
 */
export function splitRun(run: Run, orders: readonly PlanOrder[]): SplitResult {
  const byId = new Map(orders.map((order) => [order.id, order]));
  const working: PlanOrder[] = run.orderIds.flatMap((id) => {
    const order = byId.get(id);
    return order === undefined ? [] : [order];
  });
  const moves: PlacedMove[] = [];
  for (const before of run.before) {
    const index = working.findIndex((order) =>
      order.jobOrders.some((row) => row.id === before.jobOrderId),
    );
    const order = working[index];
    const row = order?.jobOrders.find((each) => each.id === before.jobOrderId);
    if (order === undefined || row === undefined) continue;
    moves.push({
      jobOrderId: row.id,
      displayNumber: row.displayNumber,
      equipment: before.equipment,
      ...(row.placement !== undefined && { from: row.placement }),
      to: before.placement,
      reason: 'moved',
      ...(row.plannedSetupS !== before.plannedSetupS && { setupS: before.plannedSetupS }),
    });
    working[index] = withRow(order, row.id, {
      equipment: before.equipment,
      placement: before.placement,
      plannedSetupS: before.plannedSetupS,
    });
  }
  return { moves, orders: working };
}
