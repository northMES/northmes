// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { GanttCalendar, ZoomLevel } from '../gantt-data.ts';
import { closedWindows } from './availability-shading.ts';
import { bufferAround, bufferScale, movedBuffer, visibleSpan } from './time-buffer.ts';
import { spanLabel, type TimeRange, zoomLevels } from './time-scale.ts';
import type { ZoomPlant } from './zoom-view.ts';

const stockholm = 'Europe/Stockholm';
const hour = 3_600_000;
const plain: ZoomPlant = { timeZone: stockholm, productionDayStart: '06:00' };

/** A plant open Monday to Friday from 06:00 to 14:00 with a break, as G1's calendar is. */
const calendar: GanttCalendar = {
  name: 'Day shift',
  weekdays: [1, 2, 3, 4, 5],
  shift: { start: '06:00', end: '14:00' },
  breaks: [{ start: '09:00', end: '09:30' }],
  workingSecondsPerDay: 27_000,
};
const hidingClosed: ZoomPlant = {
  ...plain,
  closedOf: (range: TimeRange) => closedWindows(calendar, stockholm, range),
};

const levels: readonly ZoomLevel[] = ['quarter-hours', 'hours', 'day', 'week', '4weeks', 'quarter'];

describe('the buffer of the endless axis (ADR 0089, The endless axis)', () => {
  it('ADR0089 draws three viewport widths around an anchor, with the anchor at its x', () => {
    const anchorMs = Date.UTC(2026, 10, 4, 8);
    const range = bufferAround({
      anchorMs,
      anchorX: 900,
      viewportPx: 900,
      zoom: 'week',
      plant: plain,
    });
    const scale = bufferScale(range, 'week', plain);

    expect(scale.widthPx).toBeCloseTo(2700, 0);
    expect(scale.x(anchorMs)).toBeCloseTo(900, 0);
    expect(range.toMs - range.fromMs).toBe((2700 / zoomLevels.week.pxPerHour) * hour);
  });

  it('ADR0089 holds three viewport widths of drawn axis with closed time hidden, gaps included', () => {
    const anchorMs = Date.UTC(2026, 10, 4, 8);
    const range = bufferAround({
      anchorMs,
      anchorX: 1000,
      viewportPx: 1000,
      zoom: 'hours',
      plant: hidingClosed,
    });
    const scale = bufferScale(range, 'hours', hidingClosed);

    expect(scale.gaps.length).toBeGreaterThan(0);
    expect(Math.abs(scale.widthPx - 3000)).toBeLessThanOrEqual(6);
    expect(Math.abs(scale.x(anchorMs) - 1000)).toBeLessThanOrEqual(6);
  });

  it('ADR0089 moves by one viewport width near the right edge and corrects the scroll by the moved pixels', () => {
    const range = bufferAround({
      anchorMs: Date.UTC(2026, 10, 4, 8),
      anchorX: 800,
      viewportPx: 800,
      zoom: 'day',
      plant: plain,
    });
    const scale = bufferScale(range, 'day', plain);
    // The view ends 100 px from the buffer's end, inside the quarter-width margin.
    const viewStartX = 2400 - 800 - 100;
    const before = scale.instant(viewStartX);

    const moved = movedBuffer({ scale, viewStartX, viewportPx: 800, plant: plain });

    expect(moved?.correctionPx).toBeCloseTo(-800, 0);
    const next = bufferScale(moved?.range ?? range, 'day', plain);
    expect(next.instant(viewStartX + (moved?.correctionPx ?? 0))).toBeCloseTo(before, -1);
  });

  it('ADR0089 stays put while the view keeps a quarter width from both edges', () => {
    const range = bufferAround({
      anchorMs: Date.UTC(2026, 10, 4, 8),
      anchorX: 800,
      viewportPx: 800,
      zoom: 'day',
      plant: plain,
    });
    const scale = bufferScale(range, 'day', plain);

    expect(movedBuffer({ scale, viewStartX: 200, viewportPx: 800, plant: plain })).toBeUndefined();
    expect(movedBuffer({ scale, viewStartX: 1400, viewportPx: 800, plant: plain })).toBeUndefined();
    expect(movedBuffer({ scale, viewStartX: 199, viewportPx: 800, plant: plain })).toBeDefined();
    expect(movedBuffer({ scale, viewStartX: 1401, viewportPx: 800, plant: plain })).toBeDefined();
  });

  it('ADR0089 takes a fractional instant at an x, as a scroll position between pixels reads one, with closed time hidden', () => {
    // The counterexample fast-check found: Hours, a view of 480 px, anchored in a night at
    // 02:00, then a step of 0.74 of the view.
    const anchorMs = Date.UTC(2026, 9, 1);
    const range = bufferAround({
      anchorMs,
      anchorX: 480,
      viewportPx: 480,
      zoom: 'hours',
      plant: hidingClosed,
    });
    const scale = bufferScale(range, 'hours', hidingClosed);
    const viewStartX = scale.x(anchorMs) + 0.740625 * 480;

    expect(() =>
      movedBuffer({ scale, viewStartX, viewportPx: 480, plant: hidingClosed }),
    ).not.toThrow();
    expect(() =>
      bufferAround({
        anchorMs: anchorMs + 0.5,
        anchorX: 480,
        viewportPx: 480,
        zoom: 'hours',
        plant: hidingClosed,
      }),
    ).not.toThrow();
  });

  it('ADR0089 names the span by the last whole pixel in view, so half a pixel past a gap does not change its end', () => {
    const scale = bufferScale(
      { fromMs: Date.UTC(2026, 10, 1, 23), toMs: Date.UTC(2026, 10, 15, 23) },
      'week',
      hidingClosed,
    );
    const weekend = scale.gaps.find((gap) => gap.fromMs === Date.UTC(2026, 10, 6, 13));
    if (weekend === undefined) throw new Error('No weekend gap');
    const gapEnd = weekend.x + weekend.widthPx;

    expect(visibleSpan(scale, gapEnd - 300, 300).toMs).toBe(weekend.fromMs);
    expect(visibleSpan(scale, gapEnd - 299.5, 300).toMs).toBe(weekend.fromMs);
  });

  it('ADR0089 ends the span where the view ends, so the range text names a whole hour where the view ends on one', () => {
    // Hours at 100 px an hour from Wed 4 Nov 06:00: a view of 1 200 px ends at 18:00.
    const fromMs = Date.UTC(2026, 10, 4, 5);
    const scale = bufferScale({ fromMs, toMs: fromMs + 36 * hour }, 'hours', plain);

    expect(visibleSpan(scale, 0, 1200).toMs).toBe(Date.UTC(2026, 10, 4, 17));
    expect(spanLabel(visibleSpan(scale, 0, 1200), 'hours', stockholm)).toBe(
      'Wed 4 Nov, 06:00 to 18:00',
    );
  });

  it('ADR0089 never ends a span before it starts, for a view narrower than a gap inside one', () => {
    const scale = bufferScale(
      { fromMs: Date.UTC(2026, 10, 1, 23), toMs: Date.UTC(2026, 10, 15, 23) },
      'week',
      hidingClosed,
    );
    const weekend = scale.gaps.find((gap) => gap.fromMs === Date.UTC(2026, 10, 6, 13));
    if (weekend === undefined) throw new Error('No weekend gap');

    const span = visibleSpan(scale, weekend.x + 1, 3);

    expect(span.toMs).toBeGreaterThanOrEqual(span.fromMs);
  });

  it('ADR0089 names open time: a view that starts or ends inside a hidden closed window starts where it ends or ends where it starts', () => {
    // Week 45 at Week with closed time hidden: the weekend from Fri 6 Nov 14:00 to Mon 9 Nov 06:00
    // is one gap of a few pixels.
    const scale = bufferScale(
      { fromMs: Date.UTC(2026, 10, 1, 23), toMs: Date.UTC(2026, 10, 15, 23) },
      'week',
      hidingClosed,
    );
    const weekend = scale.gaps.find((gap) => gap.fromMs === Date.UTC(2026, 10, 6, 13));
    if (weekend === undefined) throw new Error('No weekend gap');
    const insideGap = weekend.x + weekend.widthPx / 2;

    expect(visibleSpan(scale, insideGap - 300, 300).toMs).toBe(weekend.fromMs);
    expect(visibleSpan(scale, insideGap, 300).fromMs).toBe(weekend.toMs);
  });

  it('ADR0089 moves at most once per edge crossing over random scroll sequences, keeps the date under the view start, and names the visible span', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...levels),
        fc.integer({ min: 320, max: 1600 }),
        fc.integer({ min: Date.UTC(2026, 0, 1), max: Date.UTC(2027, 11, 31) }),
        fc.array(fc.double({ min: -2, max: 2, noNaN: true }), { minLength: 1, maxLength: 25 }),
        (zoom, viewportPx, anchorMs, steps) => {
          const { pxPerHour } = zoomLevels[zoom];
          let range = bufferAround({
            anchorMs,
            anchorX: viewportPx,
            viewportPx,
            zoom,
            plant: plain,
          });
          let scale = bufferScale(range, zoom, plain);
          let left = scale.x(anchorMs);
          for (const step of steps) {
            left = Math.max(0, Math.min(scale.widthPx - viewportPx, left + step * viewportPx));
            const before = scale.instant(left);
            const moved = movedBuffer({ scale, viewStartX: left, viewportPx, plant: plain });
            if (moved !== undefined) {
              range = moved.range;
              scale = bufferScale(range, zoom, plain);
              left += moved.correctionPx;
              expect(
                movedBuffer({ scale, viewStartX: left, viewportPx, plant: plain }),
              ).toBeUndefined();
              expect(Math.abs(scale.instant(left) - before)).toBeLessThan(hour / pxPerHour);
            }
            // At least the viewport, both margins and one move: three widths against two and a half.
            expect(scale.widthPx).toBeGreaterThanOrEqual(2.5 * viewportPx);
            const fromMs = Math.round(range.fromMs + (left / pxPerHour) * hour);
            const expected = { fromMs, toMs: Math.round(fromMs + (viewportPx / pxPerHour) * hour) };
            expect(spanLabel(visibleSpan(scale, left, viewportPx), zoom, stockholm)).toBe(
              spanLabel(expected, zoom, stockholm),
            );
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('ADR0089 moves at most once per edge crossing with closed time hidden too', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ZoomLevel>('hours', 'day', 'week'),
        fc.integer({ min: 480, max: 1400 }),
        fc.integer({ min: Date.UTC(2026, 9, 1), max: Date.UTC(2027, 3, 30) }),
        fc.array(fc.double({ min: -2, max: 2, noNaN: true }), { minLength: 1, maxLength: 15 }),
        (zoom, viewportPx, anchorMs, steps) => {
          let scale = bufferScale(
            bufferAround({ anchorMs, anchorX: viewportPx, viewportPx, zoom, plant: hidingClosed }),
            zoom,
            hidingClosed,
          );
          let left = scale.x(anchorMs);
          for (const step of steps) {
            left = Math.max(0, Math.min(scale.widthPx - viewportPx, left + step * viewportPx));
            const moved = movedBuffer({ scale, viewStartX: left, viewportPx, plant: hidingClosed });
            if (moved === undefined) continue;
            scale = bufferScale(moved.range, zoom, hidingClosed);
            left += moved.correctionPx;
            expect(
              movedBuffer({ scale, viewStartX: left, viewportPx, plant: hidingClosed }),
            ).toBeUndefined();
            expect(scale.widthPx).toBeGreaterThanOrEqual(2.5 * viewportPx);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('spanLabel, the range text of the visible span', () => {
  const at = (iso: string) => Date.parse(iso);

  it('ADR0089 names the days of a span at week and 4weeks, with the ISO week of its start', () => {
    expect(
      spanLabel(
        { fromMs: at('2026-11-02T08:20:00Z'), toMs: at('2026-11-05T16:00:00Z') },
        'week',
        stockholm,
      ),
    ).toBe('W45, Mon 2 Nov to Thu 5 Nov');
    // A span that ends at midnight ends on the day before.
    expect(
      spanLabel(
        { fromMs: at('2026-11-01T23:00:00Z'), toMs: at('2026-11-08T23:00:00Z') },
        'week',
        stockholm,
      ),
    ).toBe('W45, Mon 2 Nov to Sun 8 Nov');
  });

  it('ADR0089 names the clock of a span at the levels that span hours, and both days when it crosses midnight', () => {
    expect(
      spanLabel(
        { fromMs: at('2026-11-04T05:00:00Z'), toMs: at('2026-11-04T17:00:00Z') },
        'hours',
        stockholm,
      ),
    ).toBe('Wed 4 Nov, 06:00 to 18:00');
    expect(
      spanLabel(
        { fromMs: at('2026-11-04T19:20:00Z'), toMs: at('2026-11-05T07:20:00Z') },
        'hours',
        stockholm,
      ),
    ).toBe('Wed 4 Nov 20:20 to Thu 5 Nov 08:20');
  });

  it('ADR0089 names the days of a span at day, and the months at quarter and year', () => {
    expect(
      spanLabel(
        { fromMs: at('2026-11-04T05:00:00Z'), toMs: at('2026-11-07T05:00:00Z') },
        'day',
        stockholm,
      ),
    ).toBe('Wed 4 Nov to Sat 7 Nov');
    expect(
      spanLabel(
        { fromMs: at('2026-11-10T05:00:00Z'), toMs: at('2027-02-03T05:00:00Z') },
        'quarter',
        stockholm,
      ),
    ).toBe('November 2026 to February 2027');
  });
});
