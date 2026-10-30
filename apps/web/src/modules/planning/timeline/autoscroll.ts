// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic

/** How near an edge of the time area a dragging pointer starts to scroll it, in px. */
export const autoscrollMarginPx = 48;

/** The most a frame of 1/60 s scrolls, with the pointer at an edge or past it, in px. */
export const autoscrollMaxPx = 24;

/** What a step in keyboard move mode keeps in view of the focused block, in px (WCAG 2.4.11). */
const keepVisiblePx = 8;

/** The visible part of a time area in client coordinates, past its sticky columns and header. */
export interface VisibleArea {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** The scroll of one axis: none outside the margin, faster the closer the pointer is to an edge. */
function axisStep(at: number, from: number, to: number): number {
  const before = at - from;
  const after = to - at;
  if (before < autoscrollMarginPx && before <= after) {
    // Never -0, so no scroll reads as 0.
    return -Math.round(autoscrollMaxPx * Math.min(1, 1 - before / autoscrollMarginPx)) || 0;
  }
  if (after < autoscrollMarginPx) {
    return Math.round(autoscrollMaxPx * Math.min(1, 1 - after / autoscrollMarginPx));
  }
  return 0;
}

/**
 * The scroll of one frame while a block is dragged (#899; DHTMLX autoscroll): within the margin of
 * an edge of the visible time area the view scrolls towards that edge, faster the closer the
 * pointer is, at the most speed at the edge and past it.
 */
export function autoscrollStep(
  pointer: { readonly x: number; readonly y: number },
  area: VisibleArea,
): { readonly dx: number; readonly dy: number } {
  return {
    dx: axisStep(pointer.x, area.left, area.right),
    dy: axisStep(pointer.y, area.top, area.bottom),
  };
}

/**
 * The visible time area of a scroller: its padding box less the scroll padding that keeps targets
 * clear of its sticky columns and header (WCAG 2.4.11).
 */
export function visibleAreaOf(scroller: HTMLElement): VisibleArea {
  const box = scroller.getBoundingClientRect();
  const style = getComputedStyle(scroller);
  const inset = (value: string) => {
    const px = Number.parseFloat(value);
    return Number.isFinite(px) && value.endsWith('px') ? px : 0;
  };
  const left = box.left + scroller.clientLeft;
  const top = box.top + scroller.clientTop;
  return {
    left: left + inset(style.scrollPaddingInlineStart || style.scrollPaddingLeft),
    top: top + inset(style.scrollPaddingTop),
    right: left + scroller.clientWidth,
    bottom: top + scroller.clientHeight,
  };
}

/**
 * The sideways scroll that brings a move preview into the visible time area after a step in
 * keyboard move mode (#899): by what it overhangs an edge, keeping its start in view when it is
 * wider than the area, and never so far that the focused block, which keeps the focus during the
 * move, leaves fewer than 8 px in view (WCAG 2.4.11).
 */
export function revealDelta(
  target: { readonly left: number; readonly right: number },
  area: { readonly left: number; readonly right: number },
  keep?: { readonly left: number; readonly right: number },
): number {
  let delta = 0;
  if (target.right > area.right)
    delta = Math.min(target.right - area.right, target.left - area.left);
  else if (target.left < area.left) delta = target.left - area.left;
  if (keep === undefined) return delta;
  if (delta > 0) return Math.min(delta, Math.max(0, keep.right - area.left - keepVisiblePx));
  if (delta < 0) return Math.max(delta, Math.min(0, keep.left - area.right + keepVisiblePx));
  return 0;
}
