// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatSpan } from '@northmes/contracts/format';
import { Layers } from 'lucide-react';
import { type FocusEvent, useState } from 'react';
import { Button } from '../../../../ui/primitives/button.tsx';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '../../../../ui/primitives/popover.tsx';
import type { GanttSnapshot } from '../../gantt-data.ts';
import { useGanttView } from '../gantt/gantt-context.ts';
import type { JobOrderRow } from '../gantt/gantt-rows.ts';
import { type BoardBlockState, boardBlockStates } from './board-block-states.ts';

/**
 * The words a cluster's name counts each state with, in the order it names them: late, then held,
 * as plan 07 and ADR 0021 read a cluster ("2 late, 1 being edited by ..."), then the others.
 */
const countWords: Readonly<Record<BoardBlockState['kind'], string>> = {
  late: 'late',
  held: 'being edited by another planner',
  locked: 'locked',
  draft: 'changed in your draft',
  started: 'started',
  conflict: 'in conflict',
  overdue: 'overdue',
};

/**
 * The name of a cluster (plan 07, Targets and density; design D3, BO12): how many job orders it
 * holds, its span and how many of them carry each state, "2 jobs, Wed 4 Nov 08:00 to Wed 4 Nov
 * 16:15, 1 locked, 1 late".
 */
export function clusterName(
  rows: readonly JobOrderRow[],
  snapshot: GanttSnapshot,
  span: { readonly fromMs: number; readonly toMs: number },
  draftRowIds: ReadonlySet<string> = new Set(),
): string {
  const counts = new Map<BoardBlockState['kind'], number>();
  for (const row of rows) {
    const states = boardBlockStates(row, snapshot, { inDraft: draftRowIds.has(row.jobOrder.id) });
    const kinds = new Set(states.map((state) => state.kind));
    for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const order = Object.keys(countWords) as BoardBlockState['kind'][];
  return [
    `${rows.length} jobs`,
    formatSpan(span.fromMs, span.toMs, snapshot.plant.timeZone),
    ...order.flatMap((kind) => {
      const count = counts.get(kind);
      return count === undefined ? [] : [`${count} ${countWords[kind]}`];
    }),
  ].join(', ');
}

/**
 * A cluster cell (plan 07, Targets and density; design D3, IN27): one target of at least 24 px
 * for the job orders too narrow to tell apart, named with their count, span and state counts.
 * Enter, Space or a click opens its popover, a dialog with one row per job order, and Escape
 * returns focus to the cluster. A row's button selects its order.
 */
export function BoardCluster({
  rows,
  snapshot,
  machine,
  span,
  left,
  width,
  focusKey,
  focusable,
  selectedOrderId,
  onFocus,
  onSelectOrder,
}: {
  readonly rows: readonly JobOrderRow[];
  readonly snapshot: GanttSnapshot;
  readonly machine: string;
  readonly span: { readonly fromMs: number; readonly toMs: number };
  readonly left: number;
  readonly width: number;
  readonly focusKey: string;
  readonly focusable: boolean;
  /** The selected order, whose job orders in the cluster mark it selected. */
  readonly selectedOrderId: string | undefined;
  readonly onFocus: (event: FocusEvent<HTMLDivElement>) => void;
  readonly onSelectOrder: (orderId: string) => void;
}) {
  const { draftRowIds } = useGanttView();
  const [open, setOpen] = useState(false);
  const selected = rows.some((row) => row.order.id === selectedOrderId);
  const timeZone = snapshot.plant.timeZone;
  const spanText = formatSpan(span.fromMs, span.toMs, timeZone);
  return (
    // Modal, so Tab stays inside the popover until Escape returns focus to the cluster (D3, IN27).
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger
        nativeButton={false}
        render={
          <div
            role="gridcell"
            tabIndex={focusable ? 0 : -1}
            data-board-focus={focusKey}
            data-cluster={rows.map((row) => row.jobOrder.displayNumber).join(' ')}
            aria-label={clusterName(rows, snapshot, span, draftRowIds)}
            aria-haspopup="dialog"
            aria-selected={selected}
            onFocus={onFocus}
            className="absolute top-1 flex h-11 items-center justify-center gap-1 border border-block-border bg-card text-xs font-medium focus-visible:z-10"
            style={{ left: `${left}px`, width: `${width}px` }}
          />
        }
      >
        {selected && (
          <span
            aria-hidden
            data-selection-bar
            className="pointer-events-none absolute inset-x-0 top-0 h-0.75 bg-foreground"
          />
        )}
        {width >= 40 && <Layers aria-hidden className="size-3.5 shrink-0" />}
        <span aria-hidden>{rows.length}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <PopoverHeader>
          <PopoverTitle>
            {rows.length} jobs on {machine}, {spanText}
          </PopoverTitle>
        </PopoverHeader>
        <ul className="grid gap-1">
          {rows.map((row) => (
            <li key={row.id} className="grid gap-0.5">
              <Button
                variant="ghost"
                className="h-7 justify-start px-1.5 font-mono"
                onClick={() => {
                  onSelectOrder(row.order.id);
                  setOpen(false);
                }}
              >
                {row.jobOrder.displayNumber} {row.order.article}
                {row.order.id === selectedOrderId && (
                  <span className="ms-auto font-sans text-xs text-muted-foreground">Selected</span>
                )}
              </Button>
              {row.jobOrder.placement !== undefined && (
                <span className="px-1.5 text-xs text-muted-foreground">
                  {formatSpan(
                    row.jobOrder.placement.setupStartMs,
                    row.jobOrder.placement.endMs,
                    timeZone,
                  )}
                  {boardBlockStates(row, snapshot, { inDraft: draftRowIds?.has(row.jobOrder.id) })
                    .map((state) => `, ${state.text}`)
                    .join('')}
                </span>
              )}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
