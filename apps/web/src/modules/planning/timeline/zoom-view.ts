// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Zooming the view (ADR 0089, Zoom levels): the range of a level around the instant that stays in
// place, the scroll position that keeps it there, the level and anchor of Zoom to fit, and the
// wheel gesture that steps one level.
import type { ZoomLevel } from '../gantt-data.ts';
import {
  type ClosedWindow,
  createTimeScale,
  extendedRange,
  naturalWidthPx,
  plantDateOf,
  type TimeRange,
  type TimeScale,
  zoomLevelIds,
  zoomLevels,
} from './time-scale.ts';

/** An instant the view holds in place, and the x in the grid's viewport where it stays. */
export interface ViewAnchor {
  readonly ms: number;
  readonly viewportX: number;
}

/**
 * The grid across: its viewport width, where the time column starts in the scrolled content, and
 * the width of the sticky columns that cover the time column's left part.
 */
export interface GridLayout {
  readonly clientWidth: number;
  readonly treeWidth: number;
  readonly stickyWidth: number;
}

/** The plant clock a range is laid on, and the closed time Hide closed time compresses, if on. */
export interface ZoomPlant {
  readonly timeZone: string;
  readonly productionDayStart: string;
  /** The closed windows of a range while Hide closed time is on; undefined while it is off. */
  readonly closedOf?: (range: TimeRange) => readonly ClosedWindow[];
}

/** The range of a level as the URL's from and the spans it is extended by. */
export interface AnchoredRange {
  readonly from: string;
  readonly extension: { readonly before: number; readonly after: number };
  readonly range: TimeRange;
}

/** The time scale of a range at its natural width, as the screens lay a range out. */
function naturalScale(range: TimeRange, zoom: ZoomLevel, plant: ZoomPlant): TimeScale {
  const closed = plant.closedOf?.(range);
  const hideClosed = closed === undefined ? undefined : { closed };
  return createTimeScale({
    range,
    zoom,
    timeZone: plant.timeZone,
    productionDayStart: plant.productionDayStart,
    widthPx: naturalWidthPx(range, zoom, hideClosed),
    ...(hideClosed !== undefined && { hideClosed }),
  });
}

/**
 * The range of a level that holds an anchor where it is: from the plant date of the anchor,
 * extended by whole spans until the time before the anchor fills the viewport left of it and the
 * time after it fills the viewport right of it, so the scroll position that keeps the anchor in
 * place lies inside the scrollable width.
 */
export function rangeAround(
  anchor: ViewAnchor,
  layout: GridLayout,
  zoom: ZoomLevel,
  plant: ZoomPlant,
): AnchoredRange {
  const from = plantDateOf(anchor.ms, plant.timeZone);
  const beforePx = anchor.viewportX - layout.treeWidth;
  const afterPx = layout.clientWidth - anchor.viewportX;
  let before = 0;
  let after = 0;
  // A span holds at least a few hundred pixels at every level, so a few steps suffice; the bound
  // only guards a viewport wider than any range would ever need.
  for (let step = 0; step < 64; step += 1) {
    const range = extendedRange(from, zoom, plant.timeZone, plant.productionDayStart, {
      before,
      after,
    });
    const scale = naturalScale(range, zoom, plant);
    const x = scale.x(anchor.ms);
    if (x < beforePx) before += 1;
    else if (scale.widthPx - x < afterPx) after += 1;
    else return { from, extension: { before, after }, range };
  }
  return {
    from,
    extension: { before, after },
    range: extendedRange(from, zoom, plant.timeZone, plant.productionDayStart, { before, after }),
  };
}

/** The scroll position that puts an anchor's instant at its viewport x. */
export function anchoredScrollLeft(
  scale: TimeScale,
  anchor: ViewAnchor,
  layout: GridLayout,
): number {
  return scale.x(anchor.ms) + layout.treeWidth - anchor.viewportX;
}

/**
 * The instant at a viewport x of the grid scrolled to a position, to the whole millisecond: a
 * block's edge lies at a fractional x, and the plant clock reads whole milliseconds only.
 */
export function anchorAt(
  scale: TimeScale,
  scrollLeft: number,
  layout: GridLayout,
  viewportX: number,
): ViewAnchor {
  return { ms: Math.round(scale.instant(scrollLeft + viewportX - layout.treeWidth)), viewportX };
}

/** The instant at the centre of the visible time area, where the toolbar and the keys zoom. */
export function centreAnchor(scale: TimeScale, scrollLeft: number, layout: GridLayout): ViewAnchor {
  const viewportX = layout.stickyWidth + (layout.clientWidth - layout.stickyWidth) / 2;
  return anchorAt(scale, scrollLeft, layout, viewportX);
}

/**
 * Zoom to fit (ADR 0089): the finest level whose natural width holds the span, with one snap step
 * of that level on each side, in the visible time area, with the span centred. When no level
 * fits, the coarsest level with the span's start at the centre.
 */
export function fitView(
  span: TimeRange,
  layout: GridLayout,
  plant: ZoomPlant,
): { readonly zoom: ZoomLevel; readonly anchor: ViewAnchor } {
  const availablePx = layout.clientWidth - layout.stickyWidth;
  for (const zoom of zoomLevelIds) {
    const { stepMs } = zoomLevels[zoom];
    const padded = { fromMs: span.fromMs - stepMs, toMs: span.toMs + stepMs };
    const closed = plant.closedOf?.(padded);
    const widthPx = naturalWidthPx(padded, zoom, closed === undefined ? undefined : { closed });
    if (widthPx <= availablePx) {
      return {
        zoom,
        anchor: { ms: padded.fromMs, viewportX: layout.stickyWidth + (availablePx - widthPx) / 2 },
      };
    }
  }
  return {
    zoom: 'year',
    anchor: { ms: span.fromMs, viewportX: layout.stickyWidth + availablePx / 2 },
  };
}

/**
 * The step of a Ctrl+wheel or Cmd+wheel gesture: one level per gesture (ADR 0089). A gesture is a
 * run of wheel events with less than `quietMs` between them, as a trackpad pinch or a spun wheel
 * gives; its first event that scrolls up zooms in, down zooms out, and the rest of it steps none.
 */
export function createWheelZoom(
  quietMs = 200,
): (deltaY: number, timeStamp: number) => 'in' | 'out' | undefined {
  let lastAt = Number.NEGATIVE_INFINITY;
  let stepped = false;
  return (deltaY, timeStamp) => {
    if (timeStamp - lastAt > quietMs) stepped = false;
    lastAt = timeStamp;
    if (stepped || deltaY === 0) return undefined;
    stepped = true;
    return deltaY < 0 ? 'in' : 'out';
  };
}

/**
 * The step of a pinch on a touchscreen or, in Safari, on a trackpad: one level per pinch (ADR
 * 0089). `move` takes the scale since `start`, the distance between the two touches over their
 * distance at the start or Safari's gesture scale; the pinch steps in once the fingers have spread
 * by a quarter and out once they have closed by a fifth, and the rest of it steps none.
 */
export function createPinchZoom(): {
  readonly start: () => void;
  readonly move: (scale: number) => 'in' | 'out' | undefined;
} {
  let stepped = false;
  return {
    start: () => {
      stepped = false;
    },
    move: (scale) => {
      if (stepped || (scale < 1.25 && scale > 0.8)) return undefined;
      stepped = true;
      return scale >= 1.25 ? 'in' : 'out';
    },
  };
}
