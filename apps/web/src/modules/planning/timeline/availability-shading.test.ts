// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import type { GanttCalendar } from '../gantt-data.ts';
import { closedWindows, openWindows, workingMsBetween } from './availability-shading.ts';
import { rangeOf } from './time-scale.ts';

const stockholm = 'Europe/Stockholm';

/** The A1 calendar of G1: Monday to Friday 06:00 to 15:00 with two breaks. */
const a1: GanttCalendar = {
  name: 'A1',
  weekdays: [1, 2, 3, 4, 5],
  shift: { start: '06:00', end: '15:00' },
  breaks: [
    { start: '08:30', end: '08:45' },
    { start: '11:00', end: '11:30' },
  ],
  workingSecondsPerDay: 29_700,
};

const week45 = rangeOf('2026-11-02', 'week', stockholm, '06:00');

describe('availability shading (plan 18, Working-time calendars on the timeline)', () => {
  it('GT5 opens three windows per working day of A1, 29 700 s each day, none at the weekend', () => {
    const windows = openWindows(a1, stockholm, week45);

    expect(windows).toHaveLength(15);
    expect(windows.slice(0, 3)).toEqual([
      { fromMs: Date.UTC(2026, 10, 2, 5, 0), toMs: Date.UTC(2026, 10, 2, 7, 30) },
      { fromMs: Date.UTC(2026, 10, 2, 7, 45), toMs: Date.UTC(2026, 10, 2, 10, 0) },
      { fromMs: Date.UTC(2026, 10, 2, 10, 30), toMs: Date.UTC(2026, 10, 2, 14, 0) },
    ]);
    expect(windows.reduce((sum, w) => sum + (w.toMs - w.fromMs), 0)).toBe(5 * 29_700_000);
  });

  it('GT7 closes the nights, the breaks and the weekend, a night and the next morning as one window', () => {
    const windows = closedWindows(a1, stockholm, week45);

    expect(windows).toHaveLength(16);
    expect(windows[0]).toEqual({ fromMs: week45.fromMs, toMs: Date.UTC(2026, 10, 2, 5, 0) });
    expect(windows[3]).toEqual({
      fromMs: Date.UTC(2026, 10, 2, 14, 0),
      toMs: Date.UTC(2026, 10, 3, 5, 0),
    });
    expect(windows[15]).toEqual({ fromMs: Date.UTC(2026, 10, 6, 14, 0), toMs: week45.toMs });
  });

  it('GT7 counts the working time of 1006.10 from Fri 13:00 to Mon 07:00 as 3 h', () => {
    expect(
      workingMsBetween(a1, stockholm, Date.UTC(2026, 10, 6, 12, 0), Date.UTC(2026, 10, 9, 6, 0)),
    ).toBe(3 * 3_600_000);
  });
});
