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
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Clock,
  Ellipsis,
  Lock,
  Pencil,
} from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import type { ColumnChoice } from '../../../../ui/components/columns-menu/index.ts';
import {
  type DataTableGroup,
  DataTableMenuCell,
  DataTableMenuHead,
} from '../../../../ui/components/data-table/index.ts';
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
import type { GanttSnapshot } from '../../gantt-data.ts';
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
  readonly plant: string;
  readonly expanded: ReadonlySet<string>;
  readonly onToggleFacts: (id: string) => void;
}

/** The planning pages a row's actions lead to, at the row's start with its order selected. */
function rowTargets(row: JobOrderTableRow, { snapshot, plant }: CellView) {
  const start = row.jobOrder.placement?.setupStartMs;
  const search = {
    ...(start !== undefined && { from: plantDateOf(start, snapshot.plant.timeZone) }),
    order: row.order.id,
  };
  return {
    gantt: planningLinks.gantt({ plant }, search).href,
    board: planningLinks.board({ plant }, search).href,
    order: planningLinks.orders.order({ plant, orderId: row.order.id }).href,
  };
}

/**
 * The status cell: the job order's status, In my draft on a row the planner's draft moved, Locked
 * on a hard-locked operation, and Late by.
 */
function StatusCell({ row }: { readonly row: JobOrderTableRow }) {
  const status = row.jobOrder.status;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <StatusBadge
        tone={status === 'planned' ? 'info' : status === 'started' ? 'success' : 'neutral'}
      >
        {statusLabel(status)}
      </StatusBadge>
      {row.inDraft === true && (
        <StatusBadge tone="info" icon={Pencil}>
          In my draft, not saved
        </StatusBadge>
      )}
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
          <DropdownMenuItem render={<Link to={targets.order} />}>Open order</DropdownMenuItem>
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
  /** The table's accessible name, "Job orders". */
  readonly label: string;
  /** The rows in their sorted order; the table never sorts them itself. */
  readonly rows: readonly JobOrderTableRow[];
  /**
   * The rows in groups (ADR 0091, Group by): each group is a row group with a header row that names
   * it, counts its rows and opens or closes it. With groups, `rows` is ignored.
   */
  readonly groups?: readonly DataTableGroup<JobOrderTableRow>[];
  readonly snapshot: GanttSnapshot | undefined;
  readonly sort: JobOrdersSort;
  readonly onSortChange: (sort: { readonly id: JobOrdersSortId; readonly desc: boolean }) => void;
  readonly hiddenColumns: readonly string[];
  /** The rows whose late facts are open. */
  readonly expanded: ReadonlySet<string>;
  readonly onToggleFacts: (id: string) => void;
  /** The rows are loading: the header stays and skeleton rows replace the rows. */
  readonly loading: boolean;
  /**
   * The table's menus at the end of the header row, such as Group by and Columns as icons (#875):
   * the last header cell holds them, and every row gets an empty cell under it.
   */
  readonly headerMenu?: ReactNode;
}

/**
 * The job order table (plan 07, Job order table view; D3 TA1; ADR 0091): a semantic table on
 * TanStack Table v9 with a sort button in each sortable header and aria-sort on the sorted one,
 * the Job order column sticky at the start, one row per job order with its order's status, lock
 * and lateness, under a late row the late facts, opened by the disclosure in Late by, and with
 * Group by a row group per group. Paging is the server's: the fixture fits one page.
 */
export function JobOrdersTable({
  label,
  rows,
  groups,
  snapshot,
  sort,
  onSortChange,
  hiddenColumns,
  expanded,
  onToggleFacts,
  loading,
  headerMenu,
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
  const data = useMemo(
    () => (groups === undefined ? rows : groups.flatMap((group) => group.rows)),
    [groups, rows],
  );
  const table = useTable({
    features,
    columns,
    data: data as JobOrderTableRow[],
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
  // The cells of a row: the shown columns, and the empty cell under the header menu.
  const menu = headerMenu == null || headerMenu === false ? undefined : headerMenu;
  const cellCount = shown.length + (menu === undefined ? 0 : 1);
  const menuCell = menu === undefined ? null : <DataTableMenuCell />;
  const view: CellView | undefined =
    snapshot === undefined ? undefined : { snapshot, plant, expanded, onToggleFacts };
  const tableRows = table.getRowModel().rows;
  /** A row's cells, and under a late row whose facts are open, the facts. */
  const renderRow = (row: (typeof tableRows)[number], cellView: CellView) => {
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
              {cellOf(cell.column.id, original, cellView)}
            </TableCell>
          );
        })}
        {menuCell}
      </TableRow>
    );
    if (!expanded.has(row.id) || original.analysis?.late !== true) return [cells];
    return [
      cells,
      <TableRow key={`${row.id}-facts`} className="border-border bg-muted hover:bg-muted">
        <TableCell colSpan={cellCount} className="px-3 py-3 whitespace-normal">
          <section aria-label={`Late facts for ${original.jobOrder.displayNumber}`}>
            <JobOrderLateFacts
              snapshot={cellView.snapshot}
              orderNumber={original.order.number}
              deadlineMs={original.order.deadlineMs}
              analysis={original.analysis}
            />
          </section>
        </TableCell>
      </TableRow>,
    ];
  };
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
              {menu !== undefined && <DataTableMenuHead>{menu}</DataTableMenuHead>}
            </TableRow>
          ))}
        </TableHeader>
        {loading || view === undefined ? (
          <TableBody>
            {skeletonRows.map((key) => (
              <TableRow key={key} className="border-border hover:bg-transparent">
                {shown.map((column) => (
                  <TableCell key={column.id} className="px-3 py-3.5">
                    <Skeleton
                      aria-hidden
                      className="h-3 w-24 rounded-sm bg-accent motion-reduce:animate-none"
                    />
                  </TableCell>
                ))}
                {menuCell}
              </TableRow>
            ))}
          </TableBody>
        ) : groups === undefined ? (
          <TableBody>{tableRows.flatMap((row) => renderRow(row, view))}</TableBody>
        ) : (
          groups.map((group) => {
            const ids = new Set(group.rows.map((row) => row.id));
            const groupRows = tableRows.filter((row) => ids.has(row.id));
            return (
              <TableBody key={group.id}>
                <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
                  <th
                    scope="rowgroup"
                    colSpan={cellCount}
                    className="px-3 py-1 text-start text-sm font-semibold"
                  >
                    <Button
                      variant="ghost"
                      aria-expanded={group.expanded}
                      onClick={() => group.onExpandedChange?.(!group.expanded)}
                      className="h-auto min-h-(--nm-target-min) gap-1.5 px-1 text-sm font-semibold"
                    >
                      <ChevronRight
                        aria-hidden
                        className={cn(
                          'size-4 transition-transform motion-reduce:transition-none',
                          group.expanded && 'rotate-90',
                        )}
                      />
                      {/* The button's name reads "CNC 1 4 job orders", with the space. */}
                      {group.label}{' '}
                      <span className="ms-1 font-mono text-xs font-normal text-muted-foreground">
                        {group.count}
                      </span>
                    </Button>
                  </th>
                </TableRow>
                {group.expanded === false ? null : groupRows.flatMap((row) => renderRow(row, view))}
              </TableBody>
            );
          })
        )}
      </Table>
      <div className="flex items-center gap-2 border-t border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        <span>
          {loading || data.length === 0 ? '' : `Rows 1 to ${data.length} of ${data.length}`}
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
