// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import type { ZoomLevel } from '../gantt-data.ts';
import {
  type ClosedWindow,
  createTimeScale,
  naturalWidthPx,
  type TimeRange,
  zoomLevelIds,
  zoomLevels,
} from './time-scale.ts';
import {
  anchorAt,
  anchoredScrollLeft,
  createPinchZoom,
  createWheelZoom,
  fitView,
  type GridLayout,
  rangeAround,
  type ZoomPlant,
} from './zoom-view.ts';

const stockholm = 'Europe/Stockholm';
const plant: ZoomPlant = { timeZone: stockholm, productionDayStart: '06:00' };
/** A grid of 1 400 px whose tree columns, 420 px, all stick. */
const layout: GridLayout = { clientWidth: 1400, treeWidth: 420, stickyWidth: 420 };

/** Nights from 22:00 to 06:00 plant time around a range, for Hide closed time. */
function nightsOf(range: TimeRange): ClosedWindow[] {
  const nights: ClosedWindow[] = [];
  const day = 86_400_000;
  // 21:00 UTC is 22:00 in winter and 23:00 in summer: a night of 7 or 8 hours either way.
  for (let ms = range.fromMs - (range.fromMs % day) - day; ms < range.toMs + day; ms += day) {
    nights.push({ fromMs: ms + 21 * 3_600_000, toMs: ms + 29 * 3_600_000 });
  }
  return nights;
}

/**
 * The screen's layout of a level around an anchor: the range rangeAround picks, its scale at the
 * time column's width, and the scroll position the browser clamps the anchored one to.
 */
function zoomedTo(zoom: ZoomLevel, ms: number, viewportX: number, hidden: boolean) {
  const at = hidden ? { ...plant, closedOf: nightsOf } : plant;
  const { range } = rangeAround({ ms, viewportX }, layout, zoom, at);
  const closed = hidden ? nightsOf(range) : undefined;
  const hideClosed = closed === undefined ? undefined : { closed };
  const widthPx = Math.max(
    layout.clientWidth - layout.treeWidth,
    Math.ceil(naturalWidthPx(range, zoom, hideClosed)),
  );
  const scale = createTimeScale({
    range,
    zoom,
    timeZone: stockholm,
    productionDayStart: '06:00',
    widthPx,
    ...(hideClosed !== undefined && { hideClosed }),
  });
  const maxScroll = layout.treeWidth + widthPx - layout.clientWidth;
  const scrollLeft = Math.max(
    0,
    Math.min(maxScroll, anchoredScrollLeft(scale, { ms, viewportX }, layout)),
  );
  return { scale, scrollLeft };
}

describe('a level step keeps the instant under the pointer (ADR 0089, Zoom levels)', () => {
  it('#896 takes a whole millisecond at a fractional x, such as a block edge, so the plant date of the anchor can be read', () => {
    const { scale } = zoomedTo('week', Date.UTC(2026, 10, 4, 11), 900, false);

    const anchor = anchorAt(scale, 1001, layout, 767.421875);

    expect(Number.isInteger(anchor.ms)).toBe(true);
    expect(() => rangeAround(anchor, layout, 'day', plant)).not.toThrow();
  });

  // Noon on the autumn and the spring clock change days in Stockholm.
  const days = [
    ['2026-10-25', Date.UTC(2026, 9, 25, 11)],
    ['2027-03-28', Date.UTC(2027, 2, 28, 10)],
  ] as const;
  const pairs = zoomLevelIds.slice(1).flatMap((coarser, index) => {
    const finer = zoomLevelIds[index] as ZoomLevel;
    return [
      [coarser, finer],
      [finer, coarser],
    ] as const;
  });

  for (const [day, noon] of days) {
    for (const hidden of [false, true]) {
      it(`#896 holds the instant within 1 px at every pair of adjacent levels on ${day}${hidden ? ' with closed time hidden' : ''}`, () => {
        for (const [fromLevel, toLevel] of pairs) {
          for (const viewportX of [430, 900, 1390]) {
            // The pointer rests on noon at the first level, at three places across the time area.
            const before = zoomedTo(fromLevel, noon, viewportX, hidden);
            const anchor = anchorAt(before.scale, before.scrollLeft, layout, viewportX);
            expect(Math.abs(anchor.ms - noon)).toBeLessThan(
              3_600_000 / zoomLevels[fromLevel].pxPerHour,
            );

            const after = zoomedTo(toLevel, anchor.ms, viewportX, hidden);
            const x = after.scale.x(anchor.ms) + layout.treeWidth - after.scrollLeft;
            expect(
              Math.abs(x - viewportX),
              `${fromLevel} to ${toLevel} at ${viewportX}`,
            ).toBeLessThanOrEqual(1);
          }
        }
      });
    }
  }
});

describe('Zoom to fit (ADR 0089, Zoom levels)', () => {
  // The visible time area is 980 px.
  const tue = Date.UTC(2026, 10, 3, 5);

  it('#896 picks the finest level whose natural width holds the span and a snap step each side, and centres it', () => {
    // 30 h: at Day 32 h of 48 px is 1 536 px, too wide; at Week 38 h of 16 px is 608 px.
    const span = { fromMs: tue, toMs: tue + 30 * 3_600_000 };

    const { zoom, anchor } = fitView(span, layout, plant);

    expect(zoom).toBe('week');
    expect(anchor).toEqual({ ms: tue - 4 * 3_600_000, viewportX: 420 + (980 - 608) / 2 });
  });

  it('#896 picks Quarter hours for a job order of an hour', () => {
    expect(fitView({ fromMs: tue, toMs: tue + 3_600_000 }, layout, plant).zoom).toBe(
      'quarter-hours',
    );
  });

  it('#896 counts the closed time Hide closed time compresses', () => {
    // Two days and a night: 54 h at Day is 2 688 px plain; with the nights hidden it does not fit
    // either, and at Week 70 h is 1 120 px plain, but 70 h less two 8 h nights is 54 h, 864 px
    // and two 6 px gaps.
    const span = { fromMs: tue, toMs: tue + 62 * 3_600_000 };

    expect(fitView(span, layout, plant).zoom).toBe('4weeks');
    expect(fitView(span, layout, { ...plant, closedOf: nightsOf }).zoom).toBe('week');
  });

  it('#896 puts the start of a span no level holds at the centre of the coarsest level', () => {
    const span = { fromMs: tue, toMs: tue + 20 * 365 * 86_400_000 };

    expect(fitView(span, layout, plant)).toEqual({
      zoom: 'year',
      anchor: { ms: tue, viewportX: 420 + 490 },
    });
  });
});

describe('the Ctrl+wheel gesture (ADR 0089, Zoom levels)', () => {
  it('#896 steps one level per gesture: in on a wheel up, out on a wheel down', () => {
    const step = createWheelZoom(200);

    // A pinch of five events 16 ms apart steps once.
    expect([0, 16, 32, 48, 64].map((at) => step(-4, at))).toEqual([
      'in',
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    // After a pause the next notch is a gesture of its own.
    expect(step(100, 400)).toBe('out');
    expect(step(100, 450)).toBeUndefined();
  });

  it('#896 waits for an event that moves before it steps', () => {
    const step = createWheelZoom(200);

    expect(step(0, 0)).toBeUndefined();
    expect(step(-3, 10)).toBe('in');
  });
});

describe('the pinch gesture (ADR 0089, Zoom levels)', () => {
  it('#896 steps one level per pinch once the fingers spread or close by a quarter', () => {
    const pinch = createPinchZoom();

    pinch.start();
    // Safari's gesture scale, or the distance between two touches over the distance at the start.
    expect(pinch.move(1.1)).toBeUndefined();
    expect(pinch.move(1.3)).toBe('in');
    expect(pinch.move(2)).toBeUndefined();
    pinch.start();
    expect(pinch.move(0.9)).toBeUndefined();
    expect(pinch.move(0.75)).toBe('out');
    expect(pinch.move(0.5)).toBeUndefined();
  });
});
