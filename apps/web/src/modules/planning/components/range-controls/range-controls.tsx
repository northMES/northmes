// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cn } from 'cn';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useId } from 'react';
import { IconButton } from '../../../../ui/components/icon-button/index.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import type { ZoomPreset } from '../../gantt-data.ts';
import { zoomPresetIds, zoomPresets } from '../../timeline/time-scale.ts';

/** A group of pressed buttons, one pressed: the Zoom group of D3 and D5. */
export function PressedGroup<TValue extends string>({
  label,
  choices,
  value,
  onChange,
}: {
  readonly label: string;
  readonly choices: readonly { readonly id: TValue; readonly label: string }[];
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
}) {
  return (
    <fieldset aria-label={label} className="flex rounded-lg bg-muted p-0.5">
      {choices.map((choice) => (
        <Button
          key={choice.id}
          variant="ghost"
          aria-pressed={choice.id === value}
          onClick={() => onChange(choice.id)}
          className={cn(
            'h-7 px-2.5',
            choice.id === value && 'bg-card shadow-[inset_0_-2px_0_var(--foreground)]',
          )}
        >
          {choice.label}
        </Button>
      ))}
    </fieldset>
  );
}

export interface RangeControlsProps {
  /** The name of the preset group: "Zoom" on the Gantt (D5), "Range" on the job order table (T1). */
  readonly presetLabel: string;
  readonly zoom: ZoomPreset;
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
        choices={zoomPresetIds.map((id) => ({ id, label: zoomPresets[id].label }))}
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
        <span className="sr-only">Go to date</span>
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
