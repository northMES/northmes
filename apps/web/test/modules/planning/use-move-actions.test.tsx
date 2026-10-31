// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { GanttSnapshot } from '../../../src/modules/planning/gantt-data.ts';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { emptyDraft, type GanttDraft } from '../../../src/modules/planning/gantt-draft.ts';
import { useMoveOf } from '../../../src/modules/planning/move-store.ts';
import { previewOf } from '../../../src/modules/planning/screens/gantt/gantt-move.ts';
import { useMoveActions } from '../../../src/modules/planning/use-move-actions.ts';
import { g1WithOverdueRow } from './past-fixtures.ts';

afterEach(cleanup);

const hour = 3_600_000;

/**
 * The move actions over G1, how often the screen that holds them rendered, and the drafts they
 * wrote; rerender with a new snapshot or cascade switch as a screen would.
 */
function renderMoveActions(committed: GanttSnapshot = g1Snapshot()) {
  let renders = 0;
  const drafts: GanttDraft[] = [];
  const hook = renderHook(
    ({ snapshot, cascadeOn }: { snapshot: GanttSnapshot; cascadeOn: boolean }) => {
      renders += 1;
      return useMoveActions({
        committed,
        snapshot,
        draft: emptyDraft,
        setDraft: (draft) => drafts.push(draft),
        cascadeOn,
        zoom: 'day',
        timeZone: committed.plant.timeZone,
        focusBlock: () => {},
      });
    },
    { initialProps: { snapshot: committed, cascadeOn: true } },
  );
  return { ...hook, renders: () => renders, drafts, committed };
}

/** The text of the polite live region that announce() speaks through. */
function announced(): string {
  return document.getElementById('announcer-polite')?.textContent ?? '';
}

describe('the move actions during a drag (ADR 0030; #898)', () => {
  it('a pointer move renders the screen that holds the actions no more, and keeps the actions', async () => {
    const { result, renders } = renderMoveActions();
    const actions = result.current.actions;
    // The position the pointer asked for, before the calendar and release snaps.
    const { result: position } = renderHook(() =>
      useMoveOf(result.current.store, (move) => move?.state.setupStartMs),
    );

    act(() => {
      actions?.begin('jo-1003-10', 'pointer');
    });
    const before = renders();
    const startMs = position.current ?? 0;
    for (const step of [1, 2, 3]) {
      act(() => {
        actions?.previewAt(startMs + step * hour);
      });
    }

    await waitFor(() => {
      expect(position.current).toBe(startMs + 3 * hour);
    });
    expect(renders()).toBe(before);
    expect(result.current.actions).toBe(actions);
  });

  it('a drop in the frame of the last pointer move commits that position', () => {
    const { result, drafts, committed } = renderMoveActions();

    act(() => {
      result.current.actions?.begin('jo-1003-10', 'pointer');
    });
    const equipment = result.current.store.get()?.state.equipment ?? '';
    const startMs = result.current.store.get()?.state.setupStartMs ?? 0;
    act(() => {
      result.current.actions?.previewAt(startMs + 3 * hour);
      result.current.actions?.commit();
    });

    const expected = previewOf(
      committed,
      { jobOrderId: 'jo-1003-10', setupStartMs: startMs + 3 * hour, equipment, source: 'pointer' },
      true,
    );
    const change = drafts.at(-1)?.changes.find((each) => each.jobOrderId === 'jo-1003-10');
    expect(change?.to.setupStartMs).toBe(expected?.span.setupStartMs);
    expect(change?.to.setupStartMs).not.toBe(startMs);
  });

  it('a new cascade switch during a move previews the move again', () => {
    const { result, rerender, committed } = renderMoveActions();
    act(() => {
      result.current.actions?.begin('jo-1003-10', 'pointer');
    });
    // GT3: 1003.10 at Wed 09:00 carries 1003.20 with it.
    act(() => {
      result.current.actions?.previewAt(Date.UTC(2026, 10, 4, 8));
      result.current.store.flush();
    });
    expect(result.current.store.get()?.preview?.count).toBe(1);

    rerender({ snapshot: committed, cascadeOn: false });

    expect(result.current.store.get()?.preview?.count).toBe(0);
  });

  it('a step in keyboard move mode is announced also when the plan changes before its message', async () => {
    const { result, rerender } = renderMoveActions();
    act(() => {
      result.current.actions?.begin('jo-1003-10', 'keyboard');
      result.current.actions?.stepTime(1);
    });

    rerender({ snapshot: g1Snapshot(), cascadeOn: true });

    await waitFor(() => {
      expect(announced()).toContain('Not saved.');
    });
  });
});

describe('a move before now (ADR 0089, Time before now)', () => {
  const minute = 60_000;

  it('ADR0089 a drop before now is refused with PAST, announced, and writes nothing to the draft', async () => {
    const { result, drafts, committed } = renderMoveActions();
    act(() => {
      result.current.actions?.begin('jo-1001-10', 'pointer');
    });

    act(() => {
      result.current.actions?.previewAt(committed.nowMs - hour);
      result.current.store.flush();
    });
    expect(result.current.store.get()?.preview?.refused).toBe('PAST');
    act(() => {
      result.current.actions?.commit();
    });

    expect(drafts).toEqual([]);
    expect(result.current.store.get()).toBeUndefined();
    await waitFor(() => {
      expect(announced()).toBe('Cannot move 1001.10: it would start before now.');
    });
  });

  it('ADR0089 a step earlier in move mode that would start before now is refused, and the row stays', async () => {
    const { result, committed } = renderMoveActions();
    act(() => {
      result.current.actions?.begin('jo-1001-10', 'keyboard');
    });
    const state = result.current.store.get()?.state;
    act(() => {
      if (state !== undefined) {
        result.current.store.set({ ...state, setupStartMs: committed.nowMs + 30 * minute });
      }
    });

    act(() => {
      result.current.actions?.stepTime(-1);
    });

    expect(result.current.store.get()?.state.setupStartMs).toBe(committed.nowMs + 30 * minute);
    expect(result.current.store.get()?.preview?.refused).toBeUndefined();
    await waitFor(() => {
      expect(announced()).toBe('Cannot move 1001.10: it would start before now.');
    });
  });

  it('ADR0089 a step later from an overdue row lands at now or later, never before it', () => {
    const { result, committed } = renderMoveActions(g1WithOverdueRow());
    act(() => {
      result.current.actions?.begin('jo-1001-10', 'keyboard');
    });
    expect(result.current.store.get()?.preview?.refused).toBeUndefined();

    act(() => {
      result.current.actions?.stepTime(1);
    });

    const move = result.current.store.get();
    expect(move?.state.setupStartMs).toBeGreaterThanOrEqual(committed.nowMs);
    expect(move?.state.setupStartMs).toBeLessThan(committed.nowMs + hour);
    expect(move?.preview?.refused).toBeUndefined();
  });

  it('ADR0089 Enter on an overdue row that did not move ends the move and writes nothing', async () => {
    const { result, drafts } = renderMoveActions(g1WithOverdueRow());
    act(() => {
      result.current.actions?.begin('jo-1001-10', 'keyboard');
    });

    act(() => {
      result.current.actions?.commit();
    });

    expect(drafts).toEqual([]);
    expect(result.current.store.get()).toBeUndefined();
    await waitFor(() => {
      expect(announced()).toBe('Move cancelled.');
    });
  });

  it("ADR0089 a step earlier back to an overdue row's own start is refused, and the later start stays", async () => {
    // 1001.10 overdue from Mon 09:00 with now at 09:40: the 1 h step at Day takes it to 10:00.
    const { result, committed } = renderMoveActions(g1WithOverdueRow('2026-11-02T08:00:00Z'));
    act(() => {
      result.current.actions?.begin('jo-1001-10', 'keyboard');
    });
    act(() => {
      result.current.actions?.stepTime(1);
    });
    const later = result.current.store.get()?.state.setupStartMs;
    expect(later).toBeGreaterThanOrEqual(committed.nowMs);

    act(() => {
      result.current.actions?.stepTime(-1);
    });

    expect(result.current.store.get()?.state.setupStartMs).toBe(later);
    await waitFor(() => {
      expect(announced()).toBe('Cannot move 1001.10: it would start before now.');
    });
  });
});
