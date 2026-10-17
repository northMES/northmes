// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import fc from 'fast-check';
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';
import { resolveLocalDateTime, resolveWallClock } from '../src/index.ts';

const stockholm = 'Europe/Stockholm';

describe('resolveWallClock (ADR 0024, the clamp rule)', () => {
  it('TIME1 a time in the spring gap resolves to the first instant after the gap', () => {
    expect(resolveLocalDateTime(stockholm, '2027-03-28T02:30')).toBe(Date.UTC(2027, 2, 28, 1));
  });

  it('TIME2 a repeated autumn time resolves to its first occurrence', () => {
    expect(resolveLocalDateTime(stockholm, '2026-10-25T02:30')).toBe(Date.UTC(2026, 9, 25, 0, 30));
  });

  it('TIME3 a break inside the gap never inverts', () => {
    const from = resolveLocalDateTime(stockholm, '2026-03-29T02:30');
    const to = resolveLocalDateTime(stockholm, '2026-03-29T03:15');

    expect(to).toBeGreaterThanOrEqual(from);
  });

  it('is monotonic on a transition date in Europe/Stockholm, America/Santiago and Australia/Lord_Howe', () => {
    const cases = [
      [stockholm, '2027-03-28'],
      [stockholm, '2026-10-25'],
      ['America/Santiago', '2026-09-06'],
      ['America/Santiago', '2027-04-04'],
      ['Australia/Lord_Howe', '2026-10-04'],
      ['Australia/Lord_Howe', '2027-04-04'],
    ] as const;
    const minuteOfDay = fc.integer({ min: 0, max: 1439 });
    for (const [zone, date] of cases) {
      const plainDate = Temporal.PlainDate.from(date);
      fc.assert(
        fc.property(minuteOfDay, minuteOfDay, (a, b) => {
          const [early, late] = a <= b ? [a, b] : [b, a];
          const at = (minutes: number) =>
            resolveWallClock(
              zone,
              plainDate,
              Temporal.PlainTime.from({ hour: Math.floor(minutes / 60), minute: minutes % 60 }),
            );
          expect(at(late)).toBeGreaterThanOrEqual(at(early));
        }),
      );
    }
  });
});
