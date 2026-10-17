// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cn } from 'cn';
import type { KeyboardEvent } from 'react';
import { GanttBlock } from './gantt-block.tsx';
import { useGanttView } from './gantt-context.ts';
import { jobOrderRowsOf, rowHeightRem, summaryName, summarySpan } from './gantt-rows.ts';
import { SummaryBar, TimeCellShading } from './gantt-time-area.tsx';
import { type GanttColumn, GanttRowHeader, type GanttTableRow } from './gantt-tree-pane.tsx';

export interface GanttRowProps {
  readonly row: GanttTableRow;
  readonly columns: readonly GanttColumn[];
  /** The CSS grid template the header row shares, one track per tree column and one for time. */
  readonly gridTemplateColumns: string;
  readonly rowIndex: number;
  readonly setSize: number;
  readonly posInSet: number;
  /** The row that holds the roving tabindex. */
  readonly focused: boolean;
  readonly onFocus: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  readonly onSelect: () => void;
  readonly onToggle: () => void;
}

/**
 * One row of the treegrid (plan 18, Tree grid semantics): aria-level, aria-setsize, aria-posinset
 * and, at levels 1 and 2, aria-expanded; the rowheader, the tree columns as gridcells and one
 * gridcell for the time area, which holds the summary bar or the block. A row is a tab stop under
 * the roving tabindex; the keys of row focus mode arrive through onKeyDown.
 */
export function GanttRowView({
  row,
  columns,
  gridTemplateColumns,
  rowIndex,
  setSize,
  posInSet,
  focused,
  onFocus,
  onKeyDown,
  onSelect,
  onToggle,
}: GanttRowProps) {
  const view = useGanttView();
  const {
    scale,
    closedWindows,
    closedWindowsOf,
    selectedOrderId,
    timeZone,
    zoneLabel,
    machineName,
  } = view;
  const original = row.original;
  const level = row.depth + 1;
  const expanded = row.getIsExpanded();
  const selected = selectedOrderId === original.order.id;
  const summary = original.kind !== 'jobOrder';
  const heightRem = rowHeightRem[original.kind];
  const span = summary ? summarySpan(jobOrderRowsOf(original)) : undefined;
  const shading =
    original.kind === 'jobOrder' ? closedWindowsOf(original.jobOrder.equipment) : closedWindows;
  return (
    <div
      role="row"
      aria-level={level}
      aria-setsize={setSize}
      aria-posinset={posInSet}
      aria-rowindex={rowIndex}
      aria-expanded={summary ? expanded : undefined}
      aria-selected={selected}
      tabIndex={focused ? 0 : -1}
      data-row-id={original.id}
      data-row-kind={original.kind}
      onFocus={(event) => {
        if (event.target === event.currentTarget) onFocus();
      }}
      onKeyDown={onKeyDown}
      onClick={onSelect}
      className={cn(
        'grid border-b border-border outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        original.kind === 'order' && 'bg-muted',
        original.kind === 'operation' && 'bg-lane-alt',
        original.kind === 'jobOrder' && 'bg-lane',
      )}
      style={{ gridTemplateColumns, height: `${heightRem}rem` }}
    >
      {columns.map((column, index) =>
        index === 0 ? (
          <div
            key={column.id}
            role="rowheader"
            className={cn(
              'sticky start-0 z-10 flex min-w-0 items-center gap-1.5 overflow-hidden border-e border-border pe-2',
              original.kind === 'order' && 'bg-muted',
              original.kind === 'operation' && 'bg-lane-alt',
              original.kind === 'jobOrder' && 'bg-lane',
              selected && 'shadow-[inset_3px_0_0_var(--foreground)]',
            )}
            style={{ paddingInlineStart: `${0.5 + (level - 1)}rem` }}
          >
            <GanttRowHeader row={row} expanded={expanded} onToggle={onToggle} />
          </div>
        ) : (
          <div
            key={column.id}
            role="gridcell"
            className={cn(
              'flex min-w-0 items-center overflow-hidden border-e border-border px-2 font-mono text-xs whitespace-nowrap',
              column.numeric && 'justify-end tabular-nums',
            )}
          >
            {column.cell(original, { timeZone, zoneLabel, machineName })}
          </div>
        ),
      )}
      {summary ? (
        <div
          role="gridcell"
          tabIndex={-1}
          aria-label={summaryName(original, timeZone)}
          className="relative overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <TimeCellShading windows={shading} scale={scale} />
          {span !== undefined && (
            <SummaryBar span={span} scale={scale} color={original.order.color} />
          )}
        </div>
      ) : (
        <div role="gridcell" className="relative overflow-hidden">
          <TimeCellShading windows={shading} scale={scale} />
          <GanttBlock row={original} selected={selected} onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}
