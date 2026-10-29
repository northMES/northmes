// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Ellipsis } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../../../ui/primitives/dropdown-menu.tsx';
import { useGanttView } from './gantt-context.ts';
import type { OrderRow, RunRow } from './gantt-rows.ts';
import { runTitle } from './gantt-rows.ts';

/** Why Zoom, Plan this order and Move all later by are drawn but disabled (plan 18, phase 2). */
const laterReason = 'With the live data and plan()';

/** The accessible name of a row's menu: "Actions for order 1001", "Actions for the run of Bracket L". */
export function rowMenuLabel(row: RunRow | OrderRow): string {
  return row.kind === 'run'
    ? `Actions for the run of ${row.run.article}`
    : `Actions for order ${row.order.number}`;
}

/**
 * The menu of an order row and of a run row (plan 18, Moves on the order Gantt; Runs): Combine
 * into a run when two or more orders of one article are selected, with the reason when it is not,
 * Show critical chain, and the actions that wait for the live data drawn disabled; Split run on a
 * run. The button sits in the row header, out of the tab order, and Shift+F10 or the menu key on
 * the row opens it.
 */
export function GanttRowMenu({ row }: { readonly row: RunRow | OrderRow }) {
  const { runActions, toggleChain } = useGanttView();
  const label = rowMenuLabel(row);
  const check = row.kind === 'order' ? runActions?.canCombine(row.order.id) : undefined;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            tabIndex={-1}
            data-row-menu
            aria-label={label}
            onClick={(event) => event.stopPropagation()}
            className="ms-auto flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <Ellipsis aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      {/* The popup is portaled, and React bubbles its clicks to the row, which would select it;
          the menu's own clicks stay in the menu. */}
      <DropdownMenuContent
        aria-label={label}
        align="start"
        className="w-auto min-w-56"
        onClick={(event) => event.stopPropagation()}
      >
        {row.kind === 'order' ? (
          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={check === undefined || !check.ok}
              onClick={() => runActions?.combine(row.order.id)}
            >
              Combine into a run
            </DropdownMenuItem>
            {check !== undefined && !check.ok && (
              <DropdownMenuLabel className="pt-0 text-xs font-normal text-muted-foreground">
                {check.reason}
              </DropdownMenuLabel>
            )}
            <DropdownMenuItem onClick={() => toggleChain?.(row.order.id)}>
              Show critical chain
            </DropdownMenuItem>
            <DropdownMenuItem disabled>Zoom to order</DropdownMenuItem>
            <DropdownMenuItem disabled>Plan this order</DropdownMenuItem>
            <DropdownMenuItem disabled>Move all later by</DropdownMenuItem>
            <DropdownMenuLabel className="pt-0 text-xs font-normal text-muted-foreground">
              {laterReason}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
        ) : (
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => runActions?.split(row.run.id)}>
              Split run
            </DropdownMenuItem>
            <DropdownMenuItem disabled>Zoom to run</DropdownMenuItem>
            <DropdownMenuLabel className="pt-0 text-xs font-normal text-muted-foreground">
              {`${laterReason}: ${runTitle(row.run)}`}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
