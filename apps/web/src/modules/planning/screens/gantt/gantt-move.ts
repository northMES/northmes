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
  type MoveRefusal,
} from '@northmes/planning-domain';
import { orderOfRow, planContextOf } from '../../gantt-analysis.ts';
import type { GanttSnapshot } from '../../gantt-data.ts';

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
  /** The release the drop snapped forward to, when it did. */
  readonly snappedTo?: { readonly fromRow: string; readonly atMs: number };
  readonly conflicts: readonly Conflict[];
  readonly refused?: MoveRefusal;
}

/** Why a row cannot enter a move (plan 07, judgeMove): its lock, its status or another planner's lock. */
export function moveRefusalOf(
  snapshot: GanttSnapshot,
  jobOrderId: string,
): MoveRefusal | undefined {
  const order = orderOfRow(snapshot.productionOrders, jobOrderId);
  const row = order?.jobOrders.find((each) => each.id === jobOrderId);
  const operation = order?.operations.find((each) => each.id === row?.operationId);
  if (row === undefined) return undefined;
  if (operation?.isLocked) return 'PINNED';
  if (row.status !== 'planned') return 'STARTED';
  if (row.held) return 'LOCKED';
  return undefined;
}

/** "Cannot move 1002.10: locked." */
export function refusalMessage(displayNumber: string, refused: MoveRefusal): string {
  const why =
    refused === 'PINNED' ? 'locked' : refused === 'STARTED' ? 'started' : 'held by another planner';
  return `Cannot move ${displayNumber}: ${why}.`;
}

/** The preview of a move over the plan with the draft applied, through the cascade. */
export function previewOf(
  applied: GanttSnapshot,
  move: MoveState,
  cascadeOn: boolean,
): MovePreview | undefined {
  const order = orderOfRow(applied.productionOrders, move.jobOrderId);
  if (order === undefined) return undefined;
  const context = planContextOf(applied, { fromMs: applied.nowMs, toMs: applied.fenceMs });
  const result = cascade(
    order,
    { jobOrderId: move.jobOrderId, setupStartMs: move.setupStartMs, equipment: move.equipment },
    context,
    { cascade: cascadeOn },
  );
  const [moved, ...rest] = result.moves;
  if (moved === undefined) {
    const row = order.jobOrders.find((each) => each.id === move.jobOrderId);
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
    conflicts: result.conflicts,
  };
}

/** "1 row moves with it", "2 rows move with it"; empty for none. */
function rowsSentence(count: number): string {
  if (count === 0) return '';
  return count === 1 ? '1 row moves with it.' : `${count} rows move with it.`;
}

/** The drag tooltip: the span, the release snap and the cascade count (plan 18, Cascade rule 8). */
export function tooltipText(preview: MovePreview, timeZone: string): string {
  const parts = [formatSpan(preview.span.setupStartMs, preview.span.endMs, timeZone)];
  if (preview.snappedTo !== undefined)
    parts.push(`snapped to release from ${preview.snappedTo.fromRow}`);
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
