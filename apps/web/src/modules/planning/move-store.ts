// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useMemo, useSyncExternalStore } from 'react';
import type { GanttSnapshot } from './gantt-data.ts';
import {
  type MovePreview,
  type MoveState,
  type NotAllowed,
  notAllowedOf,
} from './screens/gantt/gantt-move.ts';

/** The move in progress and its preview, as the store holds them. */
export interface MoveSnapshot {
  readonly state: MoveState;
  readonly preview: MovePreview | undefined;
}

/** The animation frame scheduler, which a test replaces. */
export interface FrameScheduler {
  readonly request: (callback: () => void) => number;
  readonly cancel: (handle: number) => void;
}

/**
 * The move in progress outside React state (ADR 0030; #898): a pointer move asks for a position
 * with later, the store applies the frame's positions and runs the preview once per animation
 * frame, and notifies its subscribers when the position changed or the preview ran again over a
 * new plan. Only the parts of the view that read the move subscribe, so the rows do not render
 * again until the drop.
 */
export interface MoveStore {
  readonly get: () => MoveSnapshot | undefined;
  readonly subscribe: (listener: () => void) => () => void;
  /** Sets the move at once, or ends it with undefined, which drops a pending position. */
  readonly set: (state: MoveState | undefined) => void;
  /** Asks for a position on the next animation frame, after the ones asked for in the same frame. */
  readonly later: (update: (current: MoveState) => MoveState) => void;
  /** Applies the pending position at once. */
  readonly flush: () => void;
  /** Runs the preview again for the same position, after the plan it reads changed. */
  readonly refresh: () => void;
}

const browserFrames: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

function samePosition(a: MoveState, b: MoveState): boolean {
  return (
    a.jobOrderId === b.jobOrderId &&
    a.setupStartMs === b.setupStartMs &&
    a.equipment === b.equipment &&
    a.source === b.source
  );
}

export function createMoveStore(
  previewOf: (state: MoveState) => MovePreview | undefined,
  frames: FrameScheduler = browserFrames,
): MoveStore {
  let snapshot: MoveSnapshot | undefined;
  let pending: ((current: MoveState) => MoveState) | undefined;
  let frame: number | undefined;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const drop = () => {
    pending = undefined;
    if (frame !== undefined) frames.cancel(frame);
    frame = undefined;
  };
  const set = (state: MoveState | undefined) => {
    if (state === undefined) {
      drop();
      if (snapshot === undefined) return;
      snapshot = undefined;
      notify();
      return;
    }
    if (snapshot !== undefined && samePosition(snapshot.state, state)) return;
    // A move of another row starts from its own position, not one still pending from the last.
    if (snapshot?.state.jobOrderId !== state.jobOrderId) drop();
    snapshot = { state, preview: previewOf(state) };
    notify();
  };
  const flush = () => {
    const update = pending;
    drop();
    if (update !== undefined && snapshot !== undefined) set(update(snapshot.state));
  };
  return {
    get: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set,
    later: (update) => {
      // The updates of one frame all apply in order: one may name a machine the next leaves out.
      const before = pending;
      pending = before === undefined ? update : (current) => update(before(current));
      frame ??= frames.request(() => {
        frame = undefined;
        flush();
      });
    },
    flush,
    refresh: () => {
      if (snapshot === undefined) return;
      snapshot = { state: snapshot.state, preview: previewOf(snapshot.state) };
      notify();
    },
  };
}

const noSubscription = () => () => {};

/**
 * A part of the move in progress, which renders its component again only when that part changes:
 * the selector returns a value the snapshot holds, or a primitive, so a pointer move that leaves
 * the part as it was renders nothing.
 */
export function useMoveOf<T>(
  store: MoveStore | undefined,
  select: (move: MoveSnapshot | undefined) => T,
): T {
  return useSyncExternalStore(store?.subscribe ?? noSubscription, () => select(store?.get()));
}

/**
 * The machines the job order in a move may not go to, which every timeline greys out until the
 * move ends (#944). It renders its component again only when a move starts or ends.
 */
export function useNotAllowed(
  store: MoveStore | undefined,
  snapshot: GanttSnapshot | undefined,
): NotAllowed | undefined {
  const movingId = useMoveOf(store, (move) => move?.state.jobOrderId);
  return useMemo(() => notAllowedOf(snapshot, movingId), [snapshot, movingId]);
}
