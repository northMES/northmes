// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cn } from 'cn';
import { Scan, ZoomIn, ZoomOut } from 'lucide-react';
import { IconButton } from '../../../../ui/components/icon-button/index.ts';
import { type Zoom, zoomClamp } from '../../timeline/time-scale.ts';

export interface ZoomOverlayProps {
  /** The zoom drawn: its width disables a step at the clamp, and its band names the group. */
  readonly zoom: Zoom;
  /** Zoom in or Zoom out by a factor of 2 (ADR 0090). */
  readonly onZoomStep: (direction: 'in' | 'out') => void;
  readonly onZoomToFit: () => void;
  /** Where the overlay sits over the time area, such as its lower right corner. */
  readonly className?: string;
}

/**
 * The zoom buttons over the time area of the board and the Gantt (ADR 0090, Gestures, buttons and
 * keys): Zoom out, Zoom in and Zoom to fit as small icon buttons. They sit outside the grid and
 * after it in the tab order, so the grid's rows stay whole. At a clamp a step is disabled through
 * aria-disabled, so the button the planner pressed to reach it keeps focus. The band is on the
 * group as data, for the specs.
 */
export function ZoomOverlay({ zoom, onZoomStep, onZoomToFit, className }: ZoomOverlayProps) {
  const coarsest = zoom.pxPerHour <= zoomClamp.min;
  const finest = zoom.pxPerHour >= zoomClamp.max;
  return (
    <fieldset
      aria-label="Zoom"
      data-zoom-band={zoom.band}
      className={cn(
        'flex items-center gap-1 rounded-md border border-border bg-card p-0.5 shadow-sm',
        className,
      )}
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
 * 2.4.11): three 32 px buttons, their gaps and the frame, and the 12 px it sits from the edges.
 */
export const zoomOverlayReserve = { bottom: '3.5rem', end: '8.5rem' } as const;
