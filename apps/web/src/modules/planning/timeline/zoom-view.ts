// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Zooming the view (ADR 0090, Gestures, buttons and keys): the scroll position that keeps an
// instant in place, the factor of a wheel event, the steps of the buttons and keys, and the zoom
// and anchor of Zoom to fit.
import {
  bandDuringGesture,
  bandOf,
  type ClosedWindow,
  clampZoom,
  compressedWindows,
  gapPx,
  naturalWidthPx,
  type TimeRange,
  type TimeScale,
  type Zoom,
  zoomClamp,
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

const hour = 3_600_000;

/**
 * Zoom to fit (ADR 0090): the bands from the finest to the coarsest, each with the zoom whose width
 * holds the span and one snap step of that band on each side, closed time compressed at that zoom,
 * in the visible time area; the first zoom that lies in the band it was fitted for wins, and the
 * span is centred. A span narrower than the finest clamp fills is centred at the clamp; when no
 * band holds it, the coarsest clamp has the span's start at the centre.
 */
export function fitView(
  span: TimeRange,
  layout: GridLayout,
  plant: ZoomPlant,
): { readonly zoom: Zoom; readonly anchor: ViewAnchor } {
  const availablePx = layout.clientWidth - layout.stickyWidth;
  for (const band of zoomLevelIds) {
    const { stepMs } = zoomLevels[band];
    const padded = { fromMs: span.fromMs - stepMs, toMs: span.toMs + stepMs };
    const fitting = fittingWidth(padded, availablePx, plant);
    // Too wide even at the coarsest clamp.
    if (fitting < zoomClamp.min) break;
    const zoom = { band, pxPerHour: clampZoom(fitting) };
    if (bandOf(zoom.pxPerHour) !== band) continue;
    const closed = plant.closedOf?.(padded);
    const widthPx = naturalWidthPx(padded, zoom, closed === undefined ? undefined : { closed });
    return {
      zoom,
      anchor: { ms: padded.fromMs, viewportX: layout.stickyWidth + (availablePx - widthPx) / 2 },
    };
  }
  return {
    zoom: { band: 'year', pxPerHour: zoomClamp.min },
    anchor: { ms: span.fromMs, viewportX: layout.stickyWidth + availablePx / 2 },
  };
}

/**
 * The width per hour at which a span fills a width: its hours, or with closed time hidden its open
 * hours and a gap per compressed window. Which windows compress depends on the width, so the width
 * is found again with the windows the last guess compresses, until it settles.
 */
function fittingWidth(span: TimeRange, widthPx: number, plant: ZoomPlant): number {
  const spanMs = span.toMs - span.fromMs;
  const closed = plant.closedOf?.(span);
  let pxPerHour = (widthPx / spanMs) * hour;
  if (closed === undefined) return pxPerHour;
  for (let round = 0; round < 8; round += 1) {
    const windows = compressedWindows(closed, span, pxPerHour, gapPx);
    const closedMs = windows.reduce((sum, window) => sum + (window.toMs - window.fromMs), 0);
    const next = ((widthPx - windows.length * gapPx) / (spanMs - closedMs)) * hour;
    if (Math.abs(next - pxPerHour) <= 1e-9 * pxPerHour) return next;
    pxPerHour = next;
  }
  return pxPerHour;
}

/**
 * The factor of a Ctrl+wheel or Cmd+wheel event (ADR 0090): `exp(-deltaY * 0.002)`, with a line
 * counted as 16 px and a page as the time area's height, as d3-zoom reads a wheel.
 */
export function wheelFactor(
  event: { readonly deltaY: number; readonly deltaMode: number },
  pageHeightPx: number,
): number {
  const px = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pageHeightPx : 1;
  return Math.exp(-event.deltaY * px * 0.002);
}

/**
 * A zoom multiplied by a factor during a gesture or an animation: the width clamped, and the band
 * kept until the width is a factor of 1.1 past its edge.
 */
export function zoomedBy(zoom: Zoom, factor: number): Zoom {
  const pxPerHour = clampZoom(zoom.pxPerHour * factor);
  return { band: bandDuringGesture(pxPerHour, zoom.band), pxPerHour };
}

/** The target of Zoom in or Zoom out, or of the plus or minus key: twice or half the width. */
export function steppedZoom(pxPerHour: number, direction: 'in' | 'out'): number {
  return clampZoom(direction === 'in' ? pxPerHour * 2 : pxPerHour / 2);
}
