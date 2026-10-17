// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { createTimeScale, naturalWidthPx, rangeLabel, rangeOf, shiftedFrom } from './time-scale.ts';

const stockholm = 'Europe/Stockholm';

/** Week 45 of 2026 in plant time: Mon 2 Nov 00:00 to Mon 9 Nov 00:00. */
const week45 = rangeOf('2026-11-02', 'week', stockholm, '06:00');

describe('rangeOf (plan 18, Shared pieces)', () => {
  it('TIME4 starts Week at midnight and Hours and Day at the production day start, on the plant clock', () => {
    expect(week45).toEqual({
      fromMs: Date.UTC(2026, 10, 1, 23, 0),
      toMs: Date.UTC(2026, 10, 8, 23, 0),
    });
    expect(rangeOf('2026-11-04', 'day', stockholm, '06:00')).toEqual({
      fromMs: Date.UTC(2026, 10, 4, 5, 0),
      toMs: Date.UTC(2026, 10, 7, 5, 0),
    });
    expect(rangeOf('2026-11-04', 'hours', stockholm, '06:00')).toEqual({
      fromMs: Date.UTC(2026, 10, 4, 5, 0),
      toMs: Date.UTC(2026, 10, 4, 17, 0),
    });
  });

  it('TIME4 starts 4 weeks at the Monday of the ISO week of the date', () => {
    expect(rangeOf('2026-11-05', '4weeks', stockholm, '06:00')).toEqual({
      fromMs: Date.UTC(2026, 10, 1, 23, 0),
      toMs: Date.UTC(2026, 10, 29, 23, 0),
    });
  });

  it('TIME5 keeps the dates of a range across the autumn clock change', () => {
    const range = rangeOf('2026-10-19', 'week', stockholm, '06:00');

    expect(range.toMs - range.fromMs).toBe(7 * 24 * 3_600_000 + 3_600_000);
  });

  it('shifts Earlier and Later by the preset span in days', () => {
    expect(shiftedFrom('2026-11-02', 'week', 'later')).toBe('2026-11-09');
    expect(shiftedFrom('2026-11-02', 'day', 'earlier')).toBe('2026-10-30');
    expect(shiftedFrom('2026-11-02', 'hours', 'later')).toBe('2026-11-03');
    expect(shiftedFrom('2026-11-02', '4weeks', 'later')).toBe('2026-11-30');
  });
});

describe('createTimeScale (plan 18, Shared pieces)', () => {
  const scale = createTimeScale({ range: week45, zoom: 'week', timeZone: stockholm, widthPx: 840 });

  it('TIME4 gives the ticks of week 45 per tier: a day tick per day and an hour tick every 6 hours', () => {
    const ticks = scale.ticks();
    const top = ticks.filter((tick) => tick.tier === 'top');
    const bottom = ticks.filter((tick) => tick.tier === 'bottom');

    expect(top.map((tick) => tick.label)).toEqual([
      'Mon 2 Nov',
      'Tue 3 Nov',
      'Wed 4 Nov',
      'Thu 5 Nov',
      'Fri 6 Nov',
      'Sat 7 Nov',
      'Sun 8 Nov',
    ]);
    expect(top.map((tick) => tick.x)).toEqual([0, 120, 240, 360, 480, 600, 720]);
    expect(bottom).toHaveLength(21);
    expect(bottom.slice(0, 3).map((tick) => tick.label)).toEqual(['06:00', '12:00', '18:00']);
    expect(bottom[0]?.x).toBe(30);
  });

  it('TIME4 gives the ticks of the other presets: hours every hour, Day every 3 hours, 4 weeks per week and day', () => {
    const hours = createTimeScale({
      range: rangeOf('2026-11-04', 'hours', stockholm, '06:00'),
      zoom: 'hours',
      timeZone: stockholm,
      widthPx: 840,
    }).ticks();
    const day = createTimeScale({
      range: rangeOf('2026-11-04', 'day', stockholm, '06:00'),
      zoom: 'day',
      timeZone: stockholm,
      widthPx: 840,
    }).ticks();
    const fourWeeks = createTimeScale({
      range: rangeOf('2026-11-02', '4weeks', stockholm, '06:00'),
      zoom: '4weeks',
      timeZone: stockholm,
      widthPx: 840,
    }).ticks();

    expect(hours.filter((tick) => tick.tier === 'top').map((tick) => tick.label)).toEqual([
      'Wed 4 Nov',
    ]);
    expect(hours.filter((tick) => tick.tier === 'bottom')).toHaveLength(11);
    expect(day.filter((tick) => tick.tier === 'top')).toHaveLength(3);
    expect(day.filter((tick) => tick.tier === 'bottom')).toHaveLength(21);
    expect(fourWeeks.filter((tick) => tick.tier === 'top').map((tick) => tick.label)).toEqual([
      'W45, Mon 2 Nov',
      'W46, Mon 9 Nov',
      'W47, Mon 16 Nov',
      'W48, Mon 23 Nov',
    ]);
    expect(fourWeeks.filter((tick) => tick.tier === 'bottom')).toHaveLength(24);
  });

  it('TIME4 maps an instant to x and back', () => {
    const wedNoon = Date.UTC(2026, 10, 4, 11, 0);

    expect(scale.x(wedNoon)).toBe(300);
    expect(scale.instant(300)).toBe(wedNoon);
    expect(scale.instant(scale.x(Date.UTC(2026, 10, 6, 12, 15)))).toBe(
      Date.UTC(2026, 10, 6, 12, 15),
    );
  });

  it('TIME4 snaps to the step of each preset on the plant clock: 4 h at Week, 1 h at Day, 1 day at 4 weeks', () => {
    const wed0950 = Date.UTC(2026, 10, 4, 8, 50);

    expect(scale.snap(wed0950)).toBe(Date.UTC(2026, 10, 4, 7, 0));
    expect(scale.snap(Date.UTC(2026, 10, 4, 9, 10))).toBe(Date.UTC(2026, 10, 4, 11, 0));
    expect(
      createTimeScale({ range: week45, zoom: 'day', timeZone: stockholm, widthPx: 840 }).snap(
        wed0950,
      ),
    ).toBe(Date.UTC(2026, 10, 4, 9, 0));
    expect(
      createTimeScale({ range: week45, zoom: '4weeks', timeZone: stockholm, widthPx: 840 }).snap(
        Date.UTC(2026, 10, 4, 13, 0),
      ),
    ).toBe(Date.UTC(2026, 10, 4, 23, 0));
    expect(scale.stepMs).toBe(4 * 3_600_000);
  });

  it('compresses every closed window to a gap of a few pixels and gives the open time the width', () => {
    const night = { fromMs: Date.UTC(2026, 10, 2, 14, 0), toMs: Date.UTC(2026, 10, 3, 5, 0) };
    const lunch = { fromMs: Date.UTC(2026, 10, 2, 10, 0), toMs: Date.UTC(2026, 10, 2, 10, 30) };
    const compressed = createTimeScale({
      range: { fromMs: Date.UTC(2026, 10, 2, 5, 0), toMs: Date.UTC(2026, 10, 3, 14, 0) },
      zoom: 'day',
      timeZone: stockholm,
      widthPx: 612,
      hideClosed: { closed: [night, lunch], gapPx: 6 },
    });
    // 17.5 h open over 600 px: 34.29 px per hour.
    const pxPerHour = 600 / 17.5;

    expect(compressed.gaps.map((gap) => ({ ...gap, x: Math.round(gap.x * 100) / 100 }))).toEqual([
      { ...lunch, x: Math.round(5 * pxPerHour * 100) / 100, widthPx: 6 },
      { ...night, x: Math.round((8.5 * pxPerHour + 6) * 100) / 100, widthPx: 6 },
    ]);
    expect(compressed.x(Date.UTC(2026, 10, 2, 10, 15))).toBeCloseTo(5 * pxPerHour + 3);
    expect(compressed.x(Date.UTC(2026, 10, 3, 5, 0))).toBeCloseTo(8.5 * pxPerHour + 12);
    expect(compressed.x(Date.UTC(2026, 10, 3, 14, 0))).toBeCloseTo(612);
    expect(compressed.instant(compressed.x(Date.UTC(2026, 10, 3, 7, 0)))).toBeCloseTo(
      Date.UTC(2026, 10, 3, 7, 0),
    );
    expect(compressed.inGap(Date.UTC(2026, 10, 2, 20, 0))).toBe(true);
    expect(
      compressed
        .ticks()
        .filter((tick) => tick.tier === 'bottom')
        .map((tick) => tick.label),
    ).toEqual(['09:00', '12:00', '15:00', '09:00', '12:00']);
  });

  it('names the range for the toolbar', () => {
    expect(rangeLabel(week45, 'week', stockholm)).toBe('W45, Mon 2 Nov to Sun 8 Nov');
    expect(rangeLabel(rangeOf('2026-11-04', 'hours', stockholm, '06:00'), 'hours', stockholm)).toBe(
      'Wed 4 Nov, 06:00 to 18:00',
    );
    // A Day range ends at the production day start after its last day, Sat 06:00, not on Saturday.
    expect(rangeLabel(rangeOf('2026-11-04', 'day', stockholm, '06:00'), 'day', stockholm)).toBe(
      'Wed 4 Nov to Fri 6 Nov',
    );
    expect(
      rangeLabel(rangeOf('2026-11-02', '4weeks', stockholm, '06:00'), '4weeks', stockholm),
    ).toBe('W45, Mon 2 Nov to Sun 29 Nov');
  });

  it('gives each preset a natural width wider than a view, and less with closed time hidden', () => {
    expect(naturalWidthPx(rangeOf('2026-11-04', 'hours', stockholm, '06:00'), 'hours')).toBe(1200);
    expect(naturalWidthPx(rangeOf('2026-11-04', 'day', stockholm, '06:00'), 'day')).toBe(3456);
    expect(naturalWidthPx(week45, 'week')).toBe(2688);
    expect(naturalWidthPx(rangeOf('2026-11-02', '4weeks', stockholm, '06:00'), '4weeks')).toBe(
      2016,
    );
    // Week 45 with the A1 calendar hidden: 41.25 open hours at 16 px plus 16 gaps of 6 px.
    const night = { fromMs: Date.UTC(2026, 10, 2, 14, 0), toMs: Date.UTC(2026, 10, 3, 5, 0) };
    expect(naturalWidthPx(week45, 'week', { closed: [night] })).toBe((168 - 15) * 16 + 6);
  });
});
