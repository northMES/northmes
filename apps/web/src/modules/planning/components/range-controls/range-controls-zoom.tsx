// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { ChevronDown, Scan, ZoomIn, ZoomOut } from 'lucide-react';
import { IconButton } from '../../../../ui/components/icon-button/index.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../../../ui/primitives/dropdown-menu.tsx';
import type { ZoomLevel } from '../../gantt-data.ts';
import { type Zoom, zoomClamp, zoomLevelIds, zoomLevels } from '../../timeline/time-scale.ts';

export interface ZoomControlsProps {
  /** The zoom drawn: its band names the menu, its width disables a step at the clamp. */
  readonly zoom: Zoom;
  /** A level from the menu, at its natural width. */
  readonly onZoomChange: (zoom: ZoomLevel) => void;
  /** Zoom in or Zoom out by a factor of 2 (ADR 0090). */
  readonly onZoomStep: (direction: 'in' | 'out') => void;
  readonly onZoomToFit: () => void;
}

/**
 * The zoom of the board and the Gantt (ADR 0090, Gestures, buttons and keys): Zoom out, the menu
 * of bands, Zoom in and Zoom to fit. Each zooms around the centre of the view. At a clamp its step
 * is disabled through aria-disabled, so a button the planner pressed to reach it keeps focus.
 */
export function ZoomControls({ zoom, onZoomChange, onZoomStep, onZoomToFit }: ZoomControlsProps) {
  const coarsest = zoom.pxPerHour <= zoomClamp.min;
  const finest = zoom.pxPerHour >= zoomClamp.max;
  const band = zoom.band;
  return (
    <fieldset aria-label="Zoom" className="flex items-center gap-1">
      <IconButton
        label="Zoom out"
        variant="outline"
        size="icon-sm"
        aria-disabled={coarsest || undefined}
        className="aria-disabled:opacity-50"
        onClick={() => {
          if (!coarsest) onZoomStep('out');
        }}
      >
        <ZoomOut />
      </IconButton>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              className="h-8 min-w-28 justify-between px-3"
              aria-label={`Zoom level, ${zoomLevels[band].label}`}
            />
          }
        >
          {zoomLevels[band].label}
          <ChevronDown aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-40">
          <DropdownMenuRadioGroup
            value={band}
            onValueChange={(value: ZoomLevel) => onZoomChange(value)}
          >
            {zoomLevelIds.map((id) => (
              <DropdownMenuRadioItem key={id} value={id} closeOnClick>
                {zoomLevels[id].label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <IconButton
        label="Zoom in"
        variant="outline"
        size="icon-sm"
        aria-disabled={finest || undefined}
        className="aria-disabled:opacity-50"
        onClick={() => {
          if (!finest) onZoomStep('in');
        }}
      >
        <ZoomIn />
      </IconButton>
      <Button variant="outline" className="h-8 px-3" onClick={onZoomToFit}>
        <Scan aria-hidden />
        Zoom to fit
      </Button>
    </fieldset>
  );
}
