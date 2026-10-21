// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useEffect, useMemo, useRef, useState } from 'react';
import { announce } from '../../ui/lib/announce.ts';
import type { GanttSnapshot, ZoomPreset } from './gantt-data.ts';
import { type GanttDraft, moveInDraft } from './gantt-draft.ts';
import type { GanttMoveActions } from './screens/gantt/gantt-context.ts';
import {
  type MovePreview,
  type MoveState,
  movedMessage,
  moveRefusalOf,
  previewOf,
  refusalMessage,
  stepMessage,
} from './screens/gantt/gantt-move.ts';
import { type TimeRange, zoomPresets } from './timeline/time-scale.ts';

export interface MoveActionsInput {
  /** The plan as the server committed it, which a move's cascade runs over with the draft. */
  readonly committed: GanttSnapshot | undefined;
  /** The plan with the draft applied, which the view draws and the preview reads. */
  readonly snapshot: GanttSnapshot | undefined;
  readonly draft: GanttDraft;
  readonly setDraft: (draft: GanttDraft) => void;
  /** Cascade after a move (plan 18, Cascade rule 1). */
  readonly cascadeOn: boolean;
  readonly zoom: ZoomPreset;
  readonly range: TimeRange;
  readonly timeZone: string;
  /** Moves focus to a job order's block by id, once it has drawn at its new place. */
  readonly focusBlock: (jobOrderId: string) => void;
  /**
   * The machines Up and Down step through, from an operation's allowed machines: the board skips
   * the machines of collapsed groups (plan 07, Moving without dragging). Their own order by default.
   */
  readonly machineSteps?: (allowed: readonly string[]) => readonly string[];
}

/**
 * A move of a job order by pointer or in keyboard move mode (plan 07, Moving without dragging;
 * plan 18, Moves on the order Gantt), which the board and the order Gantt share: the move in
 * progress, its preview through the domain's cascade over the plan with the draft applied, the
 * debounced step messages of move mode, and the actions a block calls. A commit writes the move
 * into the draft and announces it, a refusal says why, and focus returns to the block by id.
 */
export function useMoveActions({
  committed,
  snapshot,
  draft,
  setDraft,
  cascadeOn,
  zoom,
  range,
  timeZone,
  focusBlock: focus,
  machineSteps: steps = (allowed) => allowed,
}: MoveActionsInput): {
  readonly actions: GanttMoveActions | undefined;
  readonly state: MoveState | undefined;
  readonly preview: MovePreview | undefined;
} {
  const [moveState, setMoveState] = useState<MoveState | undefined>(undefined);
  const focusBlock = useRef(focus);
  focusBlock.current = focus;
  const machineSteps = useRef(steps);
  machineSteps.current = steps;
  const preview = useMemo(
    () =>
      snapshot === undefined || moveState === undefined
        ? undefined
        : previewOf(snapshot, moveState, cascadeOn),
    [snapshot, moveState, cascadeOn],
  );
  // The step message of keyboard move mode, debounced to about 300 ms (plan 07, Moving without dragging).
  useEffect(() => {
    if (moveState?.source !== 'keyboard' || preview === undefined || snapshot === undefined) return;
    const machine =
      snapshot.equipment.find((each) => each.code === preview.equipment)?.name ?? preview.equipment;
    const timer = setTimeout(() => announce(stepMessage(preview, machine, timeZone)), 300);
    return () => clearTimeout(timer);
  }, [moveState?.source, preview, snapshot, timeZone]);
  const actions = useMemo<GanttMoveActions | undefined>(() => {
    if (snapshot === undefined || committed === undefined) return undefined;
    const machineOf = (code: string | undefined) =>
      snapshot.equipment.find((each) => each.code === code)?.name ?? code ?? 'no machine';
    const rowOf = (jobOrderId: string) => {
      const order = snapshot.productionOrders.find((each) =>
        each.jobOrders.some((row) => row.id === jobOrderId),
      );
      const row = order?.jobOrders.find((each) => each.id === jobOrderId);
      const operation = order?.operations.find((each) => each.id === row?.operationId);
      return { order, row, operation };
    };
    return {
      state: moveState,
      preview,
      begin: (jobOrderId, source) => {
        const { row } = rowOf(jobOrderId);
        if (row?.placement === undefined || row.equipment === undefined) return false;
        const refused = moveRefusalOf(snapshot, jobOrderId);
        if (refused !== undefined) {
          announce(refusalMessage(row.displayNumber, refused));
          return false;
        }
        setMoveState({
          jobOrderId,
          setupStartMs: row.placement.setupStartMs,
          equipment: row.equipment,
          source,
        });
        return true;
      },
      previewAt: (setupStartMs, equipment) =>
        setMoveState((current) =>
          current === undefined
            ? current
            : { ...current, setupStartMs, equipment: equipment ?? current.equipment },
        ),
      // A step moves one snap step; the preview then snaps forward to working time on the machine.
      // A step moves one snap step from the snapped preview. Backwards, the forward snap of the
      // calendar can land on the same instant again, so the step keeps going back until the
      // preview is earlier, or the horizon ends (plan 18, Snapping and the calendar).
      stepTime: (direction) =>
        setMoveState((current) => {
          if (current === undefined) return current;
          const stepMs = zoomPresets[zoom].stepMs;
          const from = preview?.span.setupStartMs ?? current.setupStartMs;
          let setupStartMs = from + direction * stepMs;
          if (direction < 0) {
            const floor = range.fromMs - 28 * 86_400_000;
            for (let count = 0; count < 500 && setupStartMs > floor; count += 1) {
              const next = previewOf(snapshot, { ...current, setupStartMs }, cascadeOn);
              if (next === undefined || next.span.setupStartMs < from) break;
              // The row cannot start before its release or its last-piece bound: it stays.
              if (next.reason === 'snappedToRelease' || next.reason === 'snappedToLastPiece') {
                return current;
              }
              setupStartMs -= stepMs;
            }
          }
          return { ...current, setupStartMs };
        }),
      stepMachine: (direction) =>
        setMoveState((current) => {
          if (current === undefined) return current;
          const { operation } = rowOf(current.jobOrderId);
          const allowed = machineSteps.current(operation?.allowedEquipment ?? []);
          const index = allowed.indexOf(current.equipment);
          const next = allowed[Math.max(0, Math.min(allowed.length - 1, index + direction))];
          return next === undefined ? current : { ...current, equipment: next };
        }),
      commit: () => {
        if (moveState === undefined || preview === undefined) return;
        const { draft: next, result } = moveInDraft(
          committed,
          draft,
          {
            jobOrderId: moveState.jobOrderId,
            setupStartMs: moveState.setupStartMs,
            equipment: moveState.equipment,
          },
          { cascade: cascadeOn },
        );
        setMoveState(undefined);
        if (result.refused !== undefined) {
          announce(refusalMessage(preview.displayNumber, result.refused));
          return;
        }
        setDraft(next);
        announce(movedMessage(preview, machineOf(preview.equipment), timeZone));
        // Focus returns to the block by id once it has drawn at its new place (plan 18).
        requestAnimationFrame(() => focusBlock.current(moveState.jobOrderId));
      },
      cancel: () => {
        if (moveState === undefined) return;
        setMoveState(undefined);
        announce('Move cancelled.');
        requestAnimationFrame(() => focusBlock.current(moveState.jobOrderId));
      },
    };
  }, [snapshot, committed, moveState, preview, draft, setDraft, cascadeOn, zoom, timeZone, range]);
  return { actions, state: moveState, preview };
}
