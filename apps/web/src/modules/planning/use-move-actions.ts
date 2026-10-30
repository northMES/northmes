// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { availabilityOn } from '@northmes/planning-domain';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { announce } from '../../ui/lib/announce.ts';
import type { GanttSnapshot, ZoomPreset } from './gantt-data.ts';
import { type GanttDraft, moveInDraft } from './gantt-draft.ts';
import { createMoveStore, type MoveStore } from './move-store.ts';
import type { GanttMoveActions } from './screens/gantt/gantt-context.ts';
import {
  type MoveState,
  moveContextOf,
  movedMessage,
  moveRefusalOf,
  previewOf,
  refusalMessage,
  stepBackStart,
  stepMessage,
} from './screens/gantt/gantt-move.ts';
import { zoomPresets } from './timeline/time-scale.ts';

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
 * progress and its preview through the domain's cascade over the plan with the draft applied, in a
 * store outside React state (ADR 0030; #898), the debounced step messages of move mode, and the
 * actions a block calls. The actions stay the same object during a move, so a pointer move does
 * not render the screen that holds them again; the parts that draw the move read the store with
 * useMoveOf (the Gantt's preview layer; the board still reads the preview in its screen). A commit
 * writes the move into the draft and announces it, a refusal says why, and focus returns to the
 * block by id.
 */
export function useMoveActions({
  committed,
  snapshot,
  draft,
  setDraft,
  cascadeOn,
  zoom,
  timeZone,
  focusBlock: focus,
  machineSteps: steps = (allowed) => allowed,
}: MoveActionsInput): {
  readonly actions: GanttMoveActions | undefined;
  readonly store: MoveStore;
} {
  // The preview over the latest plan, which the store calls outside render.
  const previewFor = useRef<(state: MoveState) => ReturnType<typeof previewOf>>(() => undefined);
  const [store] = useState(() => createMoveStore((state) => previewFor.current(state)));
  // Whether a move is in progress now: a commit or a cancel ends it at once, so an event that
  // arrives before the next render, such as the blur when the moved block leaves its row in a
  // browser, cannot end the same move a second time.
  const active = useRef(false);
  const focusBlock = useRef(focus);
  const machineSteps = useRef(steps);
  // The latest callbacks and plan, for the actions and the step message to read after the render
  // that made them.
  const latestSnapshot = useRef(snapshot);
  useLayoutEffect(() => {
    focusBlock.current = focus;
    machineSteps.current = steps;
    latestSnapshot.current = snapshot;
  });
  // A new plan or cascade switch during a move previews it again over that plan.
  useLayoutEffect(() => {
    previewFor.current = (state) =>
      snapshot === undefined ? undefined : previewOf(snapshot, state, cascadeOn);
    store.refresh();
  }, [store, snapshot, cascadeOn]);
  // The step message of keyboard move mode, debounced to about 300 ms (plan 07, Moving without
  // dragging); the end of the move drops a message still waiting. It reads the plan through a ref,
  // so a new plan within the 300 ms keeps the subscription and its message.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = store.subscribe(() => {
      clearTimeout(timer);
      const move = store.get();
      if (move?.state.source !== 'keyboard' || move.preview === undefined) return;
      const { preview } = move;
      const machine =
        latestSnapshot.current?.equipment.find((each) => each.code === preview.equipment)?.name ??
        preview.equipment;
      timer = setTimeout(() => announce(stepMessage(preview, machine, timeZone)), 300);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [store, timeZone]);
  // A screen that goes away mid-move leaves no frame pending.
  useEffect(() => () => store.set(undefined), [store]);
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
      store,
      begin: (jobOrderId, source) => {
        const { row } = rowOf(jobOrderId);
        if (row?.placement === undefined || row.equipment === undefined) return false;
        const refused = moveRefusalOf(snapshot, jobOrderId);
        if (refused !== undefined) {
          announce(refusalMessage(row.displayNumber, refused));
          return false;
        }
        active.current = true;
        store.set({
          jobOrderId,
          setupStartMs: row.placement.setupStartMs,
          equipment: row.equipment,
          source,
        });
        return true;
      },
      // A pointer move: the store previews the latest position once per animation frame.
      previewAt: (setupStartMs, equipment) =>
        store.later((current) => ({
          ...current,
          setupStartMs,
          equipment: equipment ?? current.equipment,
        })),
      // A step moves one snap step from the snapped preview. Backwards, the forward snap of the
      // calendar would land a step in closed time on the same instant again, so the step jumps to
      // the last step before the closed time (plan 18, Snapping and the calendar).
      stepTime: (direction) => {
        const move = store.get();
        if (move === undefined) return;
        const { state } = move;
        const stepMs = zoomPresets[zoom].stepMs;
        const from = move.preview?.span.setupStartMs ?? state.setupStartMs;
        if (direction > 0) {
          store.set({ ...state, setupStartMs: from + stepMs });
          return;
        }
        const windows = availabilityOn(moveContextOf(snapshot), state.equipment);
        const setupStartMs = stepBackStart(windows, from, stepMs);
        const next = previewOf(snapshot, { ...state, setupStartMs }, cascadeOn);
        // The row cannot start before its release or its last-piece bound: it stays.
        if (
          next !== undefined &&
          next.span.setupStartMs >= from &&
          (next.reason === 'snappedToRelease' || next.reason === 'snappedToLastPiece')
        ) {
          return;
        }
        store.set({ ...state, setupStartMs });
      },
      stepMachine: (direction) => {
        const state = store.get()?.state;
        if (state === undefined) return;
        const { operation } = rowOf(state.jobOrderId);
        const allowed = machineSteps.current(operation?.allowedEquipment ?? []);
        const index = allowed.indexOf(state.equipment);
        const next = allowed[Math.max(0, Math.min(allowed.length - 1, index + direction))];
        if (next !== undefined) store.set({ ...state, equipment: next });
      },
      commit: () => {
        // The drop commits where the pointer let go, also before its frame has run.
        store.flush();
        const move = store.get();
        if (!active.current || move?.preview === undefined) return;
        const { state, preview } = move;
        active.current = false;
        const { draft: next, result } = moveInDraft(
          committed,
          draft,
          {
            jobOrderId: state.jobOrderId,
            setupStartMs: state.setupStartMs,
            equipment: state.equipment,
          },
          { cascade: cascadeOn },
        );
        store.set(undefined);
        if (result.refused !== undefined) {
          announce(refusalMessage(preview.displayNumber, result.refused));
          return;
        }
        setDraft(next);
        announce(movedMessage(preview, machineOf(preview.equipment), timeZone));
        // Focus returns to the block by id once it has drawn at its new place (plan 18).
        requestAnimationFrame(() => focusBlock.current(state.jobOrderId));
      },
      cancel: (options) => {
        const state = store.get()?.state;
        if (!active.current || state === undefined) return;
        active.current = false;
        store.set(undefined);
        if (options?.announce !== false) announce('Move cancelled.');
        if (options?.refocus !== false) {
          requestAnimationFrame(() => focusBlock.current(state.jobOrderId));
        }
      },
    };
  }, [store, snapshot, committed, draft, setDraft, cascadeOn, zoom, timeZone]);
  return { actions, store };
}
