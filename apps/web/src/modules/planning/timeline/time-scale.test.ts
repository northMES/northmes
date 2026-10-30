// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import {
  createTimeScale,
  extendedRange,
  naturalWidthPx,
  rangeLabel,
  rangeOf,
  shiftedFrom,
} from './time-scale.ts';

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

describe('extendedRange (#685)', () => {
  const stockholm = 'Europe/Stockholm';

  it('extends a Day range by whole spans of three days, before and after', () => {
    const chosen = rangeOf('2026-11-04', 'day', stockholm, '06:00');
    const extended = extendedRange('2026-11-04', 'day', stockholm, '06:00', {
      before: 1,
      after: 2,
    });

    expect(extended.fromMs).toBe(chosen.fromMs - 3 * 86_400_000);
    expect(extended.toMs).toBe(chosen.toMs + 6 * 86_400_000);
  });

  it("extends an Hours range by the preset's 12 h span, not by a whole date", () => {
    const chosen = rangeOf('2026-11-04', 'hours', stockholm, '06:00');
    const extended = extendedRange('2026-11-04', 'hours', stockholm, '06:00', {
      before: 1,
      after: 1,
    });

    expect(chosen.toMs - chosen.fromMs).toBe(12 * 3_600_000);
    expect(extended.fromMs).toBe(chosen.fromMs - 12 * 3_600_000);
    expect(extended.toMs).toBe(chosen.toMs + 12 * 3_600_000);
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
    // A 6 h cell is 30 px at 840 px, too narrow for "06:00", so the hour stands alone.
    expect(bottom.slice(0, 3).map((tick) => tick.label)).toEqual(['06', '12', '18']);
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
    // The 15:00 cell lies wholly in the night, so it has no label (#892).
    expect(
      compressed
        .ticks()
        .filter((tick) => tick.tier === 'bottom')
        .map((tick) => tick.label),
    ).toEqual(['09:00', '12:00', '09:00', '12:00']);
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

describe('the header tiers with closed time hidden (ADR 0089, Header tiers)', () => {
  /** A plant clock time of November 2026 in Stockholm, UTC+1. */
  const local = (date: number, hours: number, minutes = 0) =>
    Date.UTC(2026, 10, date, hours - 1, minutes);
  /** Week 45 open 06:00 to 22:00 Monday to Friday: the nights and the weekend are closed. */
  const closed = [
    { fromMs: local(2, 0), toMs: local(2, 6) },
    { fromMs: local(2, 22), toMs: local(3, 6) },
    { fromMs: local(3, 22), toMs: local(4, 6) },
    { fromMs: local(4, 22), toMs: local(5, 6) },
    { fromMs: local(5, 22), toMs: local(6, 6) },
    { fromMs: local(6, 22), toMs: local(9, 0) },
  ];
  const hideClosed = { closed };
  const compressed = createTimeScale({
    range: week45,
    zoom: 'week',
    timeZone: stockholm,
    widthPx: naturalWidthPx(week45, 'week', hideClosed),
    hideClosed,
  });
  const top = compressed.ticks().filter((tick) => tick.tier === 'top');

  it("#892 starts a day's cell at its first open segment and ends it at its last", () => {
    const monday = top[0];

    expect(monday?.label).toBe('Mon 2 Nov');
    // Monday opens after the 6 px gap of the night before; Tuesday after 16 open hours at 16 px
    // and the next gap.
    expect(monday?.x).toBe(6);
    expect(monday?.widthPx).toBe(16 * 16);
    expect(top[1]?.x).toBe(268);
  });

  it('#892 gives a cell wholly inside a gap no tick, so the weekend holds no label and no tick of either tier starts in a gap', () => {
    expect(top.map((tick) => tick.label)).toEqual([
      'Mon 2 Nov',
      'Tue 3 Nov',
      'Wed 4 Nov',
      'Thu 5 Nov',
      'Fri 6 Nov',
    ]);
    for (const tick of compressed.ticks()) {
      for (const gap of compressed.gaps) {
        expect(tick.x >= gap.x && tick.x < gap.x + gap.widthPx).toBe(false);
      }
    }
  });

  it('#892 uses the long label where it fits its cell, then the short one, then none', () => {
    // Monday open 06:00 to 10:00 (64 px), Tuesday 06:00 to 07:00 (16 px), Wednesday 06:00 to 08:00.
    const short = {
      closed: [
        { fromMs: local(2, 0), toMs: local(2, 6) },
        { fromMs: local(2, 10), toMs: local(3, 6) },
        { fromMs: local(3, 7), toMs: local(4, 6) },
        { fromMs: local(4, 8), toMs: local(9, 0) },
      ],
    };
    const ticks = createTimeScale({
      range: week45,
      zoom: 'week',
      timeZone: stockholm,
      widthPx: naturalWidthPx(week45, 'week', short),
      hideClosed: short,
    }).ticks();

    expect(ticks.filter((tick) => tick.tier === 'top').map((tick) => tick.label)).toEqual([
      '2',
      '',
      '4',
    ]);
    expect(ticks.filter((tick) => tick.tier === 'bottom').map((tick) => tick.label)).toEqual([
      '06:00',
      '',
      '06',
    ]);
  });

  it('#892 shortens a week cell of 4 weeks to its week number', () => {
    const range = rangeOf('2026-11-02', '4weeks', stockholm, '06:00');
    // Only Mondays are open, 06:00 to 22:00: 48 px a week.
    const mondays = {
      closed: [
        { fromMs: local(2, 0), toMs: local(2, 6) },
        ...[0, 1, 2, 3].map((week) => ({
          fromMs: local(2 + 7 * week, 22),
          toMs: local(9 + 7 * week, 6),
        })),
      ],
    };
    const ticks = createTimeScale({
      range,
      zoom: '4weeks',
      timeZone: stockholm,
      widthPx: naturalWidthPx(range, '4weeks', mondays),
      hideClosed: mondays,
    }).ticks();

    expect(ticks.filter((tick) => tick.tier === 'top').map((tick) => tick.label)).toEqual([
      'W45',
      'W46',
      'W47',
      'W48',
    ]);
  });
});

describe('the header tiers of an extended Hours range (#892)', () => {
  const local = (date: number, hours: number, minutes = 0) =>
    Date.UTC(2026, 10, date, hours - 1, minutes);
  // One 12 h span before Wed 4 Nov 06:00: the range starts Tue 3 Nov 18:00.
  const range = extendedRange('2026-11-04', 'hours', stockholm, '06:00', { before: 1, after: 0 });

  it('#892 aligns the day cells to the production day, so a day is named over its own open time', () => {
    const night = { closed: [{ fromMs: local(3, 15), toMs: local(4, 6) }] };
    const hidden = createTimeScale({
      range,
      zoom: 'hours',
      timeZone: stockholm,
      productionDayStart: '06:00',
      widthPx: naturalWidthPx(range, 'hours', night),
      hideClosed: night,
    })
      .ticks()
      .filter((tick) => tick.tier === 'top');
    const plain = createTimeScale({
      range,
      zoom: 'hours',
      timeZone: stockholm,
      productionDayStart: '06:00',
      widthPx: naturalWidthPx(range, 'hours'),
    })
      .ticks()
      .filter((tick) => tick.tier === 'top');

    expect(hidden.map((tick) => [tick.label, tick.x])).toEqual([['Wed 4 Nov', 6]]);
    expect(plain.map((tick) => [tick.label, tick.x])).toEqual([
      ['Tue 3 Nov', 0],
      ['Wed 4 Nov', 1200],
    ]);
  });
});

describe('a clock cell clipped at its start (#892)', () => {
  const local = (date: number, hours: number, minutes = 0) =>
    Date.UTC(2026, 10, date, hours - 1, minutes);

  it('#892 names an hour cell that starts in a break by the clock where its open time starts', () => {
    const range = rangeOf('2026-11-04', 'hours', stockholm, '06:00');
    const lunch = { closed: [{ fromMs: local(4, 11), toMs: local(4, 11, 30) }] };
    const bottom = createTimeScale({
      range,
      zoom: 'hours',
      timeZone: stockholm,
      widthPx: naturalWidthPx(range, 'hours', lunch),
      hideClosed: lunch,
    })
      .ticks()
      .filter((tick) => tick.tier === 'bottom');

    // 07:00 to 10:00 at 100 px an hour, the break's 6 px gap at 500, then 11:30 to 12:00.
    expect(bottom.slice(3, 6).map((tick) => [tick.label, tick.x])).toEqual([
      ['10:00', 400],
      ['11:30', 506],
      ['12:00', 556],
    ]);
  });
});

describe('the names of the header cells (#902)', () => {
  const local = (date: number, hours: number) => Date.UTC(2026, 10, date, hours - 1);

  it('#902 names each cell by its full date and clock, also where only the short label or none fits', () => {
    // Monday open 06:00 to 10:00 (64 px), Tuesday 06:00 to 07:00 (16 px), Wednesday 06:00 to 08:00.
    const short = {
      closed: [
        { fromMs: local(2, 0), toMs: local(2, 6) },
        { fromMs: local(2, 10), toMs: local(3, 6) },
        { fromMs: local(3, 7), toMs: local(4, 6) },
        { fromMs: local(4, 8), toMs: local(9, 0) },
      ],
    };
    const ticks = createTimeScale({
      range: week45,
      zoom: 'week',
      timeZone: stockholm,
      widthPx: naturalWidthPx(week45, 'week', short),
      hideClosed: short,
    }).ticks();

    expect(
      ticks.filter((tick) => tick.tier === 'top').map((tick) => [tick.label, tick.name]),
    ).toEqual([
      ['2', 'Mon 2 Nov'],
      ['', 'Tue 3 Nov'],
      ['4', 'Wed 4 Nov'],
    ]);
    expect(
      ticks.filter((tick) => tick.tier === 'bottom').map((tick) => [tick.label, tick.name]),
    ).toEqual([
      ['06:00', 'Mon 2 Nov 06:00'],
      ['', 'Tue 3 Nov 06:00'],
      ['06', 'Wed 4 Nov 06:00'],
    ]);
  });

  it('#902 names each week cell of 4 weeks by its week number and the date it starts, and a day cell by its date', () => {
    const range = rangeOf('2026-11-02', '4weeks', stockholm, '06:00');
    const ticks = createTimeScale({
      range,
      zoom: '4weeks',
      timeZone: stockholm,
      widthPx: 400,
    }).ticks();

    expect(ticks.filter((tick) => tick.tier === 'top').map((tick) => tick.name)).toEqual([
      'Week 45, Mon 2 Nov',
      'Week 46, Mon 9 Nov',
      'Week 47, Mon 16 Nov',
      'Week 48, Mon 23 Nov',
    ]);
    expect(ticks.find((tick) => tick.tier === 'bottom')?.name).toBe('Tue 3 Nov');
  });
});
