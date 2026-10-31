// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cn } from 'cn';
import { Ellipsis, FoldHorizontal, Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { ColumnsMenu } from '../../../../ui/components/columns-menu/index.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/primitives/dropdown-menu.tsx';
import { RangeControls, ZoomControls } from '../../components/range-controls/index.ts';
import type { ZoomLevel } from '../../gantt-data.ts';
import type { Zoom } from '../../timeline/time-scale.ts';
import { changesText } from './gantt-draft-drawer.tsx';
import type { GanttOptions } from './gantt-options.ts';
import { ganttColumnChoices } from './gantt-tree-pane.tsx';

/**
 * The tree pane widths Board options offers, the one-click alternative to dragging the splitter
 * (WCAG 2.5.7, #943), as shares of the view.
 */
const paneWidths = [
  { label: 'Narrow tree pane', share: 0.25 },
  { label: 'Medium tree pane', share: 0.4 },
  { label: 'Wide tree pane', share: 0.6 },
] as const;

export interface GanttToolbarProps {
  readonly zoom: Zoom;
  readonly onZoomChange: (zoom: ZoomLevel) => void;
  readonly onZoomStep: (direction: 'in' | 'out') => void;
  readonly onZoomToFit: () => void;
  readonly from: string;
  readonly onFromChange: (from: string) => void;
  readonly onEarlier: () => void;
  readonly onNow: () => void;
  readonly onLater: () => void;
  readonly rangeLabel: ReactNode;
  readonly options: GanttOptions;
  readonly onOptionsChange: (change: Partial<GanttOptions>) => void;
  /** The changes in the planner's draft, which the My draft button names. */
  readonly draftCount: number;
  readonly onOpenDraft: () => void;
}

/**
 * The Gantt toolbar of D5: the zoom of ADR 0090, Earlier, Now and Later, Go to date, the range, the
 * Hide closed time toggle, My draft, Columns and Board options. Zoom and from go to the URL; the
 * toggle, the columns and the options stay local.
 */
export function GanttToolbar({
  zoom,
  onZoomChange,
  onZoomStep,
  onZoomToFit,
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
        zoomControls={
          <ZoomControls
            zoom={zoom}
            onZoomChange={onZoomChange}
            onZoomStep={onZoomStep}
            onZoomToFit={onZoomToFit}
          />
        }
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
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Tree pane width</DropdownMenuLabel>
            {/* A width the splitter set between these leaves none of them checked. */}
            <DropdownMenuRadioGroup
              value={String(options.treePaneShare)}
              onValueChange={(value: string) => onOptionsChange({ treePaneShare: Number(value) })}
            >
              {paneWidths.map((each) => (
                <DropdownMenuRadioItem
                  key={each.share}
                  value={String(each.share)}
                  closeOnClick={false}
                >
                  {each.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
