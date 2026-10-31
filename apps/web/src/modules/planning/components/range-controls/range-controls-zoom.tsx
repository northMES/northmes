// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Scan, ZoomIn, ZoomOut } from 'lucide-react';
import type { Ref } from 'react';
import { IconButton } from '../../../../ui/components/icon-button/index.ts';
import { type Zoom, zoomClamp } from '../../timeline/time-scale.ts';

export interface ZoomOverlayProps {
  /** The zoom drawn: its width disables a step at the clamp, and its band names the group. */
  readonly zoom: Zoom;
  /** Zoom in or Zoom out by a factor of 2 (ADR 0090). */
  readonly onZoomStep: (direction: 'in' | 'out') => void;
  readonly onZoomToFit: () => void;
  /** A gesture over the overlay zooms the timeline too, so the zoom hook takes it as a panel. */
  readonly ref?: Ref<HTMLFieldSetElement>;
}

/**
 * The zoom buttons over the time area of the board and the Gantt (ADR 0090, Gestures, buttons and
 * keys): Zoom out, Zoom in and Zoom to fit as small icon buttons. They sit outside the grid and
 * after it in the tab order, so the grid's rows stay whole. At a clamp a step is disabled through
 * aria-disabled, so the button the planner pressed to reach it keeps focus. The band is on the
 * group as data, for the specs.
 */
export function ZoomOverlay({ zoom, onZoomStep, onZoomToFit, ref }: ZoomOverlayProps) {
  const coarsest = zoom.pxPerHour <= zoomClamp.min;
  const finest = zoom.pxPerHour >= zoomClamp.max;
  return (
    <fieldset
      ref={ref}
      aria-label="Zoom"
      data-zoom-band={zoom.band}
      // Clear of a classic scrollbar, 15 px wide, at the scroller's bottom and end.
      className="absolute end-5 bottom-5 z-50 flex items-center gap-1 rounded-md border border-border bg-card p-0.5 shadow-sm"
    >
      <IconButton
        label="Zoom out"
        variant="ghost"
        size="icon-sm"
        aria-disabled={coarsest || undefined}
        className="aria-disabled:opacity-50"
        onClick={() => {
          if (!coarsest) onZoomStep('out');
        }}
      >
        <ZoomOut />
      </IconButton>
      <IconButton
        label="Zoom in"
        variant="ghost"
        size="icon-sm"
        aria-disabled={finest || undefined}
        className="aria-disabled:opacity-50"
        onClick={() => {
          if (!finest) onZoomStep('in');
        }}
      >
        <ZoomIn />
      </IconButton>
      <IconButton label="Zoom to fit" variant="ghost" size="icon-sm" onClick={onZoomToFit}>
        <Scan />
      </IconButton>
    </fieldset>
  );
}

/**
 * The space the overlay takes in the time scroller's corner, which `scroll-padding` reserves at
 * the scroller's bottom and end, so a focused block scrolled into view is never under it (WCAG
 * 2.4.11): its buttons at the target size, their two 4 px gaps, its 3 px frame each side, the
 * 20 px it sits from the edges and 8 px of room.
 */
export const zoomOverlayReserve = {
  bottom: 'calc(var(--nm-target-min) + 34px)',
  end: 'calc(3 * var(--nm-target-min) + 42px)',
} as const;
