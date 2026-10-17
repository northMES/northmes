// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cn } from 'cn';
import { Calendar, ChevronLeft, ChevronRight, Ellipsis, FoldHorizontal } from 'lucide-react';
import { useId } from 'react';
import { ColumnsMenu } from '../../../../ui/components/columns-menu/index.ts';
import { IconButton } from '../../../../ui/components/icon-button/index.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../../../ui/primitives/dropdown-menu.tsx';
import { PressedGroup, ViewSwitch } from '../../components/view-switch/index.ts';
import type { ZoomPreset } from '../../gantt-data.ts';
import { zoomPresetIds, zoomPresets } from '../../timeline/time-scale.ts';
import type { GanttOptions } from './gantt-options.ts';
import { ganttColumnChoices } from './gantt-tree-pane.tsx';

export interface GanttToolbarProps {
  readonly zoom: ZoomPreset;
  readonly onZoomChange: (zoom: ZoomPreset) => void;
  readonly from: string;
  readonly onFromChange: (from: string) => void;
  readonly onEarlier: () => void;
  readonly onNow: () => void;
  readonly onLater: () => void;
  readonly rangeLabel: string;
  readonly options: GanttOptions;
  readonly onOptionsChange: (change: Partial<GanttOptions>) => void;
}

/**
 * The Gantt toolbar of D5: the View and Zoom groups, Earlier, Now and Later, Go to date, the range,
 * the Hide closed time toggle, Columns and Board options. Zoom, from and the view go to the URL;
 * the toggle, the columns and the options stay local.
 */
export function GanttToolbar({
  zoom,
  onZoomChange,
  from,
  onFromChange,
  onEarlier,
  onNow,
  onLater,
  rangeLabel,
  options,
  onOptionsChange,
}: GanttToolbarProps) {
  const dateId = useId();
  return (
    <div role="toolbar" aria-label="Gantt" className="flex flex-wrap items-center gap-2">
      <ViewSwitch />
      <PressedGroup
        label="Zoom"
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
      <Button
        variant="outline"
        aria-pressed={options.hideClosed}
        onClick={() => onOptionsChange({ hideClosed: !options.hideClosed })}
        className={cn('h-8 px-3', options.hideClosed && 'border-foreground bg-accent')}
      >
        <FoldHorizontal aria-hidden />
        Hide closed time
      </Button>
      <span className="grow" />
      <ColumnsMenu
        columns={ganttColumnChoices}
        hidden={options.hiddenColumns}
        onChange={(hiddenColumns) => onOptionsChange({ hiddenColumns })}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon-sm" aria-label="Board options" />}
        >
          <Ellipsis aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Board options</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={options.workload}
              closeOnClick={false}
              onCheckedChange={(workload: boolean) => onOptionsChange({ workload })}
            >
              Workload
            </DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
