// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  type ColumnDef,
  type RowData,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { cn } from 'cn';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { Button } from '../../primitives/button.tsx';

/** One column of a DataTable. */
export interface DataTableColumn<TRow> {
  /** The column's id, which is also the sort key the server takes. */
  readonly id: string;
  /** The header text, which also names the column's sort button. */
  readonly header: string;
  readonly cell: (row: TRow) => ReactNode;
  /** The server sorts on this column; its header becomes a sort button with aria-sort. */
  readonly sortable?: boolean;
}

/** The sort the server applied: one column, ascending or descending. */
export interface DataTableSort {
  readonly id: string;
  readonly desc: boolean;
}

/** Keyset paging (ADR 0016): Previous and Next, never page numbers. */
export interface DataTablePaging {
  /** The 1-based page counter that travels with the cursor in the URL. */
  readonly page: number;
  readonly pageSize: number;
  /** The rows of the whole list; without it the pager shows no row range. */
  readonly totalCount?: number;
  readonly hasPreviousPage: boolean;
  readonly hasNextPage: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}

export interface DataTableProps<TRow> {
  /** The table's accessible name, such as "Articles". */
  readonly label: string;
  /** Keep the array stable between renders, for example as a module constant. */
  readonly columns: readonly DataTableColumn<TRow>[];
  /** One page of rows in the server's order; the table never sorts or slices them. */
  readonly rows: readonly TRow[];
  readonly getRowId: (row: TRow) => string;
  readonly sort?: DataTableSort;
  readonly onSortChange?: (sort: DataTableSort) => void;
  readonly paging?: DataTablePaging;
  /** The rows are loading: the header stays, skeleton rows replace the rows, the table is busy. */
  readonly loading?: boolean;
}

const features = tableFeatures({ rowSortingFeature });

/** The keys of the skeleton rows a loading table draws, as in the design's loading state (ST2). */
const skeletonRows = Array.from({ length: 8 }, (_, index) => `skeleton-${index}`);

const ariaSort = { asc: 'ascending', desc: 'descending' } as const;

/**
 * A list on TanStack Table v9 with sorting and paging on the server (plan 06, Lists; design
 * ui-222): the header of a sortable column is a button that sorts ascending first and then flips
 * the direction, its aria-sort shows the sort, and the pager has Previous and Next with the row
 * range, such as "Rows 1 to 25 of 63". Focus stays on the control that was used.
 */
export function DataTable<TRow extends RowData>({
  label,
  columns,
  rows,
  getRowId,
  sort,
  onSortChange,
  paging,
  loading = false,
}: DataTableProps<TRow>) {
  const tableColumns = useMemo(
    () =>
      columns.map(
        (column): ColumnDef<typeof features, TRow> => ({
          id: column.id,
          header: column.header,
          accessorFn: (row) => row,
          cell: ({ row }) => column.cell(row.original),
          enableSorting: column.sortable ?? false,
        }),
      ),
    [columns],
  );
  const sorting = useMemo<SortingState>(
    () => (sort === undefined ? [] : [{ id: sort.id, desc: sort.desc }]),
    [sort],
  );
  const table = useTable({
    features,
    columns: tableColumns,
    data: rows,
    getRowId: (row) => getRowId(row),
    manualSorting: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
    sortDescFirst: false,
    state: { sorting },
    onSortingChange: (updater) => {
      const [next] = typeof updater === 'function' ? updater(sorting) : updater;
      if (next !== undefined) onSortChange?.({ id: next.id, desc: next.desc });
    },
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
      <div className="overflow-x-auto">
        <table aria-busy={loading || undefined} className="w-full border-collapse text-sm">
          <caption className="sr-only">{label}</caption>
          <thead className="sticky top-0 bg-muted text-xs font-semibold text-muted-foreground">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const { column } = header;
                  const sorted = column.getIsSorted();
                  const text = column.columnDef.header as string;
                  if (!column.getCanSort()) {
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        className="whitespace-nowrap px-3 py-2.5 text-start"
                      >
                        {text}
                      </th>
                    );
                  }
                  const SortIcon =
                    sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === false ? 'none' : ariaSort[sorted]}
                      className="whitespace-nowrap px-3 py-1.5 text-start"
                    >
                      <button
                        type="button"
                        onClick={() => column.toggleSorting()}
                        className={cn(
                          'inline-flex min-h-(--nm-target-min) items-center gap-1 rounded-sm hover:text-foreground',
                          sorted !== false && 'text-foreground',
                        )}
                      >
                        {text}
                        <SortIcon aria-hidden className="size-3.5" />
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading
              ? skeletonRows.map((key) => (
                  <tr key={key} className="border-t border-border">
                    {columns.map((column) => (
                      <td key={column.id} className="px-3 py-3.5">
                        <span
                          aria-hidden
                          className="block h-3 w-24 animate-pulse rounded-sm bg-accent motion-reduce:animate-none"
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-t border-border hover:bg-accent">
                    {row.getAllCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5">
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {paging !== undefined && <Pager paging={paging} rowCount={loading ? 0 : rows.length} />}
    </div>
  );
}

/** "Rows 51 to 75 of 248" for this page, or nothing without a total or rows. */
function rowRange({ page, pageSize, totalCount }: DataTablePaging, rowCount: number): string {
  if (totalCount === undefined || rowCount === 0) return '';
  const first = (page - 1) * pageSize + 1;
  return `Rows ${first} to ${first + rowCount - 1} of ${totalCount}`;
}

/**
 * Previous and Next with the row range. A disabled button leaves the Tab order; when the button
 * that was just used becomes disabled, focus moves to the other one instead of getting lost.
 */
function Pager({
  paging,
  rowCount,
}: {
  readonly paging: DataTablePaging;
  readonly rowCount: number;
}) {
  const { hasPreviousPage, hasNextPage, onPrevious, onNext } = paging;
  const previous = useRef<HTMLElement>(null);
  const next = useRef<HTMLElement>(null);
  const used = useRef<'previous' | 'next' | null>(null);

  useEffect(() => {
    const lost = (button: HTMLElement | null) =>
      document.activeElement === button || document.activeElement === document.body;
    if (used.current === 'next' && !hasNextPage && lost(next.current)) previous.current?.focus();
    if (used.current === 'previous' && !hasPreviousPage && lost(previous.current))
      next.current?.focus();
  }, [hasPreviousPage, hasNextPage]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{rowRange(paging, rowCount)}</p>
      <div className="flex gap-2">
        <Button
          ref={previous}
          variant="outline"
          disabled={!hasPreviousPage}
          onClick={() => {
            used.current = 'previous';
            onPrevious();
          }}
        >
          <ChevronLeft aria-hidden />
          Previous
        </Button>
        <Button
          ref={next}
          variant="outline"
          disabled={!hasNextPage}
          onClick={() => {
            used.current = 'next';
            onNext();
          }}
        >
          Next
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
