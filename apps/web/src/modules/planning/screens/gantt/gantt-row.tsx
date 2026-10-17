// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cn } from 'cn';
import type { KeyboardEvent } from 'react';
import { GanttBlock } from './gantt-block.tsx';
import { blockName } from './gantt-block-states.ts';
import { useGanttView } from './gantt-context.ts';
import { GanttMarkerLayer, rowMarkers } from './gantt-marker-layer.tsx';
import { jobOrderRowsOf, rowHeightRem, summaryName, summarySpan } from './gantt-rows.ts';
import { SummaryBar, TimeCellShading } from './gantt-time-area.tsx';
import { type GanttColumn, GanttRowHeader, type GanttTableRow } from './gantt-tree-pane.tsx';

export interface GanttRowProps {
  readonly row: GanttTableRow;
  readonly columns: readonly GanttColumn[];
  /** The CSS grid template the header row shares, one track per tree column and one for time. */
  readonly gridTemplateColumns: string;
  /** The left offset of each tree column, where its cell sticks while the time column scrolls. */
  readonly cellLefts: readonly number[];
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
  cellLefts,
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
    snapshot,
    closedWindows,
    closedWindowsOf,
    selectedOrderId,
    chainRowIds,
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
  const onChain = chainRowIds.has(original.id);
  const markers = rowMarkers(original, snapshot, scale, { onChain });
  const background =
    original.kind === 'order'
      ? 'bg-muted'
      : original.kind === 'operation'
        ? 'bg-lane-alt'
        : 'bg-lane';
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
              'sticky z-10 flex min-w-0 items-center gap-1.5 overflow-hidden border-e border-border pe-2',
              background,
              selected && 'shadow-[inset_3px_0_0_var(--foreground)]',
            )}
            style={{ paddingInlineStart: `${0.5 + (level - 1)}rem`, insetInlineStart: 0 }}
          >
            <GanttRowHeader row={row} expanded={expanded} onToggle={onToggle} />
          </div>
        ) : (
          <div
            key={column.id}
            role="gridcell"
            className={cn(
              'sticky z-10 flex min-w-0 items-center overflow-hidden border-e border-border px-2 font-mono text-xs whitespace-nowrap',
              background,
              column.numeric && 'justify-end tabular-nums',
            )}
            style={{ insetInlineStart: `${cellLefts[index] ?? 0}px` }}
          >
            {column.cell(original, { timeZone, zoneLabel, machineName })}
          </div>
        ),
      )}
      {summary ? (
        <div
          role="gridcell"
          tabIndex={-1}
          data-cell-focus
          aria-label={summaryName(original, timeZone)}
          className="relative overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <TimeCellShading windows={shading} scale={scale} />
          <GanttMarkerLayer markers={markers} scale={scale} />
          {span !== undefined && (
            <SummaryBar span={span} scale={scale} color={original.order.color} />
          )}
        </div>
      ) : (
        <div
          role="gridcell"
          className="relative overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          // A job order without a placement has no block, so Right lands on the cell itself,
          // named as the block would be, with "not placed".
          {...(original.jobOrder.placement === undefined && {
            tabIndex: -1,
            'data-cell-focus': true,
            'aria-label': blockName(original, snapshot, machineName(original.jobOrder.equipment)),
          })}
        >
          <TimeCellShading windows={shading} scale={scale} />
          <GanttMarkerLayer markers={markers} scale={scale} />
          <GanttBlock row={original} selected={selected} onChain={onChain} onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}
