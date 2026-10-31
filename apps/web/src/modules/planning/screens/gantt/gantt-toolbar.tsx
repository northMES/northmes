// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Pencil, SlidersHorizontal } from 'lucide-react';
import type { Ref } from 'react';
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
  /** Go to now's button, where focus goes when My draft leaves the bar. */
  readonly goToNowRef?: Ref<HTMLButtonElement>;
  readonly options: GanttOptions;
  readonly onOptionsChange: (change: Partial<GanttOptions>) => void;
  /** The changes in the planner's draft; My draft shows only while there are some. */
  readonly draftCount: number;
  readonly onOpenDraft: () => void;
}

/**
 * The slim bar above the order Gantt (ADR 0090, The bar above the timeline): Go to now, My draft
 * while the draft has changes, and one View menu at the right end with the columns, Hide closed
 * time, Workload, Cascade and the tree pane widths, which stay local. The zoom buttons sit over the
 * time area instead.
 */
export function GanttToolbar({
  onGoToNow,
  goToNowRef,
  options,
  onOptionsChange,
  draftCount,
  onOpenDraft,
}: GanttToolbarProps) {
  const hidden = new Set(options.hiddenColumns);
  return (
    <div role="toolbar" aria-label="Gantt" className="flex flex-wrap items-center gap-2">
      <Button ref={goToNowRef} variant="outline" className="h-8 px-3" onClick={onGoToNow}>
        Go to now
      </Button>
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
            <DropdownMenuLabel>Show</DropdownMenuLabel>
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
          <DropdownMenuGroup aria-label="Columns">
            <DropdownMenuLabel>Columns</DropdownMenuLabel>
            {ganttColumnChoices.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={column.alwaysShown === true || !hidden.has(column.id)}
                disabled={column.alwaysShown === true}
                closeOnClick={false}
                onCheckedChange={(shown: boolean) =>
                  onOptionsChange({
                    hiddenColumns: ganttColumnChoices
                      .map(({ id }) => id)
                      .filter((id) => (id === column.id ? !shown : hidden.has(id))),
                  })
                }
              >
                <span>{column.label}</span>
                {column.alwaysShown === true && (
                  <>
                    {' '}
                    <span className="ml-auto pl-4 text-xs text-muted-foreground">Always shown</span>
                  </>
                )}
              </DropdownMenuCheckboxItem>
            ))}
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
