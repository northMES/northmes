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
import { steppedLevel, zoomLevelIds, zoomLevels } from '../../timeline/time-scale.ts';

export interface ZoomControlsProps {
  readonly zoom: ZoomLevel;
  readonly onZoomChange: (zoom: ZoomLevel) => void;
  readonly onZoomToFit: () => void;
}

/**
 * The zoom of the board and the Gantt (ADR 0089, Zoom levels): Zoom out, the level menu, Zoom in
 * and Zoom to fit. Each zooms around the centre of the view. At an end of the ladder its step is
 * disabled through aria-disabled, so a button the planner pressed to reach the end keeps focus.
 */
export function ZoomControls({ zoom, onZoomChange, onZoomToFit }: ZoomControlsProps) {
  const coarser = steppedLevel(zoom, 'out');
  const finer = steppedLevel(zoom, 'in');
  return (
    <fieldset aria-label="Zoom" className="flex items-center gap-1">
      <IconButton
        label="Zoom out"
        variant="outline"
        size="icon-sm"
        aria-disabled={coarser === zoom || undefined}
        className="aria-disabled:opacity-50"
        onClick={() => {
          if (coarser !== zoom) onZoomChange(coarser);
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
              aria-label={`Zoom level, ${zoomLevels[zoom].label}`}
            />
          }
        >
          {zoomLevels[zoom].label}
          <ChevronDown aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-40">
          <DropdownMenuRadioGroup
            value={zoom}
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
        aria-disabled={finer === zoom || undefined}
        className="aria-disabled:opacity-50"
        onClick={() => {
          if (finer !== zoom) onZoomChange(finer);
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
