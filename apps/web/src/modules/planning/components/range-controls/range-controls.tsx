// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useId } from 'react';
import { IconButton } from '../../../../ui/components/icon-button/index.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import type { ZoomLevel, ZoomPreset } from '../../gantt-data.ts';
import { zoomLevels, zoomPresetIds } from '../../timeline/time-scale.ts';
import { PressedGroup } from './range-controls-pressed-group.tsx';

export interface RangeControlsProps {
  /** The name of the preset group: "Zoom" on the Gantt (D5), "Range" on the job order table (T1). */
  readonly presetLabel: string;
  /** The level shown; a level of the ladder that is no preset leaves every preset unpressed. */
  readonly zoom: ZoomLevel;
  readonly onZoomChange: (zoom: ZoomPreset) => void;
  /** The first plant date of the range, "2026-11-02", which Go to date edits. */
  readonly from: string;
  readonly onFromChange: (from: string) => void;
  readonly onEarlier: () => void;
  readonly onNow: () => void;
  readonly onLater: () => void;
  /** The range as text, "W45, Mon 2 Nov to Sun 8 Nov". */
  readonly rangeLabel: string;
}

/**
 * The range controls the timeline pages share (plan 18, Shared pieces; D5): the preset group,
 * Earlier, Now and Later, Go to date and the range as text. Zoom and from go to the URL, so a link
 * from one page to another carries them (Krister, 2026-10-17).
 */
export function RangeControls({
  presetLabel,
  zoom,
  onZoomChange,
  from,
  onFromChange,
  onEarlier,
  onNow,
  onLater,
  rangeLabel,
}: RangeControlsProps) {
  const dateId = useId();
  return (
    <>
      <PressedGroup
        label={presetLabel}
        choices={zoomPresetIds.map((id) => ({ id, label: zoomLevels[id].label }))}
        value={zoom}
        onChange={onZoomChange}
      />
      <IconButton label="Show earlier range" variant="outline" size="icon-sm" onClick={onEarlier}>
        <ChevronLeft />
      </IconButton>
      <Button variant="outline" className="h-8 px-3" onClick={onNow}>
        Now
      </Button>
      <IconButton label="Show later range" variant="outline" size="icon-sm" onClick={onLater}>
        <ChevronRight />
      </IconButton>
      <label htmlFor={dateId} className="flex items-center gap-1.5 text-sm">
        <Calendar aria-hidden className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Go to date</span>
        <input
          id={dateId}
          type="date"
          value={from}
          onChange={(event) => {
            if (event.target.value !== '') onFromChange(event.target.value);
          }}
          className="h-8 rounded-md border border-input bg-background px-2 font-mono text-xs"
        />
      </label>
      <span className="font-mono text-data font-medium whitespace-nowrap">{rangeLabel}</span>
    </>
  );
}
