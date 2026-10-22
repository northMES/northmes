// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic

import type { JobOrderSpan } from '@northmes/planning-domain';
import { cn } from 'cn';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { GanttSnapshot } from '../../gantt-data.ts';
import type { TimeScale } from '../../timeline/time-scale.ts';
import { GanttMarkerLayer, overlayMarkers } from '../gantt/gantt-marker-layer.tsx';
import { type MovePreview, tooltipText } from '../gantt/gantt-move.ts';
import { quantityText } from '../gantt/gantt-rows.ts';
import {
  GanttTimeHeader,
  TimeCellShading,
  timeHeaderHeightRem,
} from '../gantt/gantt-time-area.tsx';
import { BoardBlock } from './board-block.tsx';
import type { BoardCellItem } from './board-cells.ts';
import { BoardCluster } from './board-cluster.tsx';
import type { BoardModel } from './board-rows.ts';

/** The row heights of D3 in rem: 46 px for Not placed, 36 px for a group band, 52 px for a machine. */
export const boardRowRem = { notPlaced: 2.875, group: 2.25, machine: 3.25 } as const;

/** The focus keys of the grid's targets, which data-board-focus carries. */
export const focusKeys = {
  block: (jobOrderId: string) => jobOrderId,
  empty: (machine: string) => `empty:${machine}`,
  header: (machine: string) => `header:${machine}`,
  group: (group: string) => `group:${group}`,
  notPlacedEmpty: 'not-placed:empty',
} as const;

export interface BoardGridProps {
  readonly name: string;
  readonly snapshot: GanttSnapshot;
  readonly model: BoardModel;
  /** The cells of each machine row at the scale, blocks and clusters in time order, by machine. */
  readonly cellsOf: (machine: string) => readonly BoardCellItem[];
  readonly scale: TimeScale;
  readonly machineWidth: number;
  readonly timeWidth: number;
  readonly collapsed: ReadonlySet<string>;
  readonly onToggleGroup: (code: string) => void;
  /** The target that holds the grid's one Tab stop. */
  readonly tabStop: string | undefined;
  /** The move in progress, which draws its outline in the row of its target machine. */
  readonly preview?: MovePreview;
  /** The selected order, by id, whose job orders carry aria-selected. */
  readonly selectedOrderId: string | undefined;
  readonly onSelectOrder: (orderId: string) => void;
  /** Opens the block menu of a job order at its block. */
  readonly onBlockMenu: (jobOrderId: string, anchor: HTMLElement) => void;
  readonly onFocusTarget: (key: string) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  readonly gridRef: (node: HTMLDivElement | null) => void;
  readonly height: number | undefined;
}

/**
 * The outline of a move in progress (plan 07, Moving without dragging; design D3, IN4 and IN6):
 * the span the move would write on its target machine, in the draft style, with the tooltip that
 * names it. Decorative: the step messages and the block's name carry the words.
 */
function MoveOutline({
  preview,
  scale,
  timeZone,
}: {
  readonly preview: MovePreview;
  readonly scale: TimeScale;
  readonly timeZone: string;
}) {
  const left = scale.x(preview.span.setupStartMs);
  return (
    <>
      <span
        aria-hidden
        data-move-preview={preview.jobOrderId}
        data-from-ms={preview.span.setupStartMs}
        data-to-ms={preview.span.endMs}
        className="pointer-events-none absolute top-1 z-[3] h-11 border-3 border-double border-foreground"
        style={{
          left: `${left}px`,
          width: `${Math.max(2, scale.x(preview.span.endMs) - left)}px`,
        }}
      />
      <span
        aria-hidden
        data-drag-tooltip
        className="pointer-events-none absolute bottom-0 z-[4] rounded-sm bg-popover px-1.5 py-0.5 font-mono text-tick whitespace-nowrap text-popover-foreground shadow-sm"
        style={{ left: `${left}px` }}
      >
        {tooltipText(preview, timeZone)}
      </span>
    </>
  );
}

/**
 * Where the cascade would put a row that moves with the one in progress, in the draft style and
 * the order color at reduced opacity, as on the Gantt.
 */
function GhostSpan({
  jobOrderId,
  span,
  color,
  scale,
}: {
  readonly jobOrderId: string;
  readonly span: JobOrderSpan;
  readonly color: string;
  readonly scale: TimeScale;
}) {
  const left = scale.x(span.setupStartMs);
  return (
    <span
      aria-hidden
      data-ghost={jobOrderId}
      data-from-ms={span.setupStartMs}
      data-to-ms={span.endMs}
      className="pointer-events-none absolute top-1 z-[3] h-11 border-3 border-double border-foreground opacity-45"
      style={{
        left: `${left}px`,
        width: `${Math.max(2, scale.x(span.endMs) - left)}px`,
        background: `var(--${color})`,
      }}
    />
  );
}

/** A row of the grid: the row header column and the time column, as CSS grid columns. */
function Row({
  index,
  heightRem,
  columns,
  className,
  top,
  machine,
  children,
}: {
  readonly index: number;
  readonly heightRem: number;
  readonly columns: string;
  readonly className?: string;
  /** The offset in rem at which a sticky row sticks. */
  readonly top?: number;
  /** The machine of a machine row, which a pointer drag reads to find its target. */
  readonly machine?: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      role="row"
      aria-rowindex={index}
      data-machine={machine}
      className={cn('grid border-b border-border', className)}
      style={{
        gridTemplateColumns: columns,
        height: `${heightRem}rem`,
        ...(top !== undefined && { top: `${top}rem` }),
      }}
    >
      {children}
    </div>
  );
}

/**
 * The board grid (plan 07, Grid semantics and focus; design D3, Roles and names): role grid named
 * after the plant and the range, the time header as row 1, the pinned Not placed row as row 2,
 * then a band per equipment group with its disclosure button and the group's machine rows, each
 * with its row header and one gridcell per job order in time order, or one "No jobs in this
 * range" cell. The machine column and the two top rows stick while the grid scrolls inside its
 * own container, and the scroll padding keeps a focused cell clear of them (WCAG 2.4.11).
 */
export function BoardGrid({
  name,
  snapshot,
  model,
  cellsOf,
  scale,
  machineWidth,
  timeWidth,
  collapsed,
  onToggleGroup,
  tabStop,
  preview,
  selectedOrderId,
  onSelectOrder,
  onBlockMenu,
  onFocusTarget,
  onKeyDown,
  gridRef,
  height,
}: BoardGridProps) {
  const columns = `${machineWidth}px ${timeWidth}px`;
  const machineCount = model.groups.reduce((sum, group) => sum + group.machines.length, 0);
  const tab = (key: string) => (key === tabStop ? 0 : -1);
  // The rows the move in progress carries with it, on their machines, also from outside the range.
  const ghosts = [...(preview?.ghosts ?? new Map<string, JobOrderSpan>())].flatMap(
    ([jobOrderId, span]) => {
      for (const order of snapshot.productionOrders) {
        const row = order.jobOrders.find((each) => each.id === jobOrderId);
        if (row?.equipment !== undefined) {
          return [{ jobOrderId, span, equipment: row.equipment, color: order.color }];
        }
      }
      return [];
    },
  );
  let rowIndex = 2;
  const bodyRows: ReactNode[] = [];
  let bodyRem = 0;
  for (const group of model.groups) {
    rowIndex += 1;
    const open = !collapsed.has(group.code);
    bodyRem += boardRowRem.group;
    bodyRows.push(
      <Row
        key={`group-${group.code}`}
        index={rowIndex}
        heightRem={boardRowRem.group}
        columns={columns}
        className="bg-muted"
      >
        <div
          role="rowheader"
          data-sticky-column
          className="sticky start-0 z-20 flex items-center bg-muted px-1"
        >
          <button
            type="button"
            tabIndex={tab(focusKeys.group(group.code))}
            data-board-focus={focusKeys.group(group.code)}
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${group.name}`}
            onClick={() => onToggleGroup(group.code)}
            onFocus={() => onFocusTarget(focusKeys.group(group.code))}
            className="flex h-7 min-h-(--nm-target-min) items-center gap-1.5 rounded-sm px-1 text-xs whitespace-nowrap"
          >
            {open ? (
              <ChevronDown aria-hidden className="size-4" />
            ) : (
              <ChevronRight aria-hidden className="size-4" />
            )}
            {group.color !== undefined && (
              <span
                aria-hidden
                className="size-2.5 rounded-full border border-block-border"
                style={{ background: `var(--${group.color})` }}
              />
            )}
            <span className="font-medium">{group.name}</span>
            <span aria-hidden className="text-muted-foreground">
              {group.machines.length === 1 ? '1 machine' : `${group.machines.length} machines`}
            </span>
          </button>
        </div>
      </Row>,
    );
    if (!open) continue;
    for (const machine of group.machines) {
      rowIndex += 1;
      bodyRem += boardRowRem.machine;
      const code = machine.equipment.code;
      const cells = cellsOf(code);
      bodyRows.push(
        <Row
          key={code}
          index={rowIndex}
          heightRem={boardRowRem.machine}
          columns={columns}
          machine={code}
        >
          <div
            role="rowheader"
            tabIndex={tab(focusKeys.header(code))}
            data-board-focus={focusKeys.header(code)}
            onFocus={() => onFocusTarget(focusKeys.header(code))}
            data-sticky-column
            className="sticky start-0 z-20 flex items-center border-e border-border bg-card px-3 text-sm"
            style={{
              boxShadow:
                group.color === undefined ? undefined : `inset 6px 0 0 var(--${group.color})`,
            }}
          >
            {machine.equipment.name}
          </div>
          <div className="relative bg-lane">
            <TimeCellShading windows={machine.closed} scale={scale} />
            {preview !== undefined && preview.equipment === code && (
              <MoveOutline preview={preview} scale={scale} timeZone={snapshot.plant.timeZone} />
            )}
            {ghosts
              .filter((ghost) => ghost.equipment === code)
              .map((ghost) => (
                <GhostSpan
                  key={ghost.jobOrderId}
                  jobOrderId={ghost.jobOrderId}
                  span={ghost.span}
                  color={ghost.color}
                  scale={scale}
                />
              ))}
            {cells.length === 0 ? (
              <div
                role="gridcell"
                tabIndex={tab(focusKeys.empty(code))}
                data-board-focus={focusKeys.empty(code)}
                data-sticky-column
                onFocus={() => onFocusTarget(focusKeys.empty(code))}
                className="sticky start-0 inline-flex h-full items-center px-3 text-xs text-muted-foreground"
                style={{ insetInlineStart: `${machineWidth}px` }}
              >
                No jobs in this range
              </div>
            ) : (
              cells.map((cell) =>
                cell.kind === 'cluster' ? (
                  <BoardCluster
                    key={cell.key}
                    rows={cell.rows}
                    snapshot={snapshot}
                    machine={machine.equipment.name}
                    span={cell}
                    left={cell.left}
                    width={cell.width}
                    focusKey={cell.key}
                    focusable={tabStop === cell.key}
                    selectedOrderId={selectedOrderId}
                    onFocus={() => onFocusTarget(cell.key)}
                    onSelectOrder={onSelectOrder}
                  />
                ) : (
                  <BoardBlock
                    key={cell.row.id}
                    row={cell.row}
                    left={cell.left}
                    width={cell.width}
                    snapshot={snapshot}
                    machine={machine.equipment.name}
                    focusable={tabStop === focusKeys.block(cell.row.jobOrder.id)}
                    selected={cell.row.order.id === selectedOrderId}
                    onFocus={() => onFocusTarget(focusKeys.block(cell.row.jobOrder.id))}
                    onSelect={() => onSelectOrder(cell.row.order.id)}
                    onMenu={(anchor) => onBlockMenu(cell.row.jobOrder.id, anchor)}
                  />
                ),
              )
            )}
          </div>
        </Row>,
      );
    }
  }
  const headerRem = timeHeaderHeightRem;
  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label={name}
      aria-multiselectable="true"
      aria-rowcount={rowIndex}
      onKeyDown={onKeyDown}
      className="min-h-0 overflow-auto overscroll-contain rounded-lg border border-border bg-card text-sm"
      style={{
        ...(height !== undefined && { height: `${height}px` }),
        scrollPaddingTop: `calc(${headerRem + boardRowRem.notPlaced}rem + 8px)`,
        scrollPaddingInlineStart: `${machineWidth + 8}px`,
      }}
    >
      <Row index={1} heightRem={headerRem} columns={columns} className="sticky top-0 z-40 bg-muted">
        <div
          role="columnheader"
          className="sticky start-0 z-10 flex flex-col justify-center border-e border-border bg-muted px-3"
        >
          <span className="text-xs font-medium">Machines</span>
          <span className="text-xs text-muted-foreground">
            <span className="sr-only">, </span>
            {machineCount} in{' '}
            {model.groups.length === 1 ? '1 group' : `${model.groups.length} groups`}
          </span>
        </div>
        <GanttTimeHeader scale={scale} nowMs={snapshot.nowMs} />
      </Row>
      <Row
        index={2}
        heightRem={boardRowRem.notPlaced}
        columns={columns}
        className="sticky z-30 bg-lane-alt"
        top={headerRem}
      >
        <div
          role="rowheader"
          className="sticky start-0 z-10 flex items-center gap-2 border-e border-border bg-lane-alt px-3 text-sm"
        >
          Not placed
          <span className="sr-only">, </span>
          <span className="rounded-full bg-muted px-1.5 font-mono text-xs">
            {model.notPlaced.length === 1 ? (
              <>
                1<span className="sr-only"> job order</span>
              </>
            ) : (
              <>
                {model.notPlaced.length}
                <span className="sr-only"> job orders</span>
              </>
            )}
          </span>
        </div>
        <div data-pinned-row className="flex items-center gap-2 px-2">
          {model.notPlaced.length === 0 ? (
            <div
              role="gridcell"
              tabIndex={tab(focusKeys.notPlacedEmpty)}
              data-board-focus={focusKeys.notPlacedEmpty}
              onFocus={() => onFocusTarget(focusKeys.notPlacedEmpty)}
              className="text-xs text-muted-foreground"
            >
              No job orders without a place
            </div>
          ) : (
            model.notPlaced.map((row) => (
              <div
                key={row.id}
                role="gridcell"
                tabIndex={tab(focusKeys.block(row.jobOrder.id))}
                data-board-focus={focusKeys.block(row.jobOrder.id)}
                data-job-order={row.jobOrder.displayNumber}
                aria-selected={row.order.id === selectedOrderId}
                onFocus={() => onFocusTarget(focusKeys.block(row.jobOrder.id))}
                onClick={() => onSelectOrder(row.order.id)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  onSelectOrder(row.order.id);
                }}
                className="relative flex h-7 items-center gap-1.5 overflow-hidden rounded-sm border border-foreground bg-card px-2 text-xs"
              >
                {row.order.id === selectedOrderId && (
                  <span
                    aria-hidden
                    data-selection-bar
                    className="pointer-events-none absolute inset-x-0 top-0 h-0.75 bg-foreground"
                  />
                )}
                <span className="font-mono font-bold">{row.jobOrder.displayNumber}</span>
                {row.order.article}
                <span className="sr-only">, {quantityText(row.jobOrder.quantity)}, not placed</span>
              </div>
            ))
          )}
        </div>
      </Row>
      <div className="relative">
        {bodyRows}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0"
          style={{ left: `${machineWidth}px`, width: `${timeWidth}px`, height: `${bodyRem}rem` }}
        >
          <GanttMarkerLayer markers={overlayMarkers(snapshot)} scale={scale} />
        </div>
      </div>
    </div>
  );
}
