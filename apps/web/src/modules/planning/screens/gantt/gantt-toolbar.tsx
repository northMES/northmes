// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cn } from 'cn';
import { Ellipsis, FoldHorizontal, Pencil } from 'lucide-react';
import { ColumnsMenu } from '../../../../ui/components/columns-menu/index.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../../../ui/primitives/dropdown-menu.tsx';
import { RangeControls } from '../../components/range-controls/index.ts';
import type { ZoomLevel, ZoomPreset } from '../../gantt-data.ts';
import { changesText } from './gantt-draft-drawer.tsx';
import type { GanttOptions } from './gantt-options.ts';
import { ganttColumnChoices } from './gantt-tree-pane.tsx';

export interface GanttToolbarProps {
  readonly zoom: ZoomLevel;
  readonly onZoomChange: (zoom: ZoomPreset) => void;
  readonly from: string;
  readonly onFromChange: (from: string) => void;
  readonly onEarlier: () => void;
  readonly onNow: () => void;
  readonly onLater: () => void;
  readonly rangeLabel: string;
  readonly options: GanttOptions;
  readonly onOptionsChange: (change: Partial<GanttOptions>) => void;
  /** The changes in the planner's draft, which the My draft button names. */
  readonly draftCount: number;
  readonly onOpenDraft: () => void;
}

/**
 * The Gantt toolbar of D5: the Zoom group, Earlier, Now and Later, Go to date, the range, the
 * Hide closed time toggle, My draft, Columns and Board options. Zoom and from go to the URL; the
 * toggle, the columns and the options stay local.
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
  draftCount,
  onOpenDraft,
}: GanttToolbarProps) {
  return (
    <div role="toolbar" aria-label="Gantt" className="flex flex-wrap items-center gap-2">
      <RangeControls
        presetLabel="Zoom"
        zoom={zoom}
        onZoomChange={onZoomChange}
        from={from}
        onFromChange={onFromChange}
        onEarlier={onEarlier}
        onNow={onNow}
        onLater={onLater}
        rangeLabel={rangeLabel}
      />
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
      <Button variant="outline" className="h-8 px-3" onClick={onOpenDraft} data-draft-button>
        <Pencil aria-hidden />
        {draftCount === 0 ? 'My draft' : `My draft, ${changesText(draftCount)}`}
      </Button>
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
            <DropdownMenuCheckboxItem
              checked={options.cascade}
              closeOnClick={false}
              onCheckedChange={(cascade: boolean) => onOptionsChange({ cascade })}
            >
              Cascade
            </DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
