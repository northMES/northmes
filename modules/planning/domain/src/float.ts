// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Float, wait and the binding constraint of every row of one order (plan 18, Float and the
// critical chain): pure functions over the loaded plan, in epoch milliseconds, with every float and
// wait in working seconds on the row's machine.
import {
  addWork,
  nextWorkingInstant,
  subtractWork,
  type Windows,
  workBetween,
} from './calendar/windows.ts';
import { oneCycleSeconds, runSecondsFor } from './duration.ts';
import {
  availabilityOn,
  operationsInSequence,
  type PlanContext,
  type PlanJobOrder,
  type PlanOperation,
  type PlanOrder,
  reservationsOn,
  rowsOfOperation,
} from './plan-context.ts';
import { leadBackward, type Release, releaseOf } from './release.ts';

export type BindingConstraintKind =
  | 'started'
  | 'hardLock'
  | 'frozenWindow'
  | 'earliestStart'
  | 'release'
  | 'machine'
  | 'calendar'
  | 'free';

/** What stops a row from starting earlier than it does: the first rule that applies, in this order. */
export interface BindingConstraint {
  readonly kind: BindingConstraintKind;
  /** The row that binds it, by display number: the predecessor of a release, the reservation of a machine. */
  readonly boundBy?: string;
  /** The same row by job order id, which the chain follows, because the rows of a split operation share a display number. */
  readonly boundByJobOrderId?: string;
  readonly equipment?: string;
}

/** The float values of one row, in working seconds on its machine. */
export interface RowFloat {
  readonly earliestStartMs: number;
  readonly waitWorkingS: number;
  readonly latestStartMs: number;
  readonly latestEndMs: number;
  readonly totalFloatWorkingS: number;
  readonly freeFloatWorkingS: number;
  readonly binding: BindingConstraint;
  /** Total float at or below zero: any delay delays the order past its deadline, or further past it. */
  readonly critical: boolean;
}

export interface FloatResult {
  /** By job order id; a row without a placement, or whose predecessor is unplaced, has no entry. */
  readonly rows: Readonly<Record<string, RowFloat>>;
  readonly late: boolean;
  /** Elapsed seconds from the planned end to the deadline, negative when late (plan 18, Slack). */
  readonly slackElapsedS: number;
  readonly plannedStartMs?: number;
  readonly plannedEndMs?: number;
  /** When late, the working time on the last row's machine that the order is late by. */
  readonly lateByWorking?: { readonly seconds: number; readonly equipment: string };
}

/** A row's start that the release bounds: the run start when retool may overlap the lead time. */
function boundStart(row: PlanJobOrder, context: PlanContext): number | undefined {
  if (row.placement === undefined) return undefined;
  return context.settings.retoolOverlapsLeadTime
    ? row.placement.runStartMs
    : row.placement.setupStartMs;
}

/** The start of a row whose run starts at an instant: the retool laid backward from it. */
function setupStartFor(row: PlanJobOrder, runStartMs: number, windows: Windows): number {
  // Without retool the setup starts with the run: zero work laid backward from the start of a
  // window would land at the end of the window before it.
  if (row.plannedSetupS <= 0) return runStartMs;
  return subtractWork(windows, runStartMs, row.plannedSetupS)?.startMs ?? runStartMs;
}

/** The run start of a row whose setup starts at an instant: the retool laid forward from it. */
function runStartFor(row: PlanJobOrder, setupStartMs: number, windows: Windows): number {
  return addWork(windows, setupStartMs, row.plannedSetupS)?.endMs ?? setupStartMs;
}

/** The row of the last operation that ends last: where the order's planned end and its chain start. */
export function lastRowOf(order: PlanOrder): PlanJobOrder | undefined {
  let last: PlanJobOrder | undefined;
  for (const row of order.jobOrders) {
    if (row.placement === undefined) continue;
    if (last?.placement === undefined || row.placement.endMs > last.placement.endMs) last = row;
  }
  return last;
}

/**
 * The latest end of a row of operation P, from the starts and ends its successor rows may have
 * (plan 07, latestEnd): the successors' anchor less the lead time, the last-piece bound, and with a
 * send-ahead quantity the share of P's row that may finish after the anchor. `successorAt` gives
 * each successor row's (setup start, run start, end): the latest ones for the total float, the
 * planned ones for the successor bound of the free float.
 */
function latestEndFrom(
  order: PlanOrder,
  operation: PlanOperation,
  row: PlanJobOrder,
  successor: PlanOperation | undefined,
  successorAt: (
    row: PlanJobOrder,
  ) => { setupStartMs: number; runStartMs: number; endMs: number } | undefined,
  context: PlanContext,
): number | undefined {
  if (successor === undefined) return order.deadlineMs;
  const successors = rowsOfOperation(order, successor);
  let anchor = Number.POSITIVE_INFINITY;
  let lastPiece = Number.POSITIVE_INFINITY;
  for (const next of successors) {
    const at = successorAt(next);
    if (at === undefined) return undefined;
    const later = availabilityOn(context, next.equipment);
    const start = context.settings.retoolOverlapsLeadTime ? at.runStartMs : at.setupStartMs;
    const anchorLead = leadBackward(successor.leadTimeS, start, later, context);
    const cycleStart = subtractWork(later, at.endMs, oneCycleSeconds(next.rates))?.startMs;
    const pieceLead =
      cycleStart === undefined
        ? null
        : leadBackward(successor.leadTimeS, cycleStart, later, context);
    if (anchorLead === null || pieceLead === null) return undefined;
    anchor = Math.min(anchor, anchorLead);
    lastPiece = Math.min(lastPiece, pieceLead);
  }
  if (operation.sendAheadQuantity <= 0) return Math.min(anchor, lastPiece);
  const share = Math.ceil((operation.sendAheadQuantity * row.quantity) / operation.quantity);
  const work = runSecondsFor(row.quantity, row.rates) - runSecondsFor(share, row.rates);
  const own = availabilityOn(context, row.equipment);
  const afterShare = addWork(own, anchor, work)?.endMs;
  return afterShare === undefined ? undefined : Math.min(lastPiece, afterShare);
}

/**
 * The binding constraint of a placed row: the first of started, hard lock, frozen window, earliest
 * start, release, machine, calendar and free that explains why it starts no earlier (plan 18).
 */
function bindingOf(
  order: PlanOrder,
  operation: PlanOperation,
  row: PlanJobOrder,
  release: Release | undefined,
  context: PlanContext,
): BindingConstraint {
  const placement = row.placement;
  if (placement === undefined) return { kind: 'free' };
  const windows = availabilityOn(context, row.equipment);
  const s = placement.setupStartMs;
  if (row.status !== 'planned') return { kind: 'started' };
  if (operation.isLocked) return { kind: 'hardLock' };
  if (nextWorkingInstant(windows, context.fenceMs) === s) return { kind: 'frozenWindow' };
  const earliest = order.earliestStartMs;
  if (earliest != null && nextWorkingInstant(windows, earliest) === s) {
    return { kind: 'earliestStart' };
  }
  if (release !== undefined) {
    const bound = boundStart(row, context);
    const releaseStart = nextWorkingInstant(windows, release.atMs);
    if (bound === release.atMs || bound === releaseStart) {
      return releaseStart === release.atMs || bound === release.atMs
        ? { kind: 'release', boundBy: release.fromRow, boundByJobOrderId: release.fromJobOrderId }
        : { kind: 'calendar', boundBy: release.fromRow, boundByJobOrderId: release.fromJobOrderId };
    }
  }
  const step = context.snapStepMs ?? 0;
  if (row.equipment !== undefined) {
    for (const reservation of reservationsOn(context, row.equipment)) {
      if (reservation.row.id === row.id) continue;
      const endMs = reservation.span.endMs;
      if (
        endMs <= s &&
        (s === endMs || s - endMs <= step || nextWorkingInstant(windows, endMs) === s)
      ) {
        return {
          kind: 'machine',
          boundBy: reservation.row.displayNumber,
          boundByJobOrderId: reservation.row.id,
          equipment: row.equipment,
        };
      }
    }
  }
  return { kind: 'free' };
}

/**
 * The float of every placed row of an order: earliest start, wait, latest start and end, total and
 * free float, the binding constraint and whether the row is critical, with the order's slack. A row
 * whose predecessor is unplaced, or whose latest end cannot be laid within the horizon, has no
 * entry, and the result never guesses from partial data.
 */
export function floatOf(order: PlanOrder, context: PlanContext): FloatResult {
  const operations = operationsInSequence(order);
  const rows: Record<string, RowFloat> = {};
  const latestEnds = new Map<string, number>();
  const latestStarts = new Map<string, number>();
  const placed = order.jobOrders.filter((row) => row.placement !== undefined);
  const plannedStartMs =
    placed.length === 0
      ? undefined
      : Math.min(...placed.map((row) => row.placement?.setupStartMs ?? 0));
  const plannedEndMs =
    placed.length === 0 ? undefined : Math.max(...placed.map((row) => row.placement?.endMs ?? 0));
  const slackElapsedS = plannedEndMs === undefined ? 0 : (order.deadlineMs - plannedEndMs) / 1000;
  const late = slackElapsedS < 0;

  // The latest ends go backward through the operations once, from the successors' latest starts.
  for (let index = operations.length - 1; index >= 0; index -= 1) {
    const operation = operations[index];
    if (operation === undefined) continue;
    const successor = operations[index + 1];
    for (const row of rowsOfOperation(order, operation)) {
      if (row.placement === undefined) continue;
      const windows = availabilityOn(context, row.equipment);
      const latestEndMs = latestEndFrom(
        order,
        operation,
        row,
        successor,
        (next) => {
          const latestStart = latestStarts.get(next.id);
          const latestEnd = latestEnds.get(next.id);
          if (latestStart === undefined || latestEnd === undefined) return undefined;
          const nextWindows = availabilityOn(context, next.equipment);
          return {
            setupStartMs: latestStart,
            runStartMs: runStartFor(next, latestStart, nextWindows),
            endMs: latestEnd,
          };
        },
        context,
      );
      if (latestEndMs === undefined) continue;
      const latest = subtractWork(windows, latestEndMs, row.plannedSetupS + row.plannedRunS);
      if (latest === null) continue;
      latestEnds.set(row.id, latestEndMs);
      latestStarts.set(row.id, latest.startMs);
    }
  }

  for (let index = 0; index < operations.length; index += 1) {
    const operation = operations[index];
    if (operation === undefined) continue;
    const successor = operations[index + 1];
    const release = releaseOf(order, operation.id, context);
    for (const row of rowsOfOperation(order, operation)) {
      const placement = row.placement;
      const latestEndMs = latestEnds.get(row.id);
      const latestStartMs = latestStarts.get(row.id);
      if (placement === undefined || latestEndMs === undefined || latestStartMs === undefined) {
        continue;
      }
      if (index > 0 && release === undefined) continue;
      const windows = availabilityOn(context, row.equipment);
      const s = placement.setupStartMs;

      let earliestStartMs: number;
      if (row.status !== 'planned' && row.actualStartMs !== undefined) {
        earliestStartMs = row.actualStartMs;
      } else {
        let bound = context.fenceMs;
        if (order.earliestStartMs != null) bound = Math.max(bound, order.earliestStartMs);
        if (release !== undefined) {
          const runBound = nextWorkingInstant(windows, release.atMs) ?? release.atMs;
          const releaseBound = context.settings.retoolOverlapsLeadTime
            ? setupStartFor(row, runBound, windows)
            : release.atMs;
          bound = Math.max(bound, releaseBound);
        }
        earliestStartMs = nextWorkingInstant(windows, bound) ?? bound;
      }
      const waitWorkingS = workBetween(windows, earliestStartMs, s);
      const totalFloatWorkingS =
        s <= latestStartMs
          ? workBetween(windows, s, latestStartMs)
          : -workBetween(windows, latestStartMs, s);

      // The successor bound: the latest end that keeps every successor at its planned start.
      const successorBoundMs = latestEndFrom(
        order,
        operation,
        row,
        successor,
        (next) => next.placement,
        context,
      );
      // The machine bound: the next reservation on the machine after the row, or the horizon's end.
      let machineBoundMs = windows[windows.length - 1]?.toMs ?? placement.endMs;
      if (row.equipment !== undefined) {
        for (const reservation of reservationsOn(context, row.equipment)) {
          if (reservation.row.id === row.id || reservation.span.setupStartMs < placement.endMs) {
            continue;
          }
          machineBoundMs = Math.min(machineBoundMs, reservation.span.setupStartMs);
          break;
        }
      }
      const freeFloatWorkingS = Math.min(
        successorBoundMs === undefined
          ? Number.POSITIVE_INFINITY
          : Math.max(0, workBetween(windows, placement.endMs, successorBoundMs)),
        Math.max(0, workBetween(windows, placement.endMs, machineBoundMs)),
        Math.max(0, totalFloatWorkingS),
      );

      rows[row.id] = {
        earliestStartMs,
        waitWorkingS,
        latestStartMs,
        latestEndMs,
        totalFloatWorkingS,
        freeFloatWorkingS,
        binding: bindingOf(order, operation, row, release, context),
        critical: totalFloatWorkingS <= 0,
      };
    }
  }

  const lastRow = lastRowOf(order);
  const lateByWorking =
    late && lastRow?.equipment !== undefined && plannedEndMs !== undefined
      ? {
          seconds: workBetween(
            availabilityOn(context, lastRow.equipment),
            order.deadlineMs,
            plannedEndMs,
          ),
          equipment: lastRow.equipment,
        }
      : undefined;
  return {
    rows,
    late,
    slackElapsedS,
    ...(plannedStartMs !== undefined && { plannedStartMs }),
    ...(plannedEndMs !== undefined && { plannedEndMs }),
    ...(lateByWorking !== undefined && { lateByWorking }),
  };
}
