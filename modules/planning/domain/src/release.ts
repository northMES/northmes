// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The rules between consecutive operations P and N of one order (plan 07, Rules between
// operations): the release of N from P's rows at their positions, with the send-ahead quantity and
// the lead time, and the last-piece bound on each N row's end.
import { addWork, nextWorkingInstant, subtractWork, type Windows } from './calendar/windows.ts';
import { oneCycleSeconds, runSecondsFor } from './duration.ts';
import {
  availabilityOn,
  operationsInSequence,
  type PlanContext,
  type PlanJobOrder,
  type PlanOperation,
  type PlanOrder,
  rowsOfOperation,
} from './plan-context.ts';

/** The release of an operation from its predecessor, which the link draws (plan 18). */
export interface Release {
  /** The predecessor row that sets the release: the latest-ending one, or the one that completes the send-ahead quantity. */
  readonly fromRow: string;
  readonly fromJobOrderId: string;
  /** The release point: the predecessor's latest end, or the instant its send-ahead quantity is complete. */
  readonly pointMs: number;
  /** The release instant: the release point plus the lead time. */
  readonly atMs: number;
}

/** The predecessor of an operation in the order's sequence, with the operation itself. */
export function predecessorOf(
  order: PlanOrder,
  operationId: string,
): { readonly operation: PlanOperation; readonly predecessor: PlanOperation } | undefined {
  const operations = operationsInSequence(order);
  const index = operations.findIndex((each) => each.id === operationId);
  const operation = operations[index];
  const predecessor = operations[index - 1];
  if (operation === undefined || predecessor === undefined) return undefined;
  return { operation, predecessor };
}

/**
 * A lead time laid forward from an instant: elapsed clock time by default, or working time on the
 * later operation's machine when the plant counts lead times that way.
 */
export function leadForward(
  leadS: number,
  fromMs: number,
  later: Windows,
  context: PlanContext,
): number | null {
  if (context.settings.leadTimeBasis === 'working') {
    return addWork(later, fromMs, leadS)?.endMs ?? null;
  }
  return fromMs + leadS * 1000;
}

/** A lead time laid backward from an instant, the mirror of leadForward. */
export function leadBackward(
  leadS: number,
  untilMs: number,
  later: Windows,
  context: PlanContext,
): number | null {
  if (context.settings.leadTimeBasis === 'working') {
    return subtractWork(later, untilMs, leadS)?.startMs ?? null;
  }
  return untilMs - leadS * 1000;
}

/**
 * The instant a predecessor row completes its k-th piece: its run laid from its setup end for the
 * run seconds of k pieces. Null when the row is not placed or the horizon runs out.
 */
function pieceCompleteAt(row: PlanJobOrder, k: number, windows: Windows): number | null {
  if (row.placement === undefined) return null;
  return addWork(windows, row.placement.runStartMs, runSecondsFor(k, row.rates))?.endMs ?? null;
}

/**
 * The release point of an operation from its predecessor's rows at their positions: the latest end
 * over the rows, or, with a send-ahead quantity, the first instant at which the rows together have
 * produced it, with the row that completes it. Undefined while a predecessor row is unplaced.
 */
function releasePoint(
  rows: readonly PlanJobOrder[],
  sendAheadQuantity: number,
  context: PlanContext,
): { readonly row: PlanJobOrder; readonly pointMs: number } | undefined {
  if (rows.length === 0 || rows.some((row) => row.placement === undefined)) return undefined;
  if (sendAheadQuantity <= 0) {
    let latest: { row: PlanJobOrder; pointMs: number } | undefined;
    for (const row of rows) {
      const endMs = row.placement?.endMs ?? 0;
      if (latest === undefined || endMs > latest.pointMs) latest = { row, pointMs: endMs };
    }
    return latest;
  }
  // The completion instants of the pieces of every row, merged: the quantity's piece is the
  // send-ahead quantity's smallest. A row with fewer pieces than the quantity contributes all it has.
  const completions: { row: PlanJobOrder; atMs: number }[] = [];
  for (const row of rows) {
    const windows = availabilityOn(context, row.equipment);
    const pieces = Math.min(row.quantity, sendAheadQuantity);
    for (let k = 1; k <= pieces; k += 1) {
      const atMs = pieceCompleteAt(row, k, windows);
      if (atMs === null) return undefined;
      completions.push({ row, atMs });
    }
  }
  completions.sort((a, b) => a.atMs - b.atMs);
  const at = completions[sendAheadQuantity - 1];
  return at === undefined ? undefined : { row: at.row, pointMs: at.atMs };
}

/**
 * The release of an operation from its predecessor at the predecessor rows' planned positions:
 * none for the first operation, or while a predecessor row is unplaced or the horizon runs out.
 */
export function releaseOf(
  order: PlanOrder,
  operationId: string,
  context: PlanContext,
): Release | undefined {
  const pair = predecessorOf(order, operationId);
  if (pair === undefined) return undefined;
  const { operation, predecessor } = pair;
  const point = releasePoint(
    rowsOfOperation(order, predecessor),
    predecessor.sendAheadQuantity,
    context,
  );
  if (point === undefined) return undefined;
  const later = rowsOfOperation(order, operation)[0];
  const atMs = leadForward(
    operation.leadTimeS,
    point.pointMs,
    availabilityOn(context, later?.equipment),
    context,
  );
  if (atMs === null) return undefined;
  return {
    fromRow: point.row.displayNumber,
    fromJobOrderId: point.row.id,
    pointMs: point.pointMs,
    atMs,
  };
}

/**
 * The instant a row's run may start under the release: the release instant, moved forward to the
 * next working instant on the row's machine.
 */
export function runStartBound(release: Release, windows: Windows): number | null {
  return nextWorkingInstant(windows, release.atMs);
}

/**
 * The last-piece bound of a row of operation N (plan 07 rule 4): its end lies no earlier than the
 * predecessor's latest end plus the lead time plus one N cycle on the row's machine. Undefined
 * while a predecessor row is unplaced.
 */
export function lastPieceMinEnd(
  order: PlanOrder,
  row: PlanJobOrder,
  context: PlanContext,
): number | undefined {
  const pair = predecessorOf(order, row.operationId);
  if (pair === undefined) return undefined;
  const windows = availabilityOn(context, row.equipment);
  const predecessorRows = rowsOfOperation(order, pair.predecessor);
  if (
    predecessorRows.length === 0 ||
    predecessorRows.some((each) => each.placement === undefined)
  ) {
    return undefined;
  }
  const latestEndMs = Math.max(...predecessorRows.map((each) => each.placement?.endMs ?? 0));
  const afterLead = leadForward(pair.operation.leadTimeS, latestEndMs, windows, context);
  if (afterLead === null) return undefined;
  return addWork(windows, afterLead, oneCycleSeconds(row.rates))?.endMs;
}
