// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { addWork, availabilityOf, weeklyCalendar } from '../src/index.ts';

/**
 * The A1 calendar of plan 07 (Monday to Friday 06:00 to 15:00, breaks 08:30 to 08:45 and 11:00
 * to 11:30, Europe/Stockholm) as the domain reads it. November 2026 has no clock change, so
 * local 06:00 is 05:00Z.
 */
const a1Input = {
  timeZone: 'Europe/Stockholm',
  weekdays: [1, 2, 3, 4, 5],
  shift: { start: '06:00', end: '15:00' },
  breaks: [
    { start: '08:30', end: '08:45' },
    { start: '11:00', end: '11:30' },
  ],
  deviations: [],
} as const;
const a1 = weeklyCalendar(a1Input);

/** Week 45 of 2026 in plant time, Mon 2 Nov 00:00 to Mon 9 Nov 00:00. */
const week45 = { fromMs: Date.UTC(2026, 10, 1, 23), toMs: Date.UTC(2026, 10, 8, 23) };

/** The three windows of one A1 working day, by its UTC date. */
function a1Day(day: number) {
  return [
    { fromMs: Date.UTC(2026, 10, day, 5, 0), toMs: Date.UTC(2026, 10, day, 7, 30) },
    { fromMs: Date.UTC(2026, 10, day, 7, 45), toMs: Date.UTC(2026, 10, day, 10, 0) },
    { fromMs: Date.UTC(2026, 10, day, 10, 30), toMs: Date.UTC(2026, 10, day, 14, 0) },
  ];
}

describe('availabilityOf (ADR 0025)', () => {
  it('expands the A1 pattern to the shift less its breaks on each working day of week 45', () => {
    const windows = availabilityOf(a1, undefined, week45.fromMs, week45.toMs);

    expect(windows).toEqual([2, 3, 4, 5, 6].flatMap(a1Day));
  });
});

describe('addWork (ADR 0025 rule 10)', () => {
  const mill1 = availabilityOf(a1, 'MILL1', Date.UTC(2026, 10, 1, 23), Date.UTC(2026, 10, 15, 23));

  it('CAL12 lays 1006.10 from Fri 13:00 over the weekend: 10 800 s end Mon 07:00 in two segments', () => {
    const placed = addWork(mill1, Date.UTC(2026, 10, 6, 12), 10_800);

    expect(placed).toEqual({
      startMs: Date.UTC(2026, 10, 6, 12),
      endMs: Date.UTC(2026, 10, 9, 6),
      segments: [
        { fromMs: Date.UTC(2026, 10, 6, 12), toMs: Date.UTC(2026, 10, 6, 14) },
        { fromMs: Date.UTC(2026, 10, 9, 5), toMs: Date.UTC(2026, 10, 9, 6) },
      ],
    });
  });
});

describe('deviations (ADR 0025 rule 7)', () => {
  const horizon = { fromMs: Date.UTC(2026, 10, 1, 23), toMs: Date.UTC(2026, 10, 15, 23) };
  const fri1300 = Date.UTC(2026, 10, 6, 12);

  it('CAL12 a plant holiday on Mon 9 Nov moves the end of 1006.10 to Tue 07:00', () => {
    const calendar = weeklyCalendar({
      ...a1Input,
      deviations: [
        {
          kind: 'nonWorking',
          startsLocal: '2026-11-09T00:00',
          endsLocal: '2026-11-10T00:00',
          reason: 'Plant holiday',
        },
      ],
    });
    const mill1 = availabilityOf(calendar, 'MILL1', horizon.fromMs, horizon.toMs);

    expect(addWork(mill1, fri1300, 10_800)).toEqual({
      startMs: fri1300,
      endMs: Date.UTC(2026, 10, 10, 6),
      segments: [
        { fromMs: fri1300, toMs: Date.UTC(2026, 10, 6, 14) },
        { fromMs: Date.UTC(2026, 10, 10, 5), toMs: Date.UTC(2026, 10, 10, 6) },
      ],
    });
  });

  it('CAL12 Saturday overtime 06:00 to 10:00 on Mill 1 moves the end to Sat 07:00 and leaves CNC 1 as it was', () => {
    const calendar = weeklyCalendar({
      ...a1Input,
      deviations: [
        {
          kind: 'overtime',
          startsLocal: '2026-11-07T06:00',
          endsLocal: '2026-11-07T10:00',
          equipment: ['MILL1'],
        },
      ],
    });
    const mill1 = availabilityOf(calendar, 'MILL1', horizon.fromMs, horizon.toMs);
    const cnc1 = availabilityOf(calendar, 'CNC1', horizon.fromMs, horizon.toMs);

    expect(addWork(mill1, fri1300, 10_800)).toEqual({
      startMs: fri1300,
      endMs: Date.UTC(2026, 10, 7, 6),
      segments: [
        { fromMs: fri1300, toMs: Date.UTC(2026, 10, 6, 14) },
        { fromMs: Date.UTC(2026, 10, 7, 5), toMs: Date.UTC(2026, 10, 7, 6) },
      ],
    });
    expect(addWork(cnc1, fri1300, 10_800)?.endMs).toBe(Date.UTC(2026, 10, 9, 6));
  });

  it('a machine deviation overrides a plant-wide one: overtime on Mill 1 stays open on a plant holiday', () => {
    const calendar = weeklyCalendar({
      ...a1Input,
      deviations: [
        { kind: 'nonWorking', startsLocal: '2026-11-07T00:00', endsLocal: '2026-11-08T00:00' },
        {
          kind: 'overtime',
          startsLocal: '2026-11-07T06:00',
          endsLocal: '2026-11-07T10:00',
          equipment: ['MILL1'],
        },
      ],
    });

    expect(availabilityOf(calendar, 'MILL1', Date.UTC(2026, 10, 6, 23), Date.UTC(2026, 10, 7, 23))).toEqual([
      { fromMs: Date.UTC(2026, 10, 7, 5), toMs: Date.UTC(2026, 10, 7, 9) },
    ]);
    expect(availabilityOf(calendar, 'CNC1', Date.UTC(2026, 10, 6, 23), Date.UTC(2026, 10, 7, 23))).toEqual([]);
  });
});
