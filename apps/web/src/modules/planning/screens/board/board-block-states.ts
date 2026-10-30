// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDate, formatPlantDateTime, formatPlantTime } from '@northmes/contracts/format';
import type { GanttSnapshot } from '../../gantt-data.ts';
import { blockStates } from '../gantt/gantt-block-states.ts';
import type { JobOrderRow } from '../gantt/gantt-rows.ts';

/** A state of a board block besides its order color (plan 07, Block states; design D3, BO12). */
export interface BoardBlockState {
  readonly kind:
    | 'locked'
    | 'held'
    | 'draft'
    | 'started'
    | 'finished'
    | 'conflict'
    | 'late'
    | 'overdue';
  /** The words the block's accessible name carries. */
  readonly text: string;
}

/**
 * The states of a block on the board, each with its words, in the order the name reads them
 * (plan 07, Block states; design D3, BO12): hard-locked, held by another planner, in my draft,
 * started, finished (ADR 0089), the conflicts, late and overdue. The Gantt's states give the locked, draft, conflict
 * and late words, so a block reads the same on both pages. A planned row that is not hard-locked
 * and whose setup start lies before now is overdue; the words name the day when it is not today's. The fixture has no reported quantities, proposals or
 * material lines, so started names no progress and finish pending, proposed and material short
 * are left for the data that carries them.
 */
export function boardBlockStates(
  row: JobOrderRow,
  snapshot: GanttSnapshot,
  options: { readonly inDraft?: boolean } = {},
): BoardBlockState[] {
  const shared = blockStates(row, snapshot, options);
  const of = (kind: BoardBlockState['kind']) => shared.filter((state) => state.kind === kind);
  const { jobOrder } = row;
  const placement = jobOrder.placement;
  // A hard-locked row in the past is a conflict of its own, not overdue (plan 07, Row classification).
  const overdue =
    jobOrder.status === 'planned' &&
    !row.operation.isLocked &&
    placement !== undefined &&
    placement.setupStartMs < snapshot.nowMs;
  return [
    ...of('locked').map((state) => ({ kind: 'locked' as const, text: state.text })),
    ...(jobOrder.held === true
      ? [{ kind: 'held' as const, text: 'being edited by another planner' }]
      : []),
    ...of('draft').map((state) => ({ kind: 'draft' as const, text: state.text })),
    ...(jobOrder.status === 'started' ? [{ kind: 'started' as const, text: 'started' }] : []),
    // A finished job order is drawn muted with its cue (ADR 0089, Time before now).
    ...(jobOrder.status === 'finished' ? [{ kind: 'finished' as const, text: 'finished' }] : []),
    ...of('conflict').map((state) => ({ kind: 'conflict' as const, text: state.text })),
    ...of('late').map((state) => ({ kind: 'late' as const, text: state.text })),
    ...(overdue
      ? [
          {
            kind: 'overdue' as const,
            text: `overdue, planned ${
              formatPlantDate(placement.setupStartMs, snapshot.plant.timeZone) ===
              formatPlantDate(snapshot.nowMs, snapshot.plant.timeZone)
                ? formatPlantTime(placement.setupStartMs, snapshot.plant.timeZone)
                : formatPlantDateTime(placement.setupStartMs, snapshot.plant.timeZone)
            }, not started`,
          },
        ]
      : []),
  ];
}

/**
 * The one border marker a block draws (design D3, BO12): hard-locked, then held, then in my
 * draft; the icons of every state still show.
 */
export function borderMarkerOf(
  states: readonly BoardBlockState[],
): 'locked' | 'held' | 'draft' | undefined {
  for (const kind of ['locked', 'held', 'draft'] as const) {
    if (states.some((state) => state.kind === kind)) return kind;
  }
  return undefined;
}
