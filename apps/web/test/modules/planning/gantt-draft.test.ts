// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import {
  applyDraft,
  cascadeFromHere,
  draftConflicts,
  emptyDraft,
  moveBack,
  moveInDraft,
} from '../../../src/modules/planning/gantt-draft.ts';

const wed = (hour: number, minute = 0) => Date.UTC(2026, 10, 4, hour, minute);
const thu = (hour: number, minute = 0) => Date.UTC(2026, 10, 5, hour, minute);

describe('the in-memory draft of the order Gantt (plan 18, Resolving a break in the draft)', () => {
  const committed = g1Snapshot();

  it('GT3 with cascade off, a move of 1003.10 to Wed 09:00 is one change and one LEAD_TIME conflict clearing at Wed 13:30', () => {
    const { draft, result } = moveInDraft(
      committed,
      emptyDraft,
      { jobOrderId: 'jo-1003-10', setupStartMs: wed(8) },
      { cascade: false },
    );

    expect(result.refused).toBeUndefined();
    expect(draft.changes.map((change) => change.displayNumber)).toEqual(['1003.10']);
    const applied = applyDraft(committed, draft);
    expect(applied.productionOrders.find((o) => o.number === '1003')?.jobOrders[0]?.placement).toMatchObject({
      setupStartMs: wed(8),
      endMs: wed(12, 30),
    });
    expect(applied.analysis.jobOrders['jo-1003-20']?.constraints.some((line) => line.code === 'LEAD_TIME')).toBe(true);
    expect(draftConflicts(applied, draft)).toEqual([
      {
        code: 'LEAD_TIME',
        orderId: 'po-1003',
        rows: ['1003.10', '1003.20'],
        draftRow: 'jo-1003-10',
        laterRow: 'jo-1003-20',
        clearsAtMs: wed(12, 30),
        text: '1003.20 starts 45 min before its release from 1003.10; clears at Wed 4 Nov 13:30',
      },
    ]);
  });

  it('GT3 with cascade on, the same move is two changes and no conflict', () => {
    const { draft } = moveInDraft(committed, emptyDraft, { jobOrderId: 'jo-1003-10', setupStartMs: wed(8) });

    expect(draft.changes.map(({ displayNumber, to, reason }) => ({ displayNumber, to, reason }))).toEqual([
      { displayNumber: '1003.10', to: { setupStartMs: wed(8), runStartMs: wed(8), endMs: wed(12, 30) }, reason: 'moved' },
      { displayNumber: '1003.20', to: { setupStartMs: wed(12, 30), runStartMs: wed(12, 30), endMs: thu(6) }, reason: 'cascade' },
    ]);
    expect(draftConflicts(applyDraft(committed, draft), draft)).toEqual([]);
  });

  it('Cascade from here on the LEAD_TIME line adds the second draft row and clears the conflict', () => {
    const { draft } = moveInDraft(committed, emptyDraft, { jobOrderId: 'jo-1003-10', setupStartMs: wed(8) }, { cascade: false });
    const [conflict] = draftConflicts(applyDraft(committed, draft), draft);
    if (conflict === undefined) throw new Error('no conflict');

    const cascaded = cascadeFromHere(committed, draft, conflict);

    expect(cascaded.changes.map((change) => change.displayNumber)).toEqual(['1003.10', '1003.20']);
    expect(cascaded.changes[1]?.from).toMatchObject({ setupStartMs: wed(11, 45) });
    expect(draftConflicts(applyDraft(committed, cascaded), cascaded)).toEqual([]);
  });

  it('Move back discards the draft change of the row that caused the conflict', () => {
    const { draft } = moveInDraft(committed, emptyDraft, { jobOrderId: 'jo-1003-10', setupStartMs: wed(8) }, { cascade: false });
    const [conflict] = draftConflicts(applyDraft(committed, draft), draft);
    if (conflict === undefined) throw new Error('no conflict');

    const restored = moveBack(draft, conflict);

    expect(restored.changes).toEqual([]);
    expect(applyDraft(committed, restored).productionOrders).toEqual(committed.productionOrders);
  });

  it('a second move of a row in the draft keeps the committed span as its origin', () => {
    const first = moveInDraft(committed, emptyDraft, { jobOrderId: 'jo-1003-10', setupStartMs: wed(8) }).draft;
    const second = moveInDraft(committed, first, { jobOrderId: 'jo-1003-10', setupStartMs: wed(9) }).draft;

    expect(second.changes.find((change) => change.jobOrderId === 'jo-1003-10')).toMatchObject({
      from: { setupStartMs: wed(7) },
      to: { setupStartMs: wed(9) },
    });
    expect(second.changes).toHaveLength(2);
  });

  it('a refused move leaves the draft as it was', () => {
    const { draft, result } = moveInDraft(committed, emptyDraft, { jobOrderId: 'jo-1002-10', setupStartMs: thu(5) });

    expect(result.refused).toBe('PINNED');
    expect(draft).toBe(emptyDraft);
  });
});
