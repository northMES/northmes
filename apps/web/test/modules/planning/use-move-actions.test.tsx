// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { emptyDraft } from '../../../src/modules/planning/gantt-draft.ts';
import { useMoveOf } from '../../../src/modules/planning/move-store.ts';
import { useMoveActions } from '../../../src/modules/planning/use-move-actions.ts';

afterEach(cleanup);

const hour = 3_600_000;

/** The move actions over G1, and how often the screen that holds them rendered. */
function renderMoveActions() {
  const snapshot = g1Snapshot();
  let renders = 0;
  const hook = renderHook(() => {
    renders += 1;
    return useMoveActions({
      committed: snapshot,
      snapshot,
      draft: emptyDraft,
      setDraft: () => {},
      cascadeOn: true,
      zoom: 'day',
      timeZone: snapshot.plant.timeZone,
      focusBlock: () => {},
    });
  });
  return { ...hook, renders: () => renders };
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
});
