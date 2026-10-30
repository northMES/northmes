// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { createMoveStore } from '../../../src/modules/planning/move-store.ts';
import {
  type MoveState,
  moveContextOf,
  stepBackStart,
} from '../../../src/modules/planning/screens/gantt/gantt-move.ts';

/** A frame scheduler the test runs by hand, in place of requestAnimationFrame. */
function manualFrames() {
  let callbacks: (() => void)[] = [];
  return {
    request: (callback: () => void) => {
      callbacks.push(callback);
      return callbacks.length;
    },
    cancel: () => {
      callbacks = [];
    },
    run: () => {
      const due = callbacks;
      callbacks = [];
      for (const callback of due) callback();
    },
    pending: () => callbacks.length,
  };
}

const start: MoveState = {
  jobOrderId: 'jo-1',
  setupStartMs: 0,
  equipment: 'CNC1',
  source: 'pointer',
};

/** A store whose preview is a stub that counts how often it ran. */
function storeWithCount() {
  const frames = manualFrames();
  let computed = 0;
  const store = createMoveStore(
    (state) => {
      computed += 1;
      return { jobOrderId: state.jobOrderId, span: { setupStartMs: state.setupStartMs } } as never;
    },
    { request: frames.request, cancel: frames.cancel },
  );
  return { store, frames, computed: () => computed };
}

describe('the move store (ADR 0030, the drag preview outside React state; #898)', () => {
  it('runs the preview once per animation frame for the latest pointer position', () => {
    const { store, frames, computed } = storeWithCount();
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });
    store.set(start);
    const afterBegin = { computed: computed(), notified };

    store.later((current) => ({ ...current, setupStartMs: 1 }));
    store.later((current) => ({ ...current, setupStartMs: 2 }));
    store.later((current) => ({ ...current, setupStartMs: 3 }));
    expect(store.get()?.state.setupStartMs).toBe(0);
    expect(frames.pending()).toBe(1);
    frames.run();

    expect(computed() - afterBegin.computed).toBe(1);
    expect(notified - afterBegin.notified).toBe(1);
    expect(store.get()?.state.setupStartMs).toBe(3);
    expect(store.get()?.preview?.span.setupStartMs).toBe(3);
  });

  it('a pointer move that stays on the same snapped instant runs no preview and notifies nobody', () => {
    const { store, frames, computed } = storeWithCount();
    store.set(start);
    const before = { computed: computed(), snapshot: store.get() };
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });

    store.later((current) => ({ ...current, setupStartMs: 0 }));
    frames.run();

    expect(computed()).toBe(before.computed);
    expect(notified).toBe(0);
    expect(store.get()).toBe(before.snapshot);
  });

  it('flush applies the pending position at once, so a drop commits where the pointer let go', () => {
    const { store, frames } = storeWithCount();
    store.set(start);
    store.later((current) => ({ ...current, setupStartMs: 5 }));

    store.flush();

    expect(store.get()?.state.setupStartMs).toBe(5);
    expect(frames.pending()).toBe(0);
  });

  it('ending the move drops a pending position', () => {
    const { store, frames } = storeWithCount();
    store.set(start);
    store.later((current) => ({ ...current, setupStartMs: 5 }));

    store.set(undefined);
    frames.run();

    expect(store.get()).toBeUndefined();
  });

  it('the pointer moves of one frame all apply, so a machine one of them names is kept', () => {
    const { store, frames } = storeWithCount();
    store.set(start);

    store.later((current) => ({ ...current, setupStartMs: 1, equipment: 'CNC2' }));
    store.later((current) => ({ ...current, setupStartMs: 2 }));
    frames.run();

    expect(store.get()?.state).toMatchObject({ setupStartMs: 2, equipment: 'CNC2' });
  });

  it('a move of another row drops the position still pending from the last one', () => {
    const { store, frames } = storeWithCount();
    store.set(start);
    store.later((current) => ({ ...current, setupStartMs: 5 }));

    store.set({ ...start, jobOrderId: 'jo-2', source: 'keyboard' });
    frames.run();

    expect(store.get()?.state.setupStartMs).toBe(0);
  });

  it('refresh runs the preview again for the same position', () => {
    const { store, computed } = storeWithCount();
    store.set(start);
    const before = computed();

    store.refresh();

    expect(computed()).toBe(before + 1);
    expect(store.get()?.state).toBe(start);
  });
});

describe('the plan context of a move (#898)', () => {
  it('is the same object for the same plan with the draft applied, and a new one for a new plan', () => {
    const snapshot = g1Snapshot();

    expect(moveContextOf(snapshot)).toBe(moveContextOf(snapshot));
    expect(moveContextOf(g1Snapshot())).not.toBe(moveContextOf(snapshot));
  });
});

describe('a step back in keyboard move mode (plan 18, Snapping and the calendar; #898)', () => {
  const hour = 3_600_000;
  const quarter = 15 * 60_000;
  // Working Mon 06:00 to 22:00 and Tue 06:00 to 22:00, as instants from Mon 00:00.
  const windows = [
    { fromMs: 6 * hour, toMs: 22 * hour },
    { fromMs: 30 * hour, toMs: 46 * hour },
  ];

  it('inside working time steps one snap step back', () => {
    expect(stepBackStart(windows, 10 * hour, quarter)).toBe(10 * hour - quarter);
  });

  it('from the start of a shift jumps over the closed time to the last step before it closed', () => {
    // From Tue 06:00 a quarter back is Mon 05:45 in closed time, which snaps forward to Tue 06:00:
    // the step lands at Mon 21:45 instead, on the grid of the start it came from.
    expect(stepBackStart(windows, 30 * hour, quarter)).toBe(22 * hour - quarter);
  });

  it('keeps the grid of the start it came from when the shift does not end on it', () => {
    expect(stepBackStart(windows, 30 * hour + 10 * 60_000, hour)).toBe(21 * hour + 10 * 60_000);
  });

  it('before the first working window steps one snap step back', () => {
    expect(stepBackStart(windows, 6 * hour, quarter)).toBe(6 * hour - quarter);
  });
});
