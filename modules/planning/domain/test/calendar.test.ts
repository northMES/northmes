// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { availabilityOf, weeklyCalendar } from '../src/index.ts';

/**
 * The A1 calendar of plan 07 (Monday to Friday 06:00 to 15:00, breaks 08:30 to 08:45 and 11:00
 * to 11:30, Europe/Stockholm) as the domain reads it. November 2026 has no clock change, so
 * local 06:00 is 05:00Z.
 */
const a1 = weeklyCalendar({
  timeZone: 'Europe/Stockholm',
  weekdays: [1, 2, 3, 4, 5],
  shift: { start: '06:00', end: '15:00' },
  breaks: [
    { start: '08:30', end: '08:45' },
    { start: '11:00', end: '11:30' },
  ],
  deviations: [],
});

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
