// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDateTime } from '@northmes/contracts/format';
import {
  type ColumnDef,
  columnVisibilityFeature,
  createExpandedRowModel,
  type ExpandedState,
  type Row,
  rowExpandingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { cn } from 'cn';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  Link2,
  Lock,
  TriangleAlert,
} from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import type { ColumnChoice } from '../../../../ui/components/columns-menu/index.ts';
import { Badge } from '../../../../ui/primitives/badge.tsx';
import { Button } from '../../../../ui/primitives/button.tsx';
import {
  ColumnResizer,
  type ColumnWidthChange,
  keyedWidth,
  widthWithin,
} from '../../components/column-resizer/index.ts';
import { useGanttView } from './gantt-context.ts';
import { GanttRowMenu } from './gantt-row-menu.tsx';
import {
  earlyText,
  type GanttRow,
  type JobOrderRow,
  type Level1Row,
  latenessText,
  machinesText,
  orderSubtext,
  quantityText,
  rowSpan,
  runLatenessText,
  runSubtext,
  runTitle,
  statusLabel,
  workingSecondsOf,
} from './gantt-rows.ts';

/** One tree column (plan 18, Tree columns): its id, header, width and what each level shows. */
export interface GanttColumn {
  readonly id: string;
  readonly header: string;
  /** The width in pixels; the Name column instead takes what the pane leaves, at least 160 px. */
  readonly widthPx: number;
  /**
   * The least width a resize leaves the column, which keeps its header readable beside its 24 px
   * resize handle (#943); the Name column has none, since it does not resize.
   */
  readonly minWidthPx?: number;
  /** Sorting on the column sorts the level 1 rows and keeps the tree under each. */
  readonly sortable?: boolean;
  readonly numeric?: boolean;
  readonly cell: (row: GanttRow, view: CellView) => ReactNode;
}

/** What a cell renderer reads besides its row. */
interface CellView {
  readonly timeZone: string;
  readonly zoneLabel: boolean;
  readonly machineName: (code: string | undefined) => string;
}

/** The float cell (plan 18, What the timeline shows): free float, "0" with the chain glyph on a critical row. */
function FloatCell({ row }: { readonly row: JobOrderRow }) {
  const float = row.analysis?.float;
  if (float === undefined) {
    return <span className="text-muted-foreground">unknown</span>;
  }
  const negative = float.totalFloatWorkingS < 0;
  const free = float.freeFloatWorkingS === 0 ? '0' : formatDuration(float.freeFloatWorkingS);
  const label = [
    `Free float ${free}`,
    float.critical ? 'on the critical chain' : undefined,
    negative ? `total float ${formatDuration(float.totalFloatWorkingS)}` : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(', ');
  return (
    <span
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1',
        float.critical && 'font-semibold text-late-foreground',
      )}
    >
      {float.critical && <Link2 aria-hidden className="size-3" />}
      {free}
      {negative && (
        <span className="text-xs font-normal text-late-foreground">
          {formatDuration(float.totalFloatWorkingS)}
        </span>
      )}
    </span>
  );
}

/** The span of a summary row or the placement of a job order row, as start and end. */
function spanOf(row: GanttRow): { readonly fromMs: number; readonly toMs: number } | undefined {
  if (row.kind === 'jobOrder') {
    const placement = row.jobOrder.placement;
    return placement === undefined
      ? undefined
      : { fromMs: placement.setupStartMs, toMs: placement.endMs };
  }
  return rowSpan(row);
}

function timeCell(which: 'fromMs' | 'toMs') {
  return (row: GanttRow, { timeZone, zoneLabel }: CellView) => {
    const span = spanOf(row);
    return span === undefined ? '' : formatPlantDateTime(span[which], timeZone, { zoneLabel });
  };
}

/** The tree columns of plan 18, Name first and always shown. */
export const ganttColumns: readonly GanttColumn[] = [
  {
    id: 'name',
    header: 'Name',
    widthPx: 300,
    sortable: true,
    cell: () => null,
  },
  {
    id: 'machine',
    header: 'Machine',
    widthPx: 96,
    minWidthPx: 88,
    cell: (row, { machineName }) =>
      row.kind === 'jobOrder'
        ? machineName(row.jobOrder.equipment)
        : row.kind === 'operation'
          ? machineName(row.operation.allowedEquipment[0])
          : '',
  },
  {
    id: 'quantity',
    header: 'Quantity',
    widthPx: 90,
    minWidthPx: 88,
    numeric: true,
    cell: (row) =>
      quantityText(
        row.kind === 'run'
          ? row.orders.reduce((sum, order) => sum + order.quantity, 0)
          : row.kind === 'order'
            ? row.order.quantity
            : row.kind === 'operation'
              ? row.operation.quantity
              : row.jobOrder.quantity,
      ),
  },
  { id: 'start', header: 'Start', widthPx: 128, minWidthPx: 80, cell: timeCell('fromMs') },
  { id: 'end', header: 'End', widthPx: 128, minWidthPx: 72, cell: timeCell('toMs') },
  {
    id: 'workingTime',
    header: 'Working time',
    widthPx: 110,
    minWidthPx: 108,
    numeric: true,
    cell: (row) => formatDuration(workingSecondsOf(row)),
  },
  {
    id: 'deadline',
    header: 'Deadline',
    widthPx: 128,
    minWidthPx: 112,
    sortable: true,
    cell: (row, { timeZone, zoneLabel }) =>
      row.kind === 'order'
        ? formatPlantDateTime(row.order.deadlineMs, timeZone, { zoneLabel })
        : row.kind === 'run'
          ? formatPlantDateTime(row.run.deadlineMs, timeZone, { zoneLabel })
          : '',
  },
  {
    id: 'lateBy',
    header: 'Late by',
    widthPx: 100,
    minWidthPx: 100,
    sortable: true,
    cell: (row) =>
      row.kind === 'order' && row.analysis?.late
        ? formatDuration(-row.analysis.slackElapsedS)
        : row.kind === 'run' && row.analysis.late
          ? formatDuration(row.analysis.lateByS)
          : '',
  },
  {
    id: 'float',
    header: 'Float',
    widthPx: 96,
    minWidthPx: 72,
    cell: (row) => (row.kind === 'jobOrder' ? <FloatCell row={row} /> : ''),
  },
  {
    id: 'status',
    header: 'Status',
    widthPx: 90,
    minWidthPx: 80,
    cell: (row) =>
      statusLabel(
        row.kind === 'jobOrder'
          ? row.jobOrder.status
          : row.kind === 'order'
            ? row.order.status
            : '',
      ),
  },
  {
    id: 'lock',
    header: 'Lock',
    widthPx: 80,
    minWidthPx: 64,
    cell: (row) => (row.kind === 'operation' && row.operation.isLocked ? 'Hard lock' : ''),
  },
];

/** The columns as the Columns menu offers them. */
export const ganttColumnChoices: readonly ColumnChoice[] = ganttColumns.map((column) => ({
  id: column.id,
  label: column.header,
  ...(column.id === 'name' && { alwaysShown: true }),
}));

const features = tableFeatures({
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
  columnVisibilityFeature,
});

/** The sort of the level 1 rows: a column and a direction. */
export interface GanttSort {
  readonly id: string;
  readonly desc: boolean;
}

/** The sort key of a level 1 row under a column; the autoplan order breaks ties. A run sorts by its deadline and its first order's number. */
function sortKey(row: Level1Row, id: string): number | string {
  switch (id) {
    case 'deadline':
      return row.kind === 'run' ? row.run.deadlineMs : row.order.deadlineMs;
    case 'lateBy':
      return row.kind === 'run'
        ? row.analysis.lateByS
        : row.analysis?.late
          ? -row.analysis.slackElapsedS
          : 0;
    default:
      return row.order.number;
  }
}

/** The level 1 rows sorted on a column, the tree under each kept. */
export function sortedOrderRows(
  rows: readonly Level1Row[],
  sort: GanttSort | undefined,
): Level1Row[] {
  if (sort === undefined) return [...rows];
  const direction = sort.desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = sortKey(a, sort.id);
    const right = sortKey(b, sort.id);
    if (left === right) return 0;
    return (left < right ? -1 : 1) * direction;
  });
}

export interface GanttTableInput {
  readonly rows: readonly Level1Row[];
  readonly sort: GanttSort | undefined;
  readonly hiddenColumns: readonly string[];
  readonly expanded: ExpandedState;
  readonly onExpandedChange: (expanded: ExpandedState) => void;
}

/** A row of the tree as TanStack flattens it under the expanded state. */
export type GanttTableRow = Row<typeof features, GanttRow>;

/**
 * The tree table (plan 18, Tree columns): TanStack Table v9 over the three levels with the
 * expanded row model, so the visible rows come flattened with their depth, and column visibility
 * from the Columns menu. Sorting is the screen's: it sorts the level 1 rows and keeps the tree.
 */
export function useGanttTable({
  rows,
  sort,
  hiddenColumns,
  expanded,
  onExpandedChange,
}: GanttTableInput) {
  const data = useMemo(() => sortedOrderRows(rows, sort) as GanttRow[], [rows, sort]);
  const columns = useMemo(
    () =>
      ganttColumns.map(
        (column): ColumnDef<typeof features, GanttRow> => ({
          id: column.id,
          header: column.header,
          accessorFn: (row) => row,
        }),
      ),
    [],
  );
  const columnVisibility = useMemo(
    () =>
      Object.fromEntries(
        ganttColumns.map((column) => [column.id, !hiddenColumns.includes(column.id)]),
      ),
    [hiddenColumns],
  );
  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => row.id,
    getSubRows: (row) => row.subRows as GanttRow[],
    // Without pagination the expanded model flattens the subrows only under this option, and a
    // snapshot that arrives must not fold the tree the planner has opened.
    paginateExpandedRows: true,
    autoResetExpanded: false,
    state: { expanded, columnVisibility },
    onExpandedChange: (updater) => {
      onExpandedChange(typeof updater === 'function' ? updater(expanded) : updater);
    },
  });
  return table;
}

/** The most a resize makes a tree column. */
export const columnMaxPx = 480;

/** A column's width within its bounds: its least width and the most a resize makes a column. */
export function columnWidthWithin(column: GanttColumn, width: number): number {
  return widthWithin(width, column.minWidthPx ?? 0, columnMaxPx);
}

/**
 * The visible columns in order, each at the width the planner gave it, if any, within its bounds;
 * the Name column takes the rest of the pane whatever is kept for it.
 */
export function visibleColumns(
  hiddenColumns: readonly string[],
  widths: Readonly<Record<string, number>> = {},
): GanttColumn[] {
  return ganttColumns
    .filter((column) => column.id === 'name' || !hiddenColumns.includes(column.id))
    .map((column) => {
      const kept = widths[column.id];
      return column.id === 'name' || kept === undefined
        ? column
        : { ...column, widthPx: columnWidthWithin(column, kept) };
    });
}

/** The least width of the tree pane, of its Name column and of the time area beside it. */
const leastPx = 160;

/** How the tree pane lays out at a view width (#943). */
export interface TreePaneLayout {
  /** The pane's width, which the splitter sets as a share of the view. */
  readonly paneWidth: number;
  /** The least and the most the splitter may make it. */
  readonly minWidth: number;
  readonly maxWidth: number;
  /** The tree columns' CSS grid tracks inside the pane. */
  readonly tracks: string;
  /** The pane's width less its 1 px end border: what the columns show at once. */
  readonly innerWidth: number;
  /** The tree columns' full width; the pane scrolls when it is wider than the inner width. */
  readonly contentWidth: number;
}

/**
 * The tree pane at a view width and the share the splitter set (#943): the pane takes the share
 * within 160 px and what leaves the time area 160 px, as far as the view allows both, and the Name
 * column takes what the other columns leave of it at their default widths, never under 160 px, so
 * a resized column moves only the columns after it and its own edge follows the pointer. Columns
 * wider than the pane scroll inside it, so the pane always sticks as one block.
 */
export function treePaneLayout(
  columns: readonly GanttColumn[],
  viewWidth: number,
  share: number,
): TreePaneLayout {
  const maxWidth = Math.max(leastPx, Math.floor(viewWidth - leastPx));
  const minWidth = leastPx;
  const paneWidth = Math.min(maxWidth, Math.max(minWidth, Math.round(viewWidth * share)));
  const innerWidth = paneWidth - 1;
  const others = columns.slice(1);
  const fixedWidth = others.reduce((sum, column) => sum + column.widthPx, 0);
  const defaultWidth = others.reduce(
    (sum, column) =>
      sum + (ganttColumns.find((each) => each.id === column.id)?.widthPx ?? column.widthPx),
    0,
  );
  // At the least pane width a lone Name column fits the inner width, so the pane has nothing to
  // scroll.
  const nameWidth = Math.max(Math.min(leastPx, innerWidth), innerWidth - defaultWidth);
  return {
    paneWidth,
    minWidth,
    maxWidth,
    innerWidth,
    tracks: [nameWidth, ...others.map((column) => column.widthPx)]
      .map((width) => `${width}px`)
      .join(' '),
    contentWidth: nameWidth + fixedWidth,
  };
}

/**
 * The tree pane's part of one row (#943): one block that sticks at the grid's start edge and covers
 * whatever the time area draws under it, holding the tree cells, which the pane's own scrollbar
 * shifts through --tree-scroll when they are wider than the pane. Clipped, not a scroll container,
 * so focus never scrolls one row's cells out of line with the others.
 */
export function TreePane({
  layout,
  className,
  selected = false,
  children,
}: {
  readonly layout: TreePaneLayout;
  /** The row's background, which the pane needs to cover the time area. */
  readonly className: string;
  /** Draws the 3 px selection bar at the pane's start edge, which stays while the cells scroll. */
  readonly selected?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div
      data-tree-pane
      className={cn('sticky start-0 z-10 overflow-clip border-e border-border', className)}
    >
      <div
        className={cn(
          'grid h-full',
          // The pane's own end border closes the last column when the columns fill it.
          layout.contentWidth >= layout.innerWidth && '[&>:last-child]:border-e-0',
        )}
        style={{
          gridTemplateColumns: layout.tracks,
          width: `${layout.contentWidth}px`,
          transform: 'translateX(calc(-1 * var(--tree-scroll, 0px)))',
        }}
      >
        {children}
      </div>
      {selected && (
        <span
          aria-hidden
          data-selection-bar
          className="pointer-events-none absolute inset-y-0 start-0 w-0.75 bg-foreground"
        />
      )}
    </div>
  );
}

const ariaSort = { asc: 'ascending', desc: 'descending' } as const;

/**
 * The header cells of the tree pane: a sort button with aria-sort on a sortable column, and on
 * every column but Name the resize handle at its end edge (#943), which Alt+Left and Alt+Right on
 * the sort button also move. Every header is a Tab stop, by its sort button or its handle, so the
 * keyboard reaches every column of a pane that scrolls sideways, which scrolls the focused header
 * into view.
 */
export function GanttTreeHeaderCells({
  columns,
  layout,
  sort,
  onSortChange,
  onColumnWidthChange,
}: {
  readonly columns: readonly GanttColumn[];
  readonly layout: TreePaneLayout;
  readonly sort: GanttSort | undefined;
  readonly onSortChange: (sort: GanttSort) => void;
  /** A change of a column's width (see ColumnResizer). */
  readonly onColumnWidthChange: (id: string, ...change: Parameters<ColumnWidthChange>) => void;
}) {
  return (
    <TreePane layout={layout} className="bg-muted">
      {columns.map((column) => {
        const sorted = sort?.id === column.id ? (sort.desc ? 'desc' : 'asc') : undefined;
        const SortIcon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
        const resizable = column.id !== 'name';
        return (
          <div
            key={column.id}
            role="columnheader"
            // Named by its text alone, not by the resize handle inside it.
            aria-label={column.header}
            aria-sort={
              column.sortable ? (sorted === undefined ? 'none' : ariaSort[sorted]) : undefined
            }
            onKeyDown={(event) => {
              // Alt+Left and Alt+Right on the sort button resize the column it heads; on Name,
              // which does not resize, they do nothing rather than leave the page.
              if (event.target === event.currentTarget) return;
              const next = keyedWidth(event, column.widthPx, { alt: true });
              if (next === undefined) return;
              event.preventDefault();
              event.stopPropagation();
              if (resizable) onColumnWidthChange(column.id, columnWidthWithin(column, next), true);
            }}
            className={cn(
              // A numeric header ends where its values end, under the transparent handle.
              'relative flex min-w-0 items-center border-e border-border bg-muted px-2 text-xs font-semibold text-muted-foreground',
              column.numeric && 'justify-end',
            )}
          >
            {column.sortable ? (
              <Button
                variant="ghost"
                className="-mx-2 h-7 gap-1 px-2 text-xs font-semibold text-muted-foreground"
                onClick={() => onSortChange({ id: column.id, desc: sorted === 'asc' })}
              >
                {column.header}
                <SortIcon aria-hidden className="size-3.5" />
              </Button>
            ) : (
              column.header
            )}
            {resizable && (
              <ColumnResizer
                column={column.header}
                width={column.widthPx}
                minWidth={column.minWidthPx ?? 0}
                maxWidth={columnMaxPx}
                onWidthChange={(width, done) => onColumnWidthChange(column.id, width, done)}
              />
            )}
          </div>
        );
      })}
    </TreePane>
  );
}

/** The row header of a row: the disclosure button on a summary row, the name and its subtext, and the menu of a run or order row. */
export function GanttRowHeader({
  row,
  expanded,
  onToggle,
}: {
  readonly row: GanttTableRow;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  const { timeZone, machineName, materialShortages, materialShortOrderIds } = useGanttView();
  const original = row.original;
  const materialBadge = (
    <Badge
      key="material"
      variant="outline"
      className="h-4.5 border-warning bg-warning-subtle px-1.5 text-warning"
    >
      <TriangleAlert aria-hidden />
      Material short
    </Badge>
  );
  const canExpand = row.getCanExpand();
  const subject =
    original.kind === 'run'
      ? `the run of ${original.run.article}`
      : original.kind === 'order'
        ? `order ${original.order.number}`
        : original.kind === 'operation'
          ? `operation ${original.operation.displayNumber}`
          : '';
  let title: string;
  let subtext: string;
  const badges: ReactNode[] = [];
  if (original.kind === 'run') {
    title = runTitle(original.run);
    subtext = runSubtext(original, timeZone);
    badges.push(
      <Badge key="run" variant="outline" className="h-4.5 px-1.5">
        <Layers aria-hidden />
        Run
      </Badge>,
    );
    if (original.analysis.late) {
      badges.push(
        <Badge
          key="late"
          variant="outline"
          className="h-4.5 border-late-foreground bg-late px-1.5 text-late-foreground"
        >
          <Clock aria-hidden />
          {runLatenessText(original.analysis)}
        </Badge>,
      );
    }
  } else if (original.kind === 'order') {
    title = original.order.number;
    subtext = orderSubtext(original.order, timeZone);
    if (original.early !== undefined) {
      badges.push(
        <Badge
          key="early"
          variant="outline"
          className="h-4.5 border-warning bg-warning-subtle px-1.5 text-warning-foreground"
        >
          <CalendarClock aria-hidden />
          {earlyText(original.early)}
        </Badge>,
      );
    }
    if (original.analysis?.late) {
      badges.push(
        <Badge
          key="late"
          variant="outline"
          className="h-4.5 border-late-foreground bg-late px-1.5 text-late-foreground"
        >
          <Clock aria-hidden />
          {latenessText(original.analysis)}
        </Badge>,
      );
    }
    // The order row carries the warning of its operations, so a collapsed tree still shows it.
    if (materialShortOrderIds?.has(original.order.id)) badges.push(materialBadge);
  } else if (original.kind === 'operation') {
    title = `${original.operation.displayNumber} ${original.operation.name}`;
    subtext = [
      quantityText(original.operation.quantity),
      machinesText(original.operation, machineName),
      original.notPlaced > 0 ? `${original.notPlaced} not placed` : undefined,
    ]
      .filter((part) => part !== undefined)
      .join(', ');
    if (original.operation.isLocked) {
      badges.push(
        <Badge key="lock" variant="outline" className="h-4.5 px-1.5">
          <Lock aria-hidden />
          Locked
        </Badge>,
      );
    }
    if (materialShortages?.has(original.operation.displayNumber)) badges.push(materialBadge);
  } else {
    title = machineName(original.jobOrder.equipment);
    subtext = `${quantityText(original.jobOrder.quantity)}, ${statusLabel(original.jobOrder.status)}`;
  }
  return (
    <>
      {canExpand ? (
        <button
          type="button"
          tabIndex={-1}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${subject}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent"
        >
          {expanded ? (
            <ChevronDown aria-hidden className="size-4" />
          ) : (
            <ChevronRight aria-hidden className="size-4" />
          )}
        </button>
      ) : (
        <span aria-hidden className="size-6 shrink-0" />
      )}
      <span className="grid min-w-0 leading-4">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 font-mono text-data font-semibold">{title}</span>
          {badges}
        </span>
        <span className="truncate text-xs text-muted-foreground">{subtext}</span>
      </span>
      {(original.kind === 'run' || original.kind === 'order') && <GanttRowMenu row={original} />}
    </>
  );
}
