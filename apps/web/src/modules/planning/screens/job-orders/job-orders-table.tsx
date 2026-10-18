// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDateTime } from '@northmes/contracts/format';
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link } from '@tanstack/react-router';
import {
  type ColumnDef,
  columnVisibilityFeature,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { cn } from 'cn';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Clock, Ellipsis, Lock } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import type { ColumnChoice } from '../../../../ui/components/columns-menu/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../ui/primitives/dropdown-menu.tsx';
import { Skeleton } from '../../../../ui/primitives/skeleton.tsx';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/primitives/table.tsx';
import type { GanttSnapshot, ZoomPreset } from '../../gantt-data.ts';
import type { JobOrdersSortId } from '../../job-orders-search.ts';
import { plantDateOf } from '../../timeline/time-scale.ts';
import { quantityText, statusLabel } from '../gantt/gantt-rows.ts';
import { JobOrderLateFacts } from './job-orders-late-facts.tsx';
import type { JobOrdersSort, JobOrderTableRow } from './job-orders-rows.ts';

/** One column of the table (plan 07, Job order table view): its id, header and what a cell shows. */
interface JobOrdersColumn {
  readonly id: string;
  readonly header: string;
  readonly sortable?: boolean;
  readonly numeric?: boolean;
  /** The header text is for screen readers only, as on the Actions column. */
  readonly headerHidden?: boolean;
  /** The column stays in view while the table scrolls sideways (D3 TA19). */
  readonly sticky?: boolean;
}

/** The columns in their order; Job order first and always shown. */
export const jobOrdersColumns: readonly JobOrdersColumn[] = [
  { id: 'jobOrder', header: 'Job order', sortable: true, sticky: true },
  { id: 'machine', header: 'Machine', sortable: true },
  { id: 'start', header: 'Start', sortable: true },
  { id: 'end', header: 'End', sortable: true },
  { id: 'quantity', header: 'Quantity', numeric: true },
  { id: 'status', header: 'Status' },
  { id: 'softLock', header: 'Soft lock' },
  { id: 'deadline', header: 'Deadline', sortable: true },
  { id: 'plannedEnd', header: 'Planned end', sortable: true },
  { id: 'lateBy', header: 'Late by', sortable: true },
  { id: 'actions', header: 'Actions', headerHidden: true },
];

/** The columns as the Columns menu offers them. */
export const jobOrdersColumnChoices: readonly ColumnChoice[] = jobOrdersColumns
  .filter((column) => column.headerHidden !== true)
  .map((column) => ({
    id: column.id,
    label: column.header,
    ...(column.id === 'jobOrder' && { alwaysShown: true }),
  }));

const features = tableFeatures({ rowSortingFeature, columnVisibilityFeature });

const ariaSort = { asc: 'ascending', desc: 'descending' } as const;

/** A sticky column's header and cells: they keep their place and cover what scrolls under them. */
const stickyHead = 'sticky start-0 z-10 bg-muted';
const stickyCell = 'sticky start-0 z-10 bg-card';

/** The keys of the skeleton rows a loading table draws (ST2). */
const skeletonRows = Array.from({ length: 6 }, (_, index) => `skeleton-${index}`);

/** What the cells read besides their row. */
interface CellView {
  readonly snapshot: GanttSnapshot;
  readonly zoom: ZoomPreset;
  readonly from: string;
  readonly plant: string;
  readonly expanded: ReadonlySet<string>;
  readonly onToggleFacts: (id: string) => void;
}

/** The planning pages a row's actions lead to, with the range at the row's start and its order. */
function rowTargets(row: JobOrderTableRow, { snapshot, zoom, from, plant }: CellView) {
  const start = row.jobOrder.placement?.setupStartMs;
  const search = {
    zoom,
    from: start === undefined ? from : plantDateOf(start, snapshot.plant.timeZone),
    order: row.order.id,
  };
  return {
    gantt: planningLinks.gantt({ plant }, search).href,
    board: planningLinks.board({ plant }, search).href,
  };
}

/** The status cell: the job order's status, Locked on a hard-locked operation, and Late by. */
function StatusCell({ row }: { readonly row: JobOrderTableRow }) {
  const status = row.jobOrder.status;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <StatusBadge
        tone={status === 'planned' ? 'info' : status === 'started' ? 'success' : 'neutral'}
      >
        {statusLabel(status)}
      </StatusBadge>
      {row.operation.isLocked && (
        <StatusBadge tone="neutral" icon={Lock}>
          Locked
        </StatusBadge>
      )}
      {row.analysis?.late && (
        <StatusBadge tone="destructive" icon={Clock}>
          Late {formatDuration(-row.analysis.slackElapsedS)}
        </StatusBadge>
      )}
    </span>
  );
}

/** The Late by cell: the duration with the disclosure of the late facts under the row. */
function LateByCell({ row, view }: { readonly row: JobOrderTableRow; readonly view: CellView }) {
  if (row.analysis?.late !== true) return null;
  const open = view.expanded.has(row.id);
  return (
    <span className="inline-flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-expanded={open}
        aria-label={`Late facts for ${row.jobOrder.displayNumber}`}
        onClick={() => view.onToggleFacts(row.id)}
      >
        <ChevronRight
          aria-hidden
          className={cn(
            'size-4 transition-transform motion-reduce:transition-none',
            open && 'rotate-90',
          )}
        />
      </Button>
      <span className="font-mono">{formatDuration(-row.analysis.slackElapsedS)}</span>
    </span>
  );
}

/** Move, drawn but disabled (plan 18, phase 1), and the row menu with the pages the row leads to. */
function ActionsCell({ row, view }: { readonly row: JobOrderTableRow; readonly view: CellView }) {
  const targets = rowTargets(row, view);
  return (
    <span className="flex items-center justify-end gap-1">
      <Button variant="outline" className="h-8 px-2.5" disabled>
        Move
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${row.jobOrder.displayNumber}`}
            />
          }
        >
          <Ellipsis aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem render={<Link to={targets.gantt} />}>Open on Gantt</DropdownMenuItem>
          <DropdownMenuItem render={<Link to={targets.board} />}>Show on board</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

/** The content of a cell by its column. */
function cellOf(column: string, row: JobOrderTableRow, view: CellView): ReactNode {
  const { timeZone } = view.snapshot.plant;
  const placement = row.jobOrder.placement;
  switch (column) {
    case 'jobOrder':
      return (
        <span className="flex flex-wrap items-baseline gap-x-2">
          <Link
            to={rowTargets(row, view).gantt}
            className="font-mono text-link underline underline-offset-2 hover:no-underline"
          >
            {row.jobOrder.displayNumber}
          </Link>
          <span className="text-muted-foreground">{row.order.article}</span>
        </span>
      );
    case 'machine':
      return row.machine;
    case 'start':
      return placement === undefined ? '' : formatPlantDateTime(placement.setupStartMs, timeZone);
    case 'end':
      return placement === undefined ? '' : formatPlantDateTime(placement.endMs, timeZone);
    case 'quantity':
      return quantityText(row.jobOrder.quantity);
    case 'status':
      return <StatusCell row={row} />;
    case 'softLock':
      return row.jobOrder.held ? 'Another planner' : '';
    case 'deadline':
      return formatPlantDateTime(row.order.deadlineMs, timeZone);
    case 'plannedEnd':
      return row.analysis?.plannedEndMs === undefined
        ? ''
        : formatPlantDateTime(row.analysis.plannedEndMs, timeZone);
    case 'lateBy':
      return <LateByCell row={row} view={view} />;
    case 'actions':
      return <ActionsCell row={row} view={view} />;
    default:
      return null;
  }
}

/** The columns whose cells read in Plex Mono: times and the duration. */
const monoColumns = new Set(['start', 'end', 'quantity', 'deadline', 'plannedEnd']);

export interface JobOrdersTableProps {
  /** The table's accessible name, "Job orders, W45, Mon 2 Nov to Sun 8 Nov". */
  readonly label: string;
  /** The rows in their sorted order; the table never sorts them itself. */
  readonly rows: readonly JobOrderTableRow[];
  readonly snapshot: GanttSnapshot | undefined;
  readonly zoom: ZoomPreset;
  readonly from: string;
  readonly sort: JobOrdersSort;
  readonly onSortChange: (sort: { readonly id: JobOrdersSortId; readonly desc: boolean }) => void;
  readonly hiddenColumns: readonly string[];
  /** The rows whose late facts are open. */
  readonly expanded: ReadonlySet<string>;
  readonly onToggleFacts: (id: string) => void;
  /** The rows are loading: the header stays and skeleton rows replace the rows. */
  readonly loading: boolean;
}

/**
 * The job order table (plan 07, Job order table view; D3 TA1): a semantic table on TanStack Table
 * v9 with a sort button in each sortable header and aria-sort on the sorted one, the Job order
 * column sticky at the start, one row per job order with its order's status, lock and lateness,
 * and under a late row the late facts, opened by the disclosure in Late by. Paging is the
 * server's: the fixture fits one page.
 */
export function JobOrdersTable({
  label,
  rows,
  snapshot,
  zoom,
  from,
  sort,
  onSortChange,
  hiddenColumns,
  expanded,
  onToggleFacts,
  loading,
}: JobOrdersTableProps) {
  const { plant } = useShell();
  const columns = useMemo(
    () =>
      jobOrdersColumns.map(
        (column): ColumnDef<typeof features, JobOrderTableRow> => ({
          id: column.id,
          header: column.header,
          accessorFn: (row) => row,
          enableSorting: column.sortable ?? false,
        }),
      ),
    [],
  );
  const columnVisibility = useMemo(
    () =>
      Object.fromEntries(
        jobOrdersColumns.map((column) => [column.id, !hiddenColumns.includes(column.id)]),
      ),
    [hiddenColumns],
  );
  const sorting = useMemo<SortingState>(() => [{ id: sort.id, desc: sort.desc }], [sort]);
  const table = useTable({
    features,
    columns,
    data: rows as JobOrderTableRow[],
    getRowId: (row) => row.id,
    manualSorting: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
    sortDescFirst: false,
    state: { sorting, columnVisibility },
    onSortingChange: (updater) => {
      const [next] = typeof updater === 'function' ? updater(sorting) : updater;
      if (next !== undefined) onSortChange({ id: next.id as JobOrdersSortId, desc: next.desc });
    },
  });
  const shown = jobOrdersColumns.filter((column) => !hiddenColumns.includes(column.id));
  const view: CellView | undefined =
    snapshot === undefined ? undefined : { snapshot, zoom, from, plant, expanded, onToggleFacts };
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
      <Table aria-label={label} aria-busy={loading || undefined}>
        <TableCaption className="sr-only">{label}</TableCaption>
        <TableHeader className="sticky top-0 bg-muted text-xs font-semibold text-muted-foreground">
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="border-border hover:bg-transparent">
              {group.headers.map((header) => {
                const { column } = header;
                const spec = jobOrdersColumns.find((each) => each.id === column.id);
                const sorted = column.getIsSorted();
                const text = column.columnDef.header as string;
                const classes = cn(
                  'h-auto px-3 py-1.5 text-start font-semibold text-muted-foreground',
                  spec?.numeric && 'text-end',
                  spec?.sticky && stickyHead,
                );
                if (!column.getCanSort()) {
                  return (
                    <TableHead key={header.id} scope="col" className={cn(classes, 'py-2.5')}>
                      {spec?.headerHidden ? <span className="sr-only">{text}</span> : text}
                    </TableHead>
                  );
                }
                const SortIcon =
                  sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
                return (
                  <TableHead
                    key={header.id}
                    scope="col"
                    aria-sort={sorted === false ? 'none' : ariaSort[sorted]}
                    className={classes}
                  >
                    <Button
                      variant="ghost"
                      onClick={() => column.toggleSorting()}
                      className={cn(
                        'h-auto min-h-(--nm-target-min) gap-1 rounded-sm px-0 text-xs font-semibold text-muted-foreground hover:bg-transparent hover:text-foreground active:not-aria-[haspopup]:translate-y-0',
                        sorted !== false && 'text-foreground',
                      )}
                    >
                      {text}
                      <SortIcon aria-hidden className="size-3.5" />
                    </Button>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading || view === undefined
            ? skeletonRows.map((key) => (
                <TableRow key={key} className="border-border hover:bg-transparent">
                  {shown.map((column) => (
                    <TableCell key={column.id} className="px-3 py-3.5">
                      <Skeleton
                        aria-hidden
                        className="h-3 w-24 rounded-sm bg-accent motion-reduce:animate-none"
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : table.getRowModel().rows.flatMap((row) => {
                const original = row.original;
                const cells = (
                  <TableRow
                    key={row.id}
                    data-job-order={original.jobOrder.displayNumber}
                    className="border-border hover:bg-accent"
                  >
                    {row.getVisibleCells().map((cell) => {
                      const spec = jobOrdersColumns.find((each) => each.id === cell.column.id);
                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            'px-3 py-2 whitespace-normal',
                            spec?.numeric && 'text-end tabular-nums',
                            spec?.sticky && stickyCell,
                            monoColumns.has(cell.column.id) && 'font-mono',
                          )}
                        >
                          {cellOf(cell.column.id, original, view)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
                if (!expanded.has(row.id) || original.analysis?.late !== true) return [cells];
                return [
                  cells,
                  <TableRow
                    key={`${row.id}-facts`}
                    className="border-border bg-muted hover:bg-muted"
                  >
                    <TableCell colSpan={shown.length} className="px-3 py-3 whitespace-normal">
                      <section aria-label={`Late facts for ${original.jobOrder.displayNumber}`}>
                        <JobOrderLateFacts
                          snapshot={view.snapshot}
                          orderNumber={original.order.number}
                          deadlineMs={original.order.deadlineMs}
                          analysis={original.analysis}
                        />
                      </section>
                    </TableCell>
                  </TableRow>,
                ];
              })}
        </TableBody>
      </Table>
      <div className="flex items-center gap-2 border-t border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        <span>
          {loading || rows.length === 0 ? '' : `Rows 1 to ${rows.length} of ${rows.length}`}
        </span>
        <span className="grow" />
        <Button variant="outline" className="h-8 px-3" disabled>
          Previous
        </Button>
        <Button variant="outline" className="h-8 px-3" disabled>
          Next
        </Button>
      </div>
    </div>
  );
}
