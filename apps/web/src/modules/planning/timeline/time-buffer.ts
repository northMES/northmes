// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The endless axis (ADR 0089): the view draws a buffer of three viewport widths of drawn axis and
// moves it by one viewport width when the view comes within a quarter width of an edge, with the
// scroll position corrected by the moved pixels, as DayPilot's infinite scrolling does. Three
// widths against the viewport, both margins and one move (two and a half) mean one move never
// triggers another.
import {
  createTimeScale,
  naturalWidthPx,
  type TimeRange,
  type TimeScale,
  type ZoomLike,
  zoomOf,
} from './time-scale.ts';
import type { ZoomPlant } from './zoom-view.ts';

/** The buffer's width in viewport widths. */
export const bufferViewports = 3;

/** The margin at each edge that moves the buffer, in viewport widths. */
const edgeMargin = 1 / 4;

const hour = 3_600_000;

/**
 * The time scale of a range at the zoom's width per hour, with closed time hidden when the plant
 * says so.
 */
export function bufferScale(range: TimeRange, zoom: ZoomLike, plant: ZoomPlant): TimeScale {
  const closed = plant.closedOf?.(range);
  const hideClosed = closed === undefined ? undefined : { closed };
  const { band, pxPerHour } = zoomOf(zoom);
  return createTimeScale({
    range,
    zoom: band,
    pxPerHour,
    timeZone: plant.timeZone,
    productionDayStart: plant.productionDayStart,
    widthPx: naturalWidthPx(range, zoom, hideClosed),
    ...(hideClosed !== undefined && { hideClosed }),
  });
}

/**
 * The instant a drawn distance before or after another at a zoom: the span grows until its width
 * holds the distance, and the scale of that span reads the instant, gaps included.
 */
export function instantAtDistance(
  fromMs: number,
  distancePx: number,
  direction: 'before' | 'after',
  zoom: ZoomLike,
  plant: ZoomPlant,
): number {
  if (distancePx <= 0) return fromMs;
  // Whole milliseconds, as the plant clock reads only those (ADR 0024).
  let spanMs = Math.ceil((distancePx / zoomOf(zoom).pxPerHour) * hour);
  // Hidden closed time is at most a few times the open time, so a few doublings suffice; the
  // bound only guards a calendar with no open time at all.
  for (let step = 0; step < 16; step += 1) {
    const range =
      direction === 'after'
        ? { fromMs, toMs: fromMs + spanMs }
        : { fromMs: fromMs - spanMs, toMs: fromMs };
    const scale = bufferScale(range, zoom, plant);
    if (scale.widthPx >= distancePx) {
      return Math.round(
        direction === 'after'
          ? scale.instant(distancePx)
          : scale.instant(scale.widthPx - distancePx),
      );
    }
    spanMs *= 2;
  }
  return direction === 'after' ? fromMs + spanMs : fromMs - spanMs;
}

/** The buffer of a zoom that holds an instant at an x: three viewport widths of drawn axis. */
export function bufferAround({
  anchorMs,
  anchorX,
  viewportPx,
  zoom,
  plant,
}: {
  readonly anchorMs: number;
  /** The x in the buffer where the anchor lies, from 0 to three viewport widths. */
  readonly anchorX: number;
  readonly viewportPx: number;
  readonly zoom: ZoomLike;
  readonly plant: ZoomPlant;
}): TimeRange {
  const widthPx = bufferViewports * viewportPx;
  const x = Math.max(0, Math.min(widthPx, anchorX));
  // An anchor read at a fractional x is a fractional instant; the plant clock takes whole ones.
  const atMs = Math.round(anchorMs);
  return {
    fromMs: instantAtDistance(atMs, x, 'before', zoom, plant),
    toMs: instantAtDistance(atMs, widthPx - x, 'after', zoom, plant),
  };
}

/**
 * A move of the buffer: its new range, the instant at the view's start that keeps its place, and
 * the pixels the scroll position moves by to keep it there.
 */
export interface BufferMove {
  readonly range: TimeRange;
  readonly anchorMs: number;
  readonly correctionPx: number;
}

/**
 * The move of the buffer for a view that starts at an x, or none while the view keeps a quarter
 * width from both edges. The instant at the view's start keeps its place on screen: the buffer
 * moves by one viewport width, and the correction is where that instant lies in the new buffer
 * less where it lay, so a gap the old edge cut cannot shift the view.
 */
export function movedBuffer({
  scale,
  viewStartX,
  viewportPx,
  plant,
}: {
  readonly scale: TimeScale;
  readonly viewStartX: number;
  readonly viewportPx: number;
  readonly plant: ZoomPlant;
}): BufferMove | undefined {
  if (viewportPx <= 0) return undefined;
  const margin = edgeMargin * viewportPx;
  let anchorX: number;
  if (viewStartX < margin) anchorX = viewStartX + viewportPx;
  else if (viewStartX + viewportPx > scale.widthPx - margin) anchorX = viewStartX - viewportPx;
  else return undefined;
  const anchorMs = Math.round(scale.instant(viewStartX));
  const zoom = { band: scale.zoom, pxPerHour: scale.pxPerHour };
  const range = bufferAround({ anchorMs, anchorX, viewportPx, zoom, plant });
  const correctionPx = bufferScale(range, zoom, plant).x(anchorMs) - viewStartX;
  return { range, anchorMs, correctionPx };
}

/**
 * The span of time in view, from the x where the view starts to where it ends, to the whole
 * millisecond. It names open time: a view that starts inside a hidden closed window starts where
 * the window ends, and one whose end or last whole pixel lies inside it ends where it starts. A
 * fraction of a gap's few pixels spans hours, so without these rules the range text would jump
 * between the days around a gap as the browser rounds the scroll position.
 */
export function visibleSpan(scale: TimeScale, viewStartX: number, viewportPx: number): TimeRange {
  const startMs = Math.round(scale.instant(viewStartX));
  const endMs = Math.round(scale.instant(viewStartX + viewportPx));
  const lastPixelMs = scale.instant(viewStartX + Math.max(0, viewportPx - 1));
  const gapAt = (ms: number) => scale.gaps.find((gap) => gap.fromMs < ms && ms < gap.toMs);
  const fromMs = gapAt(startMs)?.toMs ?? startMs;
  const toMs = (gapAt(endMs) ?? gapAt(lastPixelMs))?.fromMs ?? endMs;
  // A view narrower than the gap it lies in shows no open time.
  return { fromMs, toMs: Math.max(fromMs, toMs) };
}
