// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addWork,
  normalizeWindows,
  subtractWindows,
  subtractWork,
  unionWindows,
  type Window,
  workBetween,
} from '../src/index.ts';

const minute = 60_000;

/** Arbitrary windows inside one week, in whole minutes, as any availability is. */
const windows = fc
  .array(
    fc
      .tuple(fc.integer({ min: 0, max: 10_080 }), fc.integer({ min: 1, max: 600 }))
      .map(([from, length]) => ({ fromMs: from * minute, toMs: (from + length) * minute })),
    { minLength: 1, maxLength: 12 },
  )
  .map(normalizeWindows)
  .filter((list) => list.length > 0);

const workingSeconds = (list: readonly Window[]) =>
  list.reduce((sum, window) => sum + (window.toMs - window.fromMs), 0) / 1000;

/** Whether every segment lies inside one window of the availability. */
const insideWindows = (segments: readonly Window[], list: readonly Window[]) =>
  segments.every((segment) =>
    list.some((window) => window.fromMs <= segment.fromMs && segment.toMs <= window.toMs),
  );

describe('windows (ADR 0025, plan 07 windows.test.ts)', () => {
  it('union is commutative and idempotent, and subtract removes what union added', () => {
    fc.assert(
      fc.property(windows, windows, (a, b) => {
        expect(unionWindows(a, b)).toEqual(unionWindows(b, a));
        expect(unionWindows(a, a)).toEqual(a);
        expect(subtractWindows(unionWindows(a, b), b)).toEqual(subtractWindows(a, b));
        expect(workingSeconds(subtractWindows(a, b))).toBe(
          workingSeconds(unionWindows(a, b)) - workingSeconds(b),
        );
      }),
    );
  });

  it('addWork conserves the work, lays no segment in closed time and is monotonic in work', () => {
    fc.assert(
      fc.property(
        windows,
        fc.integer({ min: 0, max: 10_080 * 60 }),
        fc.integer({ min: 0, max: 7 * 86_400 }),
        (list, fromMs, workS) => {
          const total = workingSeconds(list);
          const placed = addWork(list, fromMs * 1000, workS);
          const available = workBetween(list, fromMs * 1000, Number.MAX_SAFE_INTEGER);
          if (workS > available || available === 0) {
            expect(placed).toBeNull();
            return;
          }
          expect(placed).not.toBeNull();
          if (placed === null) return;
          expect(workingSeconds(placed.segments)).toBe(workS);
          expect(insideWindows(placed.segments, list)).toBe(true);
          expect(placed.startMs).toBeGreaterThanOrEqual(fromMs * 1000);
          expect(workBetween(list, placed.startMs, placed.endMs)).toBe(workS);
          const more = addWork(list, fromMs * 1000, Math.min(workS + 60, total));
          if (more !== null) expect(more.endMs).toBeGreaterThanOrEqual(placed.endMs);
        },
      ),
    );
  });

  it('subtractWork after addWork returns to the start, for positive work from a working instant', () => {
    fc.assert(
      fc.property(
        windows,
        fc.integer({ min: 0, max: 10_080 * 60 }),
        fc.integer({ min: 1, max: 7 * 86_400 }),
        (list, fromMs, workS) => {
          const placed = addWork(list, fromMs * 1000, workS);
          if (placed === null) return;
          const back = subtractWork(list, placed.endMs, workS);
          expect(back?.startMs).toBe(placed.startMs);
          expect(back?.segments).toEqual(placed.segments);
        },
      ),
    );
  });
});
