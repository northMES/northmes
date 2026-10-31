// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import {
  notAllowedOf,
  pointerStart,
  previewOf,
  refusalMessage,
  stepMessage,
  tooltipText,
} from '../../../src/modules/planning/screens/gantt/gantt-move.ts';
import { createTimeScale, rangeOf } from '../../../src/modules/planning/timeline/time-scale.ts';
import { g1WithOverdueRow as withOverdueRow } from './past-fixtures.ts';

const minute = 60_000;
const mon = (hour: number, min = 0) => Date.UTC(2026, 10, 2, hour, min);

// G1's now is Mon 2 Nov 09:40 plant time (08:40Z); 1001.10 starts on Tue 3 Nov 11:30 on CNC 1.
const committed = g1Snapshot();
const nowMs = committed.nowMs;

const move = (setupStartMs: number, jobOrderId = 'jo-1001-10', equipment = 'CNC1') =>
  ({ jobOrderId, setupStartMs, equipment, source: 'pointer' }) as const;

describe('a move before now is refused with PAST (ADR 0089, Time before now)', () => {
  it('ADR0089 a setup start exactly at now is no refusal', () => {
    const preview = previewOf(committed, move(nowMs), true);

    expect(preview?.refused).toBeUndefined();
    expect(preview?.span.setupStartMs).toBeGreaterThanOrEqual(nowMs);
  });

  it('ADR0089 a setup start one minute before now is refused with PAST, in the refusal message, the tooltip and the step message', () => {
    const preview = previewOf(committed, move(nowMs - minute), true);

    expect(preview?.refused).toBe('PAST');
    expect(refusalMessage('1001.10', 'PAST')).toBe(
      'Cannot move 1001.10: it would start before now.',
    );
    expect(preview === undefined ? '' : tooltipText(preview, 'Europe/Stockholm')).toBe(
      'Cannot move 1001.10: it would start before now.',
    );
    expect(preview === undefined ? '' : stepMessage(preview, 'CNC 1', 'Europe/Stockholm')).toBe(
      'Cannot move 1001.10: it would start before now.',
    );
  });

  it('ADR0089 the refused preview outlines the place the pointer asks for, as long as the row', () => {
    const preview = previewOf(committed, move(mon(6)), true);
    const row = committed.productionOrders[0]?.jobOrders[0]?.placement;

    expect(preview?.span.setupStartMs).toBe(mon(6));
    expect((preview?.span.endMs ?? 0) - mon(6)).toBe((row?.endMs ?? 0) - (row?.setupStartMs ?? 0));
  });

  it('ADR0089 an overdue row held at its own start and machine is no move, so no refusal', () => {
    const snapshot = withOverdueRow();

    const preview = previewOf(snapshot, move(mon(6)), true);

    expect(preview?.refused).toBeUndefined();
  });

  it('ADR0089 an overdue row may move to now, and one minute before now is refused', () => {
    const snapshot = withOverdueRow();

    expect(previewOf(snapshot, move(nowMs), true)?.refused).toBeUndefined();
    expect(previewOf(snapshot, move(nowMs - minute), true)?.refused).toBe('PAST');
    // Another machine at its own past start is a move into the past too.
    expect(previewOf(snapshot, move(mon(6), 'jo-1001-10', 'CNC2'), true)?.refused).toBe('PAST');
  });
});

describe('the pointer start of a drop near now (ADR 0089, Time before now)', () => {
  const week = createTimeScale({
    range: rangeOf('2026-11-02', 'week', 'Europe/Stockholm', '06:00'),
    zoom: 'week',
    timeZone: 'Europe/Stockholm',
    widthPx: 1680,
  });

  it('ADR0089 an overdue row dropped on the now line at week, now 09:40, lands at 12:00', () => {
    const snapshot = withOverdueRow();

    const startMs = pointerStart(week, nowMs, nowMs);
    const preview = previewOf(snapshot, move(startMs), true);

    expect(startMs).toBe(mon(11));
    expect(preview?.refused).toBeUndefined();
    expect(preview?.span.setupStartMs).toBe(mon(11));
  });

  it('ADR0089 a pointer at a fractional instant, as a fractional width gives, snaps without a Temporal error', () => {
    expect(pointerStart(week, mon(13, 10) + 0.4062, nowMs)).toBe(mon(15));
    expect(pointerStart(week, nowMs - minute - 0.5, nowMs)).toBeLessThan(nowMs);
  });

  it('ADR0089 a pointer after now snaps as before, and one before now stays before now', () => {
    expect(pointerStart(week, mon(13, 10), nowMs)).toBe(mon(15));
    expect(pointerStart(week, nowMs - minute, nowMs)).toBeLessThan(nowMs);
  });
});

describe('the machines a moving job order may not go to (#944)', () => {
  it("#944 are the machines outside its operation's allowed machines: Mill 1 for 1001.10, Turn", () => {
    expect(notAllowedOf(committed, 'jo-1001-10')).toEqual({
      operation: 'Turn',
      machines: new Set(['MILL1']),
    });
  });

  it('#944 leave out the machine the job order is on, also when its operation no longer allows it', () => {
    // 1001.10 sits on CNC 1; its operation now allows CNC 2 only.
    const narrowed = {
      ...committed,
      productionOrders: committed.productionOrders.map((order) => ({
        ...order,
        operations: order.operations.map((operation) =>
          operation.displayNumber === '1001.10'
            ? { ...operation, allowedEquipment: ['CNC2'] }
            : operation,
        ),
      })),
    };

    expect(notAllowedOf(narrowed, 'jo-1001-10')?.machines).toEqual(new Set(['MILL1']));
  });

  it('#944 are none without a move', () => {
    expect(notAllowedOf(committed, undefined)).toBeUndefined();
  });
});
