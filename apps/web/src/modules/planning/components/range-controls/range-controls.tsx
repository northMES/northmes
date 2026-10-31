// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { IconButton } from '../../../../ui/components/icon-button/index.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import type { ZoomPreset } from '../../gantt-data.ts';
import { zoomLevels, zoomPresetIds } from '../../timeline/time-scale.ts';
import { PressedGroup } from './range-controls-pressed-group.tsx';

export interface RangeControlsProps {
  /** The zoom group first: the job order table's PresetControls. */
  readonly zoomControls: ReactNode;
  /** The plant date of the range's start or of the visible start, which Go to date edits. */
  readonly from: string;
  readonly onFromChange: (from: string) => void;
  readonly onEarlier: () => void;
  readonly onNow: () => void;
  readonly onLater: () => void;
  /**
   * The range as text, "W45, Mon 2 Nov to Sun 8 Nov": the chosen range on the job order table, the
   * span in view on the board and the Gantt.
   */
  readonly rangeLabel: ReactNode;
}

/**
 * The range controls of the job order table (plan 18, Shared pieces; D5): the zoom group,
 * Earlier, Now and Later, Go to date and the range as text. The board and the Gantt have the slim
 * bar and the zoom buttons over the time area instead (ADR 0090). Zoom and from go to the URL, so a link
 * from one page to another carries them (Krister, 2026-10-17).
 */
export function RangeControls({
  zoomControls,
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
      {zoomControls}
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
      <span data-range-text className="font-mono text-data font-medium whitespace-nowrap">
        {rangeLabel}
      </span>
    </>
  );
}

/** The four presets of D3 as a pressed group: the job order table's Range (ADR 0089). */
export function PresetControls({
  label,
  zoom,
  onZoomChange,
}: {
  readonly label: string;
  readonly zoom: ZoomPreset;
  readonly onZoomChange: (zoom: ZoomPreset) => void;
}) {
  return (
    <PressedGroup
      label={label}
      choices={zoomPresetIds.map((id) => ({ id, label: zoomLevels[id].label }))}
      value={zoom}
      onChange={onZoomChange}
    />
  );
}
