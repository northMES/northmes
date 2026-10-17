// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Cascade (plan 18, Auto-scheduling in a draft): after a move of one job order, the later
// operations of the same order move later when the move broke a rule between operations, never
// earlier, never past a fixed row. Rows of other orders never move; a collision with one is an
// OVERLAP. The result is what the draft writes and what the drag preview draws.
import { addWork, nextWorkingInstant, subtractWork, type Windows } from './calendar/windows.ts';
import {
  availabilityOn,
  compareRows,
  type JobOrderSpan,
  operationsInSequence,
  type PlanContext,
  type PlanJobOrder,
  type PlanOperation,
  type PlanOrder,
  type Reservation,
  reservationsOn,
  rowsOfOperation,
} from './plan-context.ts';
import { lastPieceMinEnd, predecessorOf, type Release, releaseOf } from './release.ts';

/** A move of one job order to a setup start, on its machine or on another allowed one. */
export interface Move {
  readonly jobOrderId: string;
  readonly setupStartMs: number;
  readonly equipment?: string;
}

export interface CascadeOptions {
  /** The Cascade switch of Board options; on by default (plan 18, working default). */
  readonly cascade?: boolean;
}

export type MoveReason = 'moved' | 'snappedToRelease' | 'cascade';

/** One draft change the cascade writes: a row from its old span to its new one. */
export interface PlacedMove {
  readonly jobOrderId: string;
  readonly displayNumber: string;
  readonly equipment: string;
  readonly from?: JobOrderSpan;
  readonly to: JobOrderSpan;
  readonly reason: MoveReason;
  /** For a drop before the row's release: the release it snapped forward to. */
  readonly snappedTo?: { readonly fromRow: string; readonly atMs: number };
}

export type ConflictKind = 'LEAD_TIME' | 'SEND_AHEAD' | 'LAST_PIECE' | 'OVERLAP' | 'FROZEN_WINDOW';

/** A broken rule that remains after the cascade, with the instant that clears it where one exists. */
export interface Conflict {
  readonly kind: ConflictKind;
  /** The rows it involves, by display number: the earlier row first. */
  readonly rows: readonly string[];
  readonly clearsAtMs?: number;
}

/** Why the cascade stopped at a successor row it could not move. */
export interface CascadeStop {
  readonly row: string;
  readonly jobOrderId: string;
  readonly reason: 'hardLock' | 'started' | 'held' | 'frozenWindow' | 'horizon';
}

/** The refusal of the move itself (plan 07, judgeMove): not confirmable. */
export type MoveRefusal = 'PINNED' | 'STARTED' | 'LOCKED';

export interface CascadeResult {
  /** The draft changes, the moved row first, then the successors in the order they moved. */
  readonly moves: readonly PlacedMove[];
  readonly stop?: CascadeStop;
  readonly conflicts: readonly Conflict[];
  readonly refused?: MoveRefusal;
  /** The order with the moves applied. */
  readonly order: PlanOrder;
}

/** The context with one order replaced by its working copy. */
function withOrder(context: PlanContext, order: PlanOrder): PlanContext {
  return {
    ...context,
    orders: context.orders.map((each) => (each.id === order.id ? order : each)),
  };
}

function withPlacement(
  order: PlanOrder,
  rowId: string,
  equipment: string,
  span: JobOrderSpan,
): PlanOrder {
  return {
    ...order,
    jobOrders: order.jobOrders.map((row) =>
      row.id === rowId ? { ...row, equipment, placement: span } : row,
    ),
  };
}

/** Why a row is fixed for the cascade (plan 18, Cascade rule 5), or undefined when it may move. */
function fixedReason(
  operation: PlanOperation,
  row: PlanJobOrder,
  context: PlanContext,
): CascadeStop['reason'] | undefined {
  if (operation.isLocked) return 'hardLock';
  if (row.status !== 'planned') return 'started';
  if (row.held === true) return 'held';
  const s = row.placement?.setupStartMs;
  if (s !== undefined && s >= context.nowMs && s < context.fenceMs) return 'frozenWindow';
  return undefined;
}

/** A row laid from a setup start: its retool, then its run, over the machine's availability. */
function layFrom(row: PlanJobOrder, setupStartMs: number, windows: Windows): JobOrderSpan | null {
  const whole = addWork(windows, setupStartMs, row.plannedSetupS + row.plannedRunS);
  const setup = addWork(windows, setupStartMs, row.plannedSetupS);
  if (whole === null || setup === null) return null;
  return { setupStartMs: whole.startMs, runStartMs: setup.endMs, endMs: whole.endMs };
}

/** The setup start a row needs for its run to start at an instant: the retool laid backward. */
function setupStartForRun(row: PlanJobOrder, runStartMs: number, windows: Windows): number {
  return subtractWork(windows, runStartMs, row.plannedSetupS)?.startMs ?? runStartMs;
}

/** The earliest setup start under a release: the run start (or the setup start) at or after it. */
function startUnderRelease(
  row: PlanJobOrder,
  release: Release,
  windows: Windows,
  context: PlanContext,
): number {
  const runBound = nextWorkingInstant(windows, release.atMs) ?? release.atMs;
  return context.settings.retoolOverlapsLeadTime
    ? setupStartForRun(row, runBound, windows)
    : runBound;
}

/** Whether a row at a span satisfies its release. */
function satisfiesRelease(span: JobOrderSpan, release: Release, context: PlanContext): boolean {
  const start = context.settings.retoolOverlapsLeadTime ? span.runStartMs : span.setupStartMs;
  return start >= release.atMs;
}

/** The reservation a span overlaps on a machine, other than the row's own, the earliest first. */
function overlapOf(
  span: JobOrderSpan,
  rowId: string,
  reservations: readonly Reservation[],
): Reservation | undefined {
  return reservations.find(
    (reservation) =>
      reservation.row.id !== rowId &&
      reservation.span.setupStartMs < span.endMs &&
      reservation.span.endMs > span.setupStartMs,
  );
}

const placementAttempts = 200;

/**
 * The span of a successor row under its release and its last-piece bound: from the earliest start
 * under the release, moved right past every reservation it overlaps on its machine, and right again
 * until the last-piece bound holds (plan 18, Cascade rule 4). Null past the horizon.
 */
function placeSuccessor(
  order: PlanOrder,
  row: PlanJobOrder,
  release: Release,
  context: PlanContext,
): JobOrderSpan | null {
  if (row.equipment === undefined) return null;
  const windows = availabilityOn(context, row.equipment);
  const reservations = reservationsOn(context, row.equipment);
  const minEndMs = lastPieceMinEnd(order, row, context);
  let setupStartMs = startUnderRelease(row, release, windows, context);
  for (let attempt = 0; attempt < placementAttempts; attempt += 1) {
    const span = layFrom(row, setupStartMs, windows);
    if (span === null) return null;
    const overlap = overlapOf(span, row.id, reservations);
    if (overlap !== undefined) {
      setupStartMs = nextWorkingInstant(windows, overlap.span.endMs) ?? overlap.span.endMs;
      continue;
    }
    if (minEndMs !== undefined && span.endMs < minEndMs) {
      const shifted = subtractWork(windows, minEndMs, row.plannedSetupS + row.plannedRunS);
      if (shifted === null) return null;
      setupStartMs = Math.max(shifted.startMs, span.setupStartMs + 1);
      continue;
    }
    return span;
  }
  return null;
}

/** The conflict of a row that lies before its release or its last-piece bound, if any. */
function ruleConflict(
  order: PlanOrder,
  row: PlanJobOrder,
  release: Release,
  context: PlanContext,
): Conflict | undefined {
  const span = row.placement;
  if (span === undefined) return undefined;
  const pair = predecessorOf(order, row.operationId);
  if (!satisfiesRelease(span, release, context)) {
    const sendAhead = (pair?.predecessor.sendAheadQuantity ?? 0) > 0;
    return {
      kind: sendAhead ? 'SEND_AHEAD' : 'LEAD_TIME',
      rows: [release.fromRow, row.displayNumber],
      clearsAtMs: release.atMs,
    };
  }
  const minEndMs = lastPieceMinEnd(order, row, context);
  if (minEndMs !== undefined && span.endMs < minEndMs) {
    return { kind: 'LAST_PIECE', rows: [release.fromRow, row.displayNumber], clearsAtMs: minEndMs };
  }
  return undefined;
}

/**
 * A move of one job order and the cascade it causes (plan 18, Cascade): the moved row is laid at
 * its dropped setup start, snapped forward to the next working instant on the machine and, with
 * cascade on, to its own release and last-piece bound. Then each row of the later operations, in
 * sequence order and the tie order, stays when its release and its last-piece bound hold, moves to
 * the earliest position that satisfies them on its own machine when they do not, and stops the
 * cascade when it is fixed. With cascade off the move stands alone and every broken rule is
 * reported. Pure, deterministic and permutation-invariant.
 */
export function cascade(
  order: PlanOrder,
  move: Move,
  context: PlanContext,
  options: CascadeOptions = {},
): CascadeResult {
  const cascadeOn = options.cascade ?? true;
  const operations = operationsInSequence(order);
  const moved = order.jobOrders.find((row) => row.id === move.jobOrderId);
  const movedOperation = operations.find((each) => each.id === moved?.operationId);
  if (moved === undefined || movedOperation === undefined) {
    return { moves: [], conflicts: [], order };
  }
  const refusal = fixedReason(movedOperation, moved, context);
  if (refusal === 'hardLock') return { moves: [], conflicts: [], refused: 'PINNED', order };
  if (refusal === 'started') return { moves: [], conflicts: [], refused: 'STARTED', order };
  if (refusal === 'held') return { moves: [], conflicts: [], refused: 'LOCKED', order };

  const equipment = move.equipment ?? moved.equipment;
  if (equipment === undefined) return { moves: [], conflicts: [], order };
  const windows = availabilityOn(context, equipment);
  const moves: PlacedMove[] = [];
  const conflicts: Conflict[] = [];
  let working = order;

  // The moved row: the forward snap, then with cascade on its own release and last-piece bound.
  let setupStartMs = nextWorkingInstant(windows, move.setupStartMs) ?? move.setupStartMs;
  let reason: MoveReason = 'moved';
  let snappedTo: PlacedMove['snappedTo'];
  const ownRelease = releaseOf(order, movedOperation.id, context);
  if (cascadeOn && ownRelease !== undefined) {
    const underRelease = startUnderRelease(moved, ownRelease, windows, context);
    if (setupStartMs < underRelease) {
      setupStartMs = underRelease;
      reason = 'snappedToRelease';
      snappedTo = { fromRow: ownRelease.fromRow, atMs: ownRelease.atMs };
    }
    const minEndMs = lastPieceMinEnd(order, { ...moved, equipment }, context);
    const laid = layFrom(moved, setupStartMs, windows);
    if (minEndMs !== undefined && laid !== null && laid.endMs < minEndMs) {
      const shifted = subtractWork(windows, minEndMs, moved.plannedSetupS + moved.plannedRunS);
      if (shifted !== null && shifted.startMs > setupStartMs) {
        setupStartMs = shifted.startMs;
        reason = 'snappedToRelease';
        snappedTo = { fromRow: ownRelease.fromRow, atMs: minEndMs };
      }
    }
  }
  const span = layFrom(moved, setupStartMs, windows);
  if (span === null) {
    return {
      moves: [],
      conflicts: [],
      stop: { row: moved.displayNumber, jobOrderId: moved.id, reason: 'horizon' },
      order,
    };
  }
  moves.push({
    jobOrderId: moved.id,
    displayNumber: moved.displayNumber,
    equipment,
    ...(moved.placement !== undefined && { from: moved.placement }),
    to: span,
    reason,
    ...(snappedTo !== undefined && { snappedTo }),
  });
  working = withPlacement(working, moved.id, equipment, span);
  let ctx = withOrder(context, working);

  if (span.setupStartMs >= context.nowMs && span.setupStartMs < context.fenceMs) {
    conflicts.push({ kind: 'FROZEN_WINDOW', rows: [moved.displayNumber] });
  }

  // The later operations, each row under its release from the rows as they now lie.
  let stop: CascadeStop | undefined;
  const start = operations.findIndex((each) => each.id === movedOperation.id);
  for (let index = start + 1; index < operations.length && stop === undefined; index += 1) {
    const operation = operations[index];
    if (operation === undefined) continue;
    const release = releaseOf(working, operation.id, ctx);
    if (release === undefined) break;
    const rows = rowsOfOperation(working, operation).sort(
      (a, b) =>
        (a.placement?.setupStartMs ?? Number.POSITIVE_INFINITY) -
          (b.placement?.setupStartMs ?? Number.POSITIVE_INFINITY) || compareRows(a, b),
    );
    for (const row of rows) {
      const current = working.jobOrders.find((each) => each.id === row.id) ?? row;
      const broken = ruleConflict(working, current, release, ctx);
      if (broken === undefined) continue;
      if (!cascadeOn) {
        conflicts.push(broken);
        continue;
      }
      const fixed = fixedReason(operation, current, ctx);
      if (fixed !== undefined) {
        conflicts.push(broken);
        stop = { row: current.displayNumber, jobOrderId: current.id, reason: fixed };
        break;
      }
      const placed = placeSuccessor(working, current, release, ctx);
      if (placed === null || current.equipment === undefined) {
        conflicts.push(broken);
        stop = { row: current.displayNumber, jobOrderId: current.id, reason: 'horizon' };
        break;
      }
      moves.push({
        jobOrderId: current.id,
        displayNumber: current.displayNumber,
        equipment: current.equipment,
        ...(current.placement !== undefined && { from: current.placement }),
        to: placed,
        reason: 'cascade',
      });
      working = withPlacement(working, current.id, current.equipment, placed);
      ctx = withOrder(context, working);
    }
  }

  // The moved row's own breaks, judged once its successors have moved: an overlap with a successor
  // the cascade carried away is no conflict, one with another order's row is.
  const movedRow = working.jobOrders.find((row) => row.id === moved.id);
  const overlap = overlapOf(span, moved.id, reservationsOn(ctx, equipment));
  if (overlap !== undefined) {
    conflicts.push({
      kind: 'OVERLAP',
      rows: [overlap.row.displayNumber, moved.displayNumber].sort(),
    });
  }
  if (ownRelease !== undefined && movedRow !== undefined) {
    const own = ruleConflict(working, movedRow, ownRelease, ctx);
    if (own !== undefined) conflicts.push(own);
  }

  return {
    moves,
    ...(stop !== undefined && { stop }),
    conflicts,
    order: working,
  };
}
