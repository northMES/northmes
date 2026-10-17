// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The constraint list of a job order row (plan 18, The constraint list of a row): every constraint
// kind that applies, in the order of the constraint table, each with its value and whether it
// holds. The detail panel, the hover card's summary and the MCP tool that explains a row share it;
// each renders the lines as text with its own formatter.
import { workBetween } from './calendar/windows.ts';
import { lastRowOf } from './float.ts';
import {
  availabilityOn,
  type PlanContext,
  type PlanJobOrder,
  type PlanOperation,
  type PlanOrder,
  reservationsOn,
  rowsOfOperation,
} from './plan-context.ts';
import { lastPieceMinEnd, predecessorOf, releaseOf } from './release.ts';

/** The latest-ending placed row, by end, then the tie order. */
function latestEndingOf(rows: readonly PlanJobOrder[]): PlanJobOrder | undefined {
  let latest: PlanJobOrder | undefined;
  for (const row of rows) {
    if (row.placement === undefined) continue;
    if (latest?.placement === undefined || row.placement.endMs > latest.placement.endMs)
      latest = row;
  }
  return latest;
}

export type ConstraintKind =
  | 'deadline'
  | 'earliestStart'
  | 'release'
  | 'lastPiece'
  | 'hardLock'
  | 'started'
  | 'frozenWindow'
  | 'held'
  | 'allowedMachines'
  | 'oneJobAtATime'
  | 'calendar'
  | 'notPlannable';

/** The conflict code a broken line carries (plan 07, Conflicts; plan 18, The constraint kinds). */
export type ConstraintCode =
  | 'EARLIEST_START'
  | 'LEAD_TIME'
  | 'SEND_AHEAD'
  | 'LAST_PIECE'
  | 'MACHINE_NOT_ALLOWED'
  | 'OVERLAP'
  | 'CLOSED_TIME';

interface Line<Kind extends ConstraintKind> {
  readonly kind: Kind;
  readonly holds: boolean;
  /** The conflict code of a broken line. */
  readonly code?: ConstraintCode;
  /** The other rows or orders a broken line involves, by display number or order number. */
  readonly involves?: readonly string[];
}

export type ConstraintLine =
  | (Line<'deadline'> & { readonly atMs: number; readonly slackElapsedS: number })
  | (Line<'earliestStart'> & { readonly atMs: number })
  | (Line<'release'> & {
      readonly fromRow: string;
      /** The same row by job order id: the rows of a split operation share a display number. */
      readonly fromJobOrderId: string;
      readonly pointMs: number;
      readonly atMs: number;
      readonly leadTimeS: number;
      readonly sendAheadQuantity: number;
      /** When broken, the seconds the row starts before its release. */
      readonly beforeByS?: number;
    })
  | (Line<'lastPiece'> & {
      /** The latest-ending predecessor row, whose end the bound starts from (plan 07 rule 4). */
      readonly fromRow: string;
      readonly fromJobOrderId: string;
      readonly atMs: number;
    })
  | Line<'hardLock'>
  | (Line<'started'> & { readonly actualStartMs?: number })
  | (Line<'frozenWindow'> & { readonly atMs: number })
  | Line<'held'>
  | (Line<'allowedMachines'> & { readonly equipment: readonly string[] })
  | (Line<'oneJobAtATime'> & {
      readonly equipment: string;
      readonly overlaps?: string;
      readonly next?: { readonly row: string; readonly setupStartMs: number };
    })
  | (Line<'calendar'> & { readonly calendar?: string; readonly closedS?: number })
  | (Line<'notPlannable'> & { readonly equipment: string });

/**
 * The constraint list of a row over the loaded plan (the draft overlay included when the context
 * carries it). Lines in the order of the constraint table of plan 18; a kind that does not apply to
 * the row is left out.
 */
export function constraintsOf(
  order: PlanOrder,
  row: PlanJobOrder,
  context: PlanContext,
): ConstraintLine[] {
  const operation: PlanOperation | undefined = order.operations.find(
    (each) => each.id === row.operationId,
  );
  const span = row.placement;
  const windows = availabilityOn(context, row.equipment);
  const machine = row.equipment === undefined ? undefined : context.equipment?.[row.equipment];
  const lines: ConstraintLine[] = [];

  const last = lastRowOf(order);
  const plannedEndMs = last?.placement?.endMs;
  const slackElapsedS = plannedEndMs === undefined ? 0 : (order.deadlineMs - plannedEndMs) / 1000;
  // A late order is a warning, never a conflict (plan 07, Conflicts), so the line carries no code.
  lines.push(
    slackElapsedS < 0
      ? {
          kind: 'deadline',
          holds: false,
          involves: [order.number],
          atMs: order.deadlineMs,
          slackElapsedS,
        }
      : { kind: 'deadline', holds: true, atMs: order.deadlineMs, slackElapsedS },
  );

  if (context.settings.earliestStartEnabled === true && order.earliestStartMs != null) {
    const holds = span === undefined || span.setupStartMs >= order.earliestStartMs;
    lines.push(
      holds
        ? { kind: 'earliestStart', holds: true, atMs: order.earliestStartMs }
        : {
            kind: 'earliestStart',
            holds: false,
            code: 'EARLIEST_START',
            involves: [order.number],
            atMs: order.earliestStartMs,
          },
    );
  }

  const release = operation === undefined ? undefined : releaseOf(order, operation.id, context);
  if (release !== undefined && operation !== undefined) {
    const pair = predecessorOf(order, operation.id);
    const sendAheadQuantity = pair?.predecessor.sendAheadQuantity ?? 0;
    const start =
      span === undefined
        ? undefined
        : context.settings.retoolOverlapsLeadTime
          ? span.runStartMs
          : span.setupStartMs;
    const base = {
      fromRow: release.fromRow,
      fromJobOrderId: release.fromJobOrderId,
      pointMs: release.pointMs,
      atMs: release.atMs,
      leadTimeS: operation.leadTimeS,
      sendAheadQuantity,
    };
    lines.push(
      start === undefined || start >= release.atMs
        ? { kind: 'release', holds: true, ...base }
        : {
            kind: 'release',
            holds: false,
            code: sendAheadQuantity > 0 ? 'SEND_AHEAD' : 'LEAD_TIME',
            involves: [release.fromRow],
            ...base,
            beforeByS: (release.atMs - start) / 1000,
          },
    );
    // The last-piece bound starts from the predecessor's latest end, which with a send-ahead
    // quantity is not the row that sets the release.
    const minEndMs = lastPieceMinEnd(order, row, context);
    const latest =
      pair === undefined ? undefined : latestEndingOf(rowsOfOperation(order, pair.predecessor));
    if (minEndMs !== undefined && latest !== undefined) {
      const holds = span === undefined || span.endMs >= minEndMs;
      const from = { fromRow: latest.displayNumber, fromJobOrderId: latest.id, atMs: minEndMs };
      lines.push(
        holds
          ? { kind: 'lastPiece', holds: true, ...from }
          : {
              kind: 'lastPiece',
              holds: false,
              code: 'LAST_PIECE',
              involves: [latest.displayNumber],
              ...from,
            },
      );
    }
  }

  if (operation?.isLocked === true) lines.push({ kind: 'hardLock', holds: true });
  if (row.status !== 'planned') {
    lines.push({
      kind: 'started',
      holds: true,
      ...(row.actualStartMs !== undefined && { actualStartMs: row.actualStartMs }),
    });
  }
  if (
    span !== undefined &&
    span.setupStartMs >= context.nowMs &&
    span.setupStartMs < context.fenceMs
  ) {
    lines.push({ kind: 'frozenWindow', holds: true, atMs: context.fenceMs });
  }
  if (row.held === true) lines.push({ kind: 'held', holds: true });

  if (operation !== undefined) {
    const allowed =
      row.equipment === undefined || operation.allowedEquipment.includes(row.equipment);
    lines.push(
      allowed
        ? { kind: 'allowedMachines', holds: true, equipment: operation.allowedEquipment }
        : {
            kind: 'allowedMachines',
            holds: false,
            code: 'MACHINE_NOT_ALLOWED',
            involves: [],
            equipment: operation.allowedEquipment,
          },
    );
  }

  if (row.equipment !== undefined && span !== undefined) {
    const reservations = reservationsOn(context, row.equipment);
    const overlap = reservations.find(
      (each) =>
        each.row.id !== row.id &&
        each.span.setupStartMs < span.endMs &&
        each.span.endMs > span.setupStartMs,
    );
    if (overlap !== undefined) {
      lines.push({
        kind: 'oneJobAtATime',
        holds: false,
        code: 'OVERLAP',
        involves: [overlap.row.displayNumber],
        equipment: row.equipment,
        overlaps: overlap.row.displayNumber,
      });
    } else {
      const next = reservations.find(
        (each) => each.row.id !== row.id && each.span.setupStartMs >= span.endMs,
      );
      lines.push({
        kind: 'oneJobAtATime',
        holds: true,
        equipment: row.equipment,
        ...(next !== undefined && {
          next: { row: next.row.displayNumber, setupStartMs: next.span.setupStartMs },
        }),
      });
    }
    const closedS =
      row.plannedSetupS + row.plannedRunS - workBetween(windows, span.setupStartMs, span.endMs);
    const calendar = machine?.calendar;
    lines.push(
      closedS > 0
        ? {
            kind: 'calendar',
            holds: false,
            code: 'CLOSED_TIME',
            involves: [],
            ...(calendar !== undefined && { calendar }),
            closedS,
          }
        : { kind: 'calendar', holds: true, ...(calendar !== undefined && { calendar }) },
    );
  }

  if (row.equipment !== undefined && machine?.isPlannable === false) {
    lines.push({ kind: 'notPlannable', holds: true, equipment: row.equipment });
  }
  return lines;
}
