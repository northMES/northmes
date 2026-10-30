// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cn } from 'cn';
import type { KeyboardEvent } from 'react';
import { GanttBlock } from './gantt-block.tsx';
import { blockName } from './gantt-block-states.ts';
import { useGanttView } from './gantt-context.ts';
import { GanttMarkerLayer, rowMarkers } from './gantt-marker-layer.tsx';
import { rowHeightRem, rowSpan, summaryName } from './gantt-rows.ts';
import { SummaryBar, TimeCellShading } from './gantt-time-area.tsx';
import { type GanttColumn, GanttRowHeader, type GanttTableRow } from './gantt-tree-pane.tsx';

export interface GanttRowProps {
  readonly row: GanttTableRow;
  readonly columns: readonly GanttColumn[];
  /** The CSS grid template the header row shares, one track per tree column and one for time. */
  readonly gridTemplateColumns: string;
  /** The left offset of each tree column, where its cell sticks while the time column scrolls. */
  readonly cellLefts: readonly number[];
  /**
   * Whether every tree cell sticks: only while the pane fits its cap, so a narrow grid (320 px
   * reflow, 400 percent zoom) keeps the time area reachable with the Name column alone pinned.
   */
  readonly stickyTree: boolean;
  readonly rowIndex: number;
  readonly setSize: number;
  readonly posInSet: number;
  /** The row that holds the roving tabindex. */
  readonly focused: boolean;
  readonly onFocus: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  /** A click selects the row's order; with Shift it adds the order to the selection (plan 18, Runs). */
  readonly onSelect: (extend?: boolean) => void;
  /** A double click opens the row's Details; a single click only selects, so the Gantt stays workable (#884). */
  readonly onOpen: () => void;
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
  stickyTree,
  rowIndex,
  setSize,
  posInSet,
  focused,
  onFocus,
  onKeyDown,
  onSelect,
  onOpen,
  onToggle,
}: GanttRowProps) {
  const view = useGanttView();
  const {
    scale,
    snapshot,
    closedWindows,
    closedWindowsOf,
    selectedOrderIds,
    chainRowIds,
    timeZone,
    zoneLabel,
    machineName,
  } = view;
  const original = row.original;
  const level = row.depth + 1;
  const expanded = row.getIsExpanded();
  const selected =
    original.kind === 'run'
      ? original.run.orderIds.some((id) => selectedOrderIds.has(id))
      : selectedOrderIds.has(original.order.id);
  const summary = original.kind !== 'jobOrder';
  const heightRem = rowHeightRem[original.kind];
  const span = summary ? rowSpan(original) : undefined;
  const shading =
    original.kind === 'jobOrder' ? closedWindowsOf(original.jobOrder.equipment) : closedWindows;
  const onChain = chainRowIds.has(original.id);
  const markers = rowMarkers(original, snapshot, scale, { onChain });
  const background =
    original.kind === 'order' || original.kind === 'run'
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
      onClick={(event) => onSelect(event.shiftKey)}
      onDoubleClick={(event) => {
        // Shift is the selection modifier (plan 18, Runs): a Shift+double click only extends.
        if (event.shiftKey) return;
        // The expand toggle and the row menu stop their clicks, but the dblclick that two of them
        // make still reaches the row: it opens nothing from a control that is not the block, nor
        // from a portal (the hover card) that React bubbles through.
        const target = event.target as Element;
        if (!event.currentTarget.contains(target)) return;
        const control = target.closest('button');
        if (control !== null && control.dataset.block === undefined) return;
        onOpen();
      }}
      className={cn(
        // As wide as its tracks: a sticky cell cannot leave its row, so a row only as wide as the
        // grid would take the tree cells with it once the scroll passes the row's width (#890).
        'grid w-max min-w-full border-b border-border outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        (original.kind === 'order' || original.kind === 'run') && 'bg-muted',
        original.kind === 'run' && 'border-s-4 border-s-foreground/60',
        original.kind === 'operation' && 'bg-lane-alt',
        original.kind === 'jobOrder' && 'bg-lane',
      )}
      // Tailwind has no side variant of the border style, so the run's double start edge is inline.
      style={{
        gridTemplateColumns,
        height: `${heightRem}rem`,
        ...(original.kind === 'run' && { borderInlineStartStyle: 'double' }),
      }}
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
              'flex min-w-0 items-center overflow-hidden border-e border-border px-2 font-mono text-xs whitespace-nowrap',
              stickyTree && 'sticky z-10',
              background,
              column.numeric && 'justify-end tabular-nums',
            )}
            style={stickyTree ? { insetInlineStart: `${cellLefts[index] ?? 0}px` } : undefined}
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
          <TimeCellShading windows={shading} scale={scale} nowMs={snapshot.nowMs} />
          <GanttMarkerLayer markers={markers} scale={scale} />
          {span !== undefined && (
            <SummaryBar
              span={span}
              scale={scale}
              color={original.order.color}
              run={original.kind === 'run'}
            />
          )}
        </div>
      ) : (
        <div
          role="gridcell"
          className="relative overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          // A job order without a placement has no block, so Right lands on the cell itself,
          // named as the block would be, with "not placed" or, while its time chunk loads, "time
          // loading".
          {...(original.jobOrder.placement === undefined && {
            tabIndex: -1,
            'data-cell-focus': true,
            'aria-label': blockName(original, snapshot, machineName(original.jobOrder.equipment), {
              material: view.materialShortages?.get(original.operation.displayNumber) ?? [],
            }),
          })}
        >
          <TimeCellShading windows={shading} scale={scale} nowMs={snapshot.nowMs} />
          <GanttMarkerLayer markers={markers} scale={scale} />
          <GanttBlock
            row={original}
            selected={selected}
            onChain={onChain}
            onSelect={() => onSelect()}
          />
        </div>
      )}
    </div>
  );
}
