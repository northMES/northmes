// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// A move in progress on the order Gantt (plan 18, Moves on the order Gantt): by pointer or in
// keyboard move mode, previewed through the domain's cascade over the plan with the draft applied,
// so the preview shows the span the drop writes and the ghost spans of the rows that move with it.
import { formatSpan } from '@northmes/contracts/format';
import {
  type Conflict,
  cascade,
  type JobOrderSpan,
  type MoveReason,
  type MoveRefusal,
  nextWorkingInstant,
  type PlanContext,
  type Windows,
} from '@northmes/planning-domain';
import { orderOfRow, planContextOf } from '../../gantt-analysis.ts';
import type { GanttSnapshot } from '../../gantt-data.ts';
import type { TimeScale } from '../../timeline/time-scale.ts';

/**
 * Why a move cannot be written: the refusals of the domain, and `PAST` for a setup start before
 * now (ADR 0089, Time before now). `PAST` refuses the move itself and does not join judgeMove, so
 * Save lists a start that passed in the draft as a conflict instead.
 */
export type GanttMoveRefusal = MoveRefusal | 'PAST';

export interface MoveState {
  readonly jobOrderId: string;
  /** The setup start the row is held at, before the calendar and release snaps. */
  readonly setupStartMs: number;
  readonly equipment: string;
  readonly source: 'pointer' | 'keyboard';
}

/** What the move would write: the moved row's span and the rows the cascade carries with it. */
export interface MovePreview {
  readonly jobOrderId: string;
  readonly displayNumber: string;
  readonly equipment: string;
  readonly span: JobOrderSpan;
  /** The ghost spans of the successor rows that would move, by job order id. */
  readonly ghosts: ReadonlyMap<string, JobOrderSpan>;
  readonly count: number;
  /** The release, or the last-piece bound, the drop snapped forward to, when it did. */
  readonly snappedTo?: {
    readonly fromRow: string;
    readonly atMs: number;
    readonly minEndMs?: number;
  };
  readonly reason?: MoveReason;
  readonly conflicts: readonly Conflict[];
  readonly refused?: GanttMoveRefusal;
}

/** A job order of the plan and its operation, by the job order's id. */
function rowAndOperationOf(snapshot: GanttSnapshot, jobOrderId: string) {
  const order = orderOfRow(snapshot.productionOrders, jobOrderId);
  const row = order?.jobOrders.find((each) => each.id === jobOrderId);
  const operation = order?.operations.find((each) => each.id === row?.operationId);
  return { row, operation };
}

/** Why a row cannot enter a move (plan 07, judgeMove): its lock, its status or another planner's lock. */
export function moveRefusalOf(
  snapshot: GanttSnapshot,
  jobOrderId: string,
): MoveRefusal | undefined {
  const { row, operation } = rowAndOperationOf(snapshot, jobOrderId);
  if (row === undefined) return undefined;
  if (operation?.isLocked) return 'PINNED';
  if (row.status !== 'planned') return 'STARTED';
  if (row.held) return 'LOCKED';
  return undefined;
}

/** The machines a job order in a move may not go to, and the operation that rules them out. */
export interface NotAllowed {
  /** The operation's name, which the greyed rows name: "not allowed for Turn". */
  readonly operation: string;
  /** The equipment codes outside the operation's allowed machines. */
  readonly machines: ReadonlySet<string>;
}

/**
 * The machines of the plan that a job order's operation does not allow (#944): every timeline
 * greys them out while the job order moves. The machine the job order is on keeps its look, also
 * when its operation no longer allows it. Undefined without a move or an operation.
 */
export function notAllowedOf(
  snapshot: GanttSnapshot | undefined,
  jobOrderId: string | undefined,
): NotAllowed | undefined {
  if (snapshot === undefined || jobOrderId === undefined) return undefined;
  const { row, operation } = rowAndOperationOf(snapshot, jobOrderId);
  if (operation === undefined) return undefined;
  const allowed = new Set(operation.allowedEquipment);
  const machines = snapshot.equipment
    .map((machine) => machine.code)
    .filter((code) => !allowed.has(code) && code !== row?.equipment);
  return { operation: operation.name, machines: new Set(machines) };
}

/** "Cannot move 1002.10: locked." */
export function refusalMessage(displayNumber: string, refused: GanttMoveRefusal): string {
  const why = {
    PINNED: 'locked',
    STARTED: 'started',
    LOCKED: 'held by another planner',
    NOT_ALLOWED: 'the machine is not allowed for its operation',
    PAST: 'it would start before now',
  }[refused];
  return `Cannot move ${displayNumber}: ${why}.`;
}

const moveContexts = new WeakMap<GanttSnapshot, PlanContext>();

/**
 * The plan context a move's cascade runs over, built once per plan with the draft applied: a new
 * draft revision is a new snapshot, so a pointer move during a drag runs the cascade only (#898).
 */
export function moveContextOf(applied: GanttSnapshot): PlanContext {
  let context = moveContexts.get(applied);
  if (context === undefined) {
    context = planContextOf(applied, { fromMs: applied.nowMs, toMs: applied.fenceMs });
    moveContexts.set(applied, context);
  }
  return context;
}

/**
 * The setup start a step later asks for (ADR 0089): one snap step on, or from a start before now
 * the first step on the same grid at or after now, so an overdue row reaches now in one step.
 */
export function stepLaterStart(fromMs: number, stepMs: number, nowMs: number): number {
  return fromMs + Math.max(1, Math.ceil((nowMs - fromMs) / stepMs)) * stepMs;
}

/**
 * The setup start a step back in move mode asks for (plan 18, Snapping and the calendar): one snap
 * step back, or, where that lands in closed time the forward snap would undo, the last step on
 * the same grid before the previous working window closes.
 */
export function stepBackStart(windows: Windows, fromMs: number, stepMs: number): number {
  const back = fromMs - stepMs;
  if (nextWorkingInstant(windows, back) === back) return back;
  const before = windows.findLast((window) => window.toMs <= back);
  if (before === undefined) return back;
  return fromMs - (Math.floor((fromMs - before.toMs) / stepMs) + 1) * stepMs;
}

/**
 * The setup start a pointer at `rawMs` asks for (ADR 0089, Time before now): the scale's snap step,
 * and, when the pointer is at or after now but the step rounds back before it, the first snap
 * step at or after now. A pointer before now keeps its snap step: before now the preview refuses
 * it, and where the step rounds forward to now or later the row starts there, after now.
 */
export function pointerStart(
  scale: Pick<TimeScale, 'snap' | 'stepMs'>,
  rawMs: number,
  nowMs: number,
): number {
  // A fractional width gives a fractional instant, which Temporal refuses, so the snap takes the
  // whole millisecond.
  const atMs = Math.round(rawMs);
  let startMs = scale.snap(atMs);
  if (atMs < nowMs) return startMs;
  // One step forward reaches now; the guard of three covers a day step that a change of clocks
  // shortens, and stops the loop on a scale whose snap would not move forward.
  for (let count = 0; startMs < nowMs && count < 3; count += 1) {
    startMs = scale.snap(startMs + scale.stepMs);
  }
  return startMs;
}

/** Whether the move holds the row at its own start on its own machine, so it moves nothing. */
function heldInPlace(
  row: { readonly placement?: { readonly setupStartMs: number }; readonly equipment?: string },
  move: MoveState,
): boolean {
  return row.placement?.setupStartMs === move.setupStartMs && row.equipment === move.equipment;
}

/**
 * Whether a move ends on an overdue row where it started (ADR 0089): its start lies before now, and
 * it stayed at that start on its machine. It writes nothing; a draft change there would list a
 * PAST conflict for a row the planner did not move.
 */
export function staysOverdue(applied: GanttSnapshot, move: MoveState): boolean {
  if (move.setupStartMs >= applied.nowMs) return false;
  const row = orderOfRow(applied.productionOrders, move.jobOrderId)?.jobOrders.find(
    (each) => each.id === move.jobOrderId,
  );
  return row !== undefined && heldInPlace(row, move);
}

/** The preview of a move over the plan with the draft applied, through the cascade. */
export function previewOf(
  applied: GanttSnapshot,
  move: MoveState,
  cascadeOn: boolean,
): MovePreview | undefined {
  const order = orderOfRow(applied.productionOrders, move.jobOrderId);
  if (order === undefined) return undefined;
  const row = order.jobOrders.find((each) => each.id === move.jobOrderId);
  // A start before now is refused before the cascade runs; the outline stays where the pointer
  // asks, as long as the row, so the refusal shows over the past (ADR 0089). An overdue row held
  // at its own start on its own machine is not a move, so it may stay until it moves to now or
  // later.
  if (
    row?.placement !== undefined &&
    move.setupStartMs < applied.nowMs &&
    !heldInPlace(row, move)
  ) {
    const shift = move.setupStartMs - row.placement.setupStartMs;
    return {
      jobOrderId: row.id,
      displayNumber: row.displayNumber,
      equipment: move.equipment,
      span: {
        setupStartMs: move.setupStartMs,
        runStartMs: row.placement.runStartMs + shift,
        endMs: row.placement.endMs + shift,
      },
      ghosts: new Map(),
      count: 0,
      conflicts: [],
      refused: 'PAST',
    };
  }
  const context = moveContextOf(applied);
  const result = cascade(
    order,
    { jobOrderId: move.jobOrderId, setupStartMs: move.setupStartMs, equipment: move.equipment },
    context,
    { cascade: cascadeOn },
  );
  const [moved, ...rest] = result.moves;
  if (moved === undefined) {
    return row?.placement === undefined
      ? undefined
      : {
          jobOrderId: row.id,
          displayNumber: row.displayNumber,
          equipment: move.equipment,
          span: row.placement,
          ghosts: new Map(),
          count: 0,
          conflicts: result.conflicts,
          ...(result.refused !== undefined && { refused: result.refused }),
        };
  }
  return {
    jobOrderId: moved.jobOrderId,
    displayNumber: moved.displayNumber,
    equipment: moved.equipment,
    span: moved.to,
    ghosts: new Map(rest.map((each) => [each.jobOrderId, each.to])),
    count: rest.length,
    ...(moved.snappedTo !== undefined && { snappedTo: moved.snappedTo }),
    reason: moved.reason,
    conflicts: result.conflicts,
  };
}

/** "1 row moves with it", "2 rows move with it"; empty for none. */
function rowsSentence(count: number): string {
  if (count === 0) return '';
  return count === 1 ? '1 row moves with it.' : `${count} rows move with it.`;
}

/**
 * The drag tooltip: the span, the release snap and the cascade count (plan 18, Cascade rule 8), or
 * why the move is refused.
 */
export function tooltipText(preview: MovePreview, timeZone: string): string {
  if (preview.refused !== undefined) return refusalMessage(preview.displayNumber, preview.refused);
  const parts = [formatSpan(preview.span.setupStartMs, preview.span.endMs, timeZone)];
  if (preview.snappedTo !== undefined) {
    parts.push(
      preview.reason === 'snappedToLastPiece'
        ? `snapped to the last piece of ${preview.snappedTo.fromRow}`
        : `snapped to release from ${preview.snappedTo.fromRow}`,
    );
  }
  if (preview.count > 0)
    parts.push(
      `+${preview.count} row${preview.count === 1 ? '' : 's'} move${preview.count === 1 ? 's' : ''}`,
    );
  if (preview.conflicts.some((conflict) => conflict.kind === 'FROZEN_WINDOW')) {
    parts.push('starts in the frozen window');
  }
  return parts.join(', ');
}

/** The step message of move mode: "CNC 1, Wed 4 Nov 06:00 to Wed 4 Nov 12:15. 1 row moves with it. Not saved." */
export function stepMessage(preview: MovePreview, machine: string, timeZone: string): string {
  if (preview.refused !== undefined) return refusalMessage(preview.displayNumber, preview.refused);
  return [
    `${machine}, ${formatSpan(preview.span.setupStartMs, preview.span.endMs, timeZone)}.`,
    rowsSentence(preview.count),
    preview.conflicts.some((conflict) => conflict.kind === 'FROZEN_WINDOW')
      ? 'Starts in the frozen window.'
      : '',
    'Not saved.',
  ]
    .filter((part) => part !== '')
    .join(' ');
}

/** The message after a drop or Enter: "1003.10 moved to CNC 1, Wed 4 Nov 09:00 to Wed 4 Nov 13:30. 1 row moves with it. Not saved." */
export function movedMessage(preview: MovePreview, machine: string, timeZone: string): string {
  return [
    `${preview.displayNumber} moved to ${machine}, ${formatSpan(preview.span.setupStartMs, preview.span.endMs, timeZone)}.`,
    rowsSentence(preview.count),
    'Not saved.',
  ]
    .filter((part) => part !== '')
    .join(' ');
}
