// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import type { ZoomLevel } from '../gantt-data.ts';
import { bufferAround, bufferScale } from './time-buffer.ts';
import {
  bandOf,
  type ClosedWindow,
  naturalWidthPx,
  type TimeRange,
  type Zoom,
  zoomLevelIds,
  zoomLevels,
} from './time-scale.ts';
import {
  anchorAt,
  anchoredScrollLeft,
  fitView,
  type GridLayout,
  steppedZoom,
  wheelFactor,
  type ZoomPlant,
  zoomedBy,
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
 * The screen's layout of a level around an anchor: the buffer the view builds with the anchor at
 * its viewport x (ADR 0089, The endless axis), its scale, and the scroll position the browser
 * clamps the anchored one to.
 */
function zoomedTo(zoom: ZoomLevel | Zoom, ms: number, viewportX: number, hidden: boolean) {
  const at = hidden ? { ...plant, closedOf: nightsOf } : plant;
  const viewportPx = layout.clientWidth - layout.stickyWidth;
  const range = bufferAround({
    anchorMs: ms,
    anchorX: viewportPx + viewportX - layout.stickyWidth,
    viewportPx,
    zoom,
    plant: at,
  });
  const scale = bufferScale(range, zoom, at);
  const maxScroll = layout.treeWidth + scale.widthPx - layout.clientWidth;
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
    expect(() => zoomedTo('day', anchor.ms, 900, false)).not.toThrow();
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

describe('a smooth zoom keeps the instant under the pointer (ADR 0090, Gestures, buttons and keys)', () => {
  it('#941 multiplies the zoom by exp(0.2) for a Ctrl+wheel deltaY of -100 in pixel mode', () => {
    expect(wheelFactor({ deltaY: -100, deltaMode: 0 }, 600)).toBeCloseTo(Math.exp(0.2), 12);
    // A line counts as 16 px and a page as the time area's height.
    expect(wheelFactor({ deltaY: 3, deltaMode: 1 }, 600)).toBeCloseTo(Math.exp(-0.096), 12);
    expect(wheelFactor({ deltaY: 1, deltaMode: 2 }, 600)).toBeCloseTo(Math.exp(-1.2), 12);
  });

  const days = [
    ['2026-10-25', Date.UTC(2026, 9, 25, 11)],
    ['2027-03-28', Date.UTC(2027, 2, 28, 10)],
  ] as const;
  for (const [day, noon] of days) {
    for (const hidden of [false, true]) {
      it(`#941 holds the pointer's instant within 1 px through 50 events of deltaY -4 on ${day}${hidden ? ' with closed time hidden' : ''}`, () => {
        for (const viewportX of [430, 900, 1390]) {
          let zoom: Zoom = { band: 'week', pxPerHour: 16 };
          let view = zoomedTo(zoom, noon, viewportX, hidden);
          for (let event = 0; event < 50; event += 1) {
            const anchor = anchorAt(view.scale, view.scrollLeft, layout, viewportX);
            zoom = zoomedBy(zoom, wheelFactor({ deltaY: -4, deltaMode: 0 }, 600));
            view = zoomedTo(zoom, anchor.ms, viewportX, hidden);
            const x = view.scale.x(anchor.ms) + layout.treeWidth - view.scrollLeft;
            expect(Math.abs(x - viewportX), `event ${event} at ${viewportX}`).toBeLessThanOrEqual(
              1,
            );
          }
          // 50 events of exp(0.008) take Week to about 23.9 px an hour, still in the Week band.
          expect(zoom.pxPerHour).toBeCloseTo(16 * Math.exp(0.4), 6);
        }
      });
    }
  }

  it('#941 Zoom in from 16 gives 32 and Zoom out gives 8, within the clamp', () => {
    expect(steppedZoom(16, 'in')).toBe(32);
    expect(steppedZoom(16, 'out')).toBe(8);
    expect(steppedZoom(200, 'in')).toBe(240);
    expect(steppedZoom(0.2, 'out')).toBe(0.15);
  });

  it('#941 keeps the band of a gesture until the zoom is a factor of 1.1 past its edge', () => {
    // The Week to Day edge lies at about 27.7 px an hour.
    expect(zoomedBy({ band: 'week', pxPerHour: 27 }, 1.05)).toEqual({
      band: 'week',
      pxPerHour: 28.35,
    });
    expect(zoomedBy({ band: 'week', pxPerHour: 28.35 }, 1.1).band).toBe('day');
  });
});

describe('Zoom to fit (ADR 0090, Gestures, buttons and keys)', () => {
  // The visible time area is 980 px.
  const tue = Date.UTC(2026, 10, 3, 5);
  const availablePx = 980;

  /** Whether a fit lies in the band it was fitted for and fills the view with the padded span. */
  function expectFitted(span: TimeRange, fitPlant: ZoomPlant) {
    const { zoom, anchor } = fitView(span, layout, fitPlant);
    expect(bandOf(zoom.pxPerHour)).toBe(zoom.band);
    const { stepMs } = zoomLevels[zoom.band];
    const padded = { fromMs: span.fromMs - stepMs, toMs: span.toMs + stepMs };
    const closed = fitPlant.closedOf?.(padded);
    const widthPx = naturalWidthPx(padded, zoom, closed === undefined ? undefined : { closed });
    expect(Math.abs(widthPx - availablePx)).toBeLessThanOrEqual(1);
    expect(anchor.ms).toBe(padded.fromMs);
    expect(anchor.viewportX).toBeCloseTo(420, 6);
    return zoom;
  }

  it('#941 fits a span and a snap step of its band on each side into the view, in the band it was fitted for', () => {
    // 30 h: Quarter hours and Hours would need about 32 px an hour, which is Day; at Day, 32 h fit
    // at 30.625 px an hour.
    const zoom = expectFitted({ fromMs: tue, toMs: tue + 30 * 3_600_000 }, plant);

    expect(zoom.band).toBe('day');
    expect(zoom.pxPerHour).toBeCloseTo(30.625, 9);
  });

  it('#941 fits a span of 4 h at Quarter hours, below the clamp', () => {
    // 4 h and 5 min each side at 980 / (4 h 10 min), 235.2 px an hour.
    const zoom = expectFitted({ fromMs: tue, toMs: tue + 4 * 3_600_000 }, plant);

    expect(zoom.band).toBe('quarter-hours');
    expect(zoom.pxPerHour).toBeCloseTo(235.2, 9);
  });

  it('#941 counts the closed time Hide closed time compresses at the fitted zoom', () => {
    const span = { fromMs: tue, toMs: tue + 62 * 3_600_000 };

    const plainFit = expectFitted(span, plant);
    const hiddenFit = expectFitted(span, { ...plant, closedOf: nightsOf });

    expect(hiddenFit.pxPerHour).toBeGreaterThan(plainFit.pxPerHour);
  });

  it('#941 puts the start of a span no band holds at the centre of the coarsest clamp', () => {
    const span = { fromMs: tue, toMs: tue + 20 * 365 * 86_400_000 };

    expect(fitView(span, layout, plant)).toEqual({
      zoom: { band: 'year', pxPerHour: 0.15 },
      anchor: { ms: tue, viewportX: 420 + 490 },
    });
  });

  it('#941 clamps a span shorter than the finest width fills to 240 px an hour, centred', () => {
    // Five minutes and a step of five minutes each side, 15 min, is 60 px at 240 px an hour.
    const span = { fromMs: tue, toMs: tue + 5 * 60_000 };

    expect(fitView(span, layout, plant)).toEqual({
      zoom: { band: 'quarter-hours', pxPerHour: 240 },
      anchor: { ms: tue - 5 * 60_000, viewportX: 420 + (980 - 60) / 2 },
    });
  });
});
