// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Pencil, SlidersHorizontal } from 'lucide-react';
import type { Ref } from 'react';
import { ColumnsMenuGroup } from '../../../../ui/components/columns-menu/index.ts';
import { IconButton } from '../../../../ui/components/icon-button/index.ts';
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
import { OrderFilterField } from '../../components/order-filter/index.ts';
import { changesText } from './gantt-draft-drawer.tsx';
import type { GanttOptions } from './gantt-options.ts';
import { ganttColumnChoices } from './gantt-tree-pane.tsx';

/**
 * The tree pane widths the View menu offers, the one-click alternative to dragging the splitter
 * (WCAG 2.5.7, #943), as shares of the view.
 */
const paneWidths = [
  { label: 'Narrow tree pane', share: 0.25 },
  { label: 'Medium tree pane', share: 0.4 },
  { label: 'Wide tree pane', share: 0.6 },
] as const;

export interface GanttToolbarProps {
  /** Go to now: the zoom kept, now at the centre of the view. */
  readonly onGoToNow: () => void;
  /** The order filter, the URL's q, and its change after a pause in typing (ADR 0090). */
  readonly filter: string;
  readonly onFilterChange: (filter: string) => void;
  /** The filter's field, where focus goes when My draft leaves the bar. */
  readonly filterRef?: Ref<HTMLInputElement>;
  readonly options: GanttOptions;
  readonly onOptionsChange: (change: Partial<GanttOptions>) => void;
  /** The changes in the planner's draft; My draft shows only while there are some. */
  readonly draftCount: number;
  readonly onOpenDraft: () => void;
}

/**
 * The slim bar above the order Gantt (ADR 0090, The bar above the timeline): Go to now, the order
 * filter, My draft
 * while the draft has changes, and one View menu at the right end with the columns, Hide closed
 * time, Workload, Cascade and the tree pane widths, which stay local. The zoom buttons sit over the
 * time area instead.
 */
export function GanttToolbar({
  onGoToNow,
  filter,
  onFilterChange,
  filterRef,
  options,
  onOptionsChange,
  draftCount,
  onOpenDraft,
}: GanttToolbarProps) {
  return (
    <div role="toolbar" aria-label="Gantt" className="flex flex-wrap items-center gap-2">
      <Button variant="outline" className="h-8 px-3" onClick={onGoToNow}>
        Go to now
      </Button>
      <OrderFilterField value={filter} onChange={onFilterChange} inputRef={filterRef} />
      <span className="grow" />
      {draftCount > 0 && (
        <Button variant="outline" className="h-8 px-3" onClick={onOpenDraft} data-draft-button>
          <Pencil aria-hidden />
          {`My draft, ${changesText(draftCount)}`}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <IconButton label="View" variant="outline" size="icon-sm">
              <SlidersHorizontal aria-hidden />
            </IconButton>
          }
        />
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Options</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={options.hideClosed}
              closeOnClick={false}
              onCheckedChange={(hideClosed: boolean) => onOptionsChange({ hideClosed })}
            >
              Hide closed time
            </DropdownMenuCheckboxItem>
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
          <ColumnsMenuGroup
            label="Columns"
            columns={ganttColumnChoices}
            hidden={options.hiddenColumns}
            onChange={(hiddenColumns) => onOptionsChange({ hiddenColumns })}
          />
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
