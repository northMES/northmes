// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDate, formatPlantDay } from '@northmes/contracts/format';
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ChartNoAxesGantt, Clock, Ellipsis, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../ui/primitives/dropdown-menu.tsx';
import { CustomerLink } from '../../components/customer-link/index.ts';
import { CustomerOrderLink } from '../../components/customer-order-link/index.ts';
import {
  type ListFilterField,
  OrderListToolbar,
} from '../../components/order-list-toolbar/index.ts';
import type { GanttSnapshot } from '../../gantt-data.ts';
import { createReason } from '../../mock-reasons.ts';
import { plantTime, timelineLinks } from '../../order-facts.ts';
import {
  type LineListRow,
  lineFacets,
  lineListRows,
  lineRowMatches,
  sortedLineRows,
} from '../../order-list-rows.ts';
import {
  type CustomerOrderListSearch,
  customerOrderListSearch,
  filteredBy,
  type LineSortId,
  notSupplied,
  searchedFor,
  sortedBy,
  sortOf,
  unfiltered,
  urlSearchOf,
  withLateOnly,
} from '../../order-list-search.ts';
import { usePlanningSnapshot } from '../../use-planning-snapshot.ts';
import { quantityText, statusLabel } from '../gantt/gantt-rows.ts';

/** The id of the search input, where Clear filters moves focus. */
const searchFieldId = 'customer-orders-search';

interface CellView {
  readonly snapshot: GanttSnapshot;
  readonly plant: string;
}

/** The order that supplies a line, with its status, Late by and deadline; or Not supplied (CO1). */
function SuppliedBy({ row, view }: { readonly row: LineListRow; readonly view: CellView }) {
  if (row.order === undefined) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <StatusBadge tone="neutral">Not supplied</StatusBadge>
        <span className="text-xs text-muted-foreground">No production order yet</span>
      </span>
    );
  }
  const { order, analysis } = row;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Link
        to={timelineLinks(view.snapshot, order, view.plant).order}
        className="font-mono text-link underline underline-offset-2 hover:no-underline"
      >
        Order {order.number}
      </Link>
      <StatusBadge tone={order.status === 'released' ? 'success' : 'info'}>
        {statusLabel(order.status)}
      </StatusBadge>
      {analysis?.late && (
        <StatusBadge tone="destructive" icon={Clock}>
          Late {formatDuration(-analysis.slackElapsedS)}
        </StatusBadge>
      )}
      <span className="text-xs text-muted-foreground">
        deadline {formatPlantDate(order.deadlineMs, view.snapshot.plant.timeZone)}
      </span>
    </span>
  );
}

/** Open on Gantt for a supplied line, New order for one without an order, and the row menu. */
function RowActions({ row, view }: { readonly row: LineListRow; readonly view: CellView }) {
  const links =
    row.order === undefined ? undefined : timelineLinks(view.snapshot, row.order, view.plant);
  return (
    <span className="flex items-center justify-end gap-1">
      {links === undefined ? (
        <Link
          to={planningLinks.orders.new({ plant: view.plant }, { line: row.line.id }).href}
          className={`${buttonVariants({ variant: 'outline' })} h-8 px-2.5`}
          aria-label={`New order for customer order ${row.line.customerOrder} line ${row.line.line}`}
        >
          <Plus aria-hidden />
          New order
        </Link>
      ) : (
        <Link to={links.gantt} className={`${buttonVariants({ variant: 'outline' })} h-8 px-2.5`}>
          <ChartNoAxesGantt aria-hidden />
          Open on Gantt
        </Link>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for customer order ${row.line.customerOrder} line ${row.line.line}`}
            />
          }
        >
          <Ellipsis aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {links === undefined ? (
            <DropdownMenuItem
              render={
                <Link
                  to={planningLinks.orders.new({ plant: view.plant }, { line: row.line.id }).href}
                />
              }
            >
              New production order
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem render={<Link to={links.order} />}>Open order</DropdownMenuItem>
              <DropdownMenuItem render={<Link to={links.board} />}>Show on board</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

/** The columns (design #687, CO1): one row per customer order line. */
function columnsOf(view: CellView): readonly DataTableColumn<LineListRow>[] {
  return [
    {
      id: 'wanted',
      header: 'Wanted',
      sortable: true,
      cell: (row) => <span className="font-mono">{formatPlantDay(row.line.wantedDate)}</span>,
    },
    {
      id: 'customerOrder',
      header: 'Customer order',
      sortable: true,
      cell: (row) => (
        <span className="flex flex-col" data-line={row.id}>
          <span>
            <CustomerOrderLink number={row.line.customerOrder} />{' '}
            <span className="text-xs text-muted-foreground">line {row.line.line}</span>
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {row.line.customersReference}
          </span>
        </span>
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      sortable: true,
      cell: (row) => (
        <span className="flex flex-col">
          <CustomerLink code={row.line.customerCode} name={row.customerName} />
          <span className="font-mono text-xs text-muted-foreground">{row.line.customerCode}</span>
        </span>
      ),
    },
    { id: 'article', header: 'Article', sortable: true, cell: (row) => row.line.article },
    {
      id: 'quantity',
      header: 'Quantity',
      numeric: true,
      cell: (row) => <span className="font-mono">{quantityText(row.line.quantity)}</span>,
    },
    {
      id: 'suppliedBy',
      header: 'Supplied by',
      cell: (row) => <SuppliedBy row={row} view={view} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      headerHidden: true,
      cell: (row) => <RowActions row={row} view={view} />,
    },
  ];
}

const columnChoices = [
  { id: 'wanted', label: 'Wanted', alwaysShown: true },
  { id: 'customerOrder', label: 'Customer order' },
  { id: 'customer', label: 'Customer' },
  { id: 'article', label: 'Article' },
  { id: 'quantity', label: 'Quantity' },
  { id: 'suppliedBy', label: 'Supplied by' },
] as const;

function sortText(sort: { readonly id: LineSortId; readonly desc: boolean }): string {
  if (sort.id === 'wanted' && !sort.desc) return 'Sorted by wanted date.';
  const header = columnChoices.find((column) => column.id === sort.id)?.label ?? sort.id;
  return `Sorted by ${header.toLowerCase()}, ${sort.desc ? 'descending' : 'ascending'}.`;
}

/**
 * The customer orders list (plan 07, customer orders and demand; design #687, CO1 and CO2): one row
 * per customer order line, because the planning filters are line facts (F0 assumption 4), with the
 * customer order and the customer's own reference, the customer, the article, the quantity, the
 * wanted date and the production order that supplies the line with its status, Late by and
 * deadline, or Not supplied. Open on Gantt for a supplied line; New order, which waits for the
 * planning server, for one without an order. Search, Late only, the filters and the sort live in
 * the URL (ADR 0062); the columns stay local.
 */
export function CustomerOrdersScreen() {
  const { plant } = useShell();
  const view = customerOrderListSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const show = (next: CustomerOrderListSearch) =>
    navigate({ to: '.', search: urlSearchOf(next), replace: true });
  const { snapshot, error, retry } = usePlanningSnapshot();
  const [hiddenColumns, setHiddenColumns] = useState<readonly string[]>([]);

  const allRows = useMemo(() => (snapshot === undefined ? [] : lineListRows(snapshot)), [snapshot]);
  const sort = sortOf<LineSortId>(view, 'wanted');
  const rows = useMemo(
    () =>
      sortedLineRows(
        allRows.filter((row) => lineRowMatches(row, view)),
        sort,
      ),
    [allRows, view, sort],
  );
  const customerName = (code: string) =>
    snapshot?.customers?.find((customer) => customer.code === code)?.name ?? code;
  const statusName = (value: string) =>
    value === notSupplied ? 'Not supplied' : statusLabel(value);
  const labelOf = (key: 'status' | 'article' | 'customer') =>
    key === 'status' ? statusName : key === 'customer' ? customerName : (value: string) => value;
  const fields: ListFilterField[] = (
    [
      ['status', 'Status', 'Show lines whose order has these statuses', 'Remove the status filter'],
      ['article', 'Article', 'Show lines of these articles', 'Remove the article filter'],
      ['customer', 'Customer', 'Show lines of these customers', 'Remove the customer filter'],
    ] as const
  ).map(([key, label, heading, remove]) => ({
    key,
    label,
    heading,
    remove,
    values: lineFacets(allRows, view, key, labelOf(key)),
    picked: view[key] ?? [],
  }));

  const cellView = snapshot === undefined ? undefined : { snapshot, plant };
  const columns = useMemo(() => (cellView === undefined ? [] : columnsOf(cellView)), [cellView]);
  const lateCount = rows.filter((row) => row.analysis?.late).length;
  const unsupplied = rows.filter((row) => row.order === undefined).length;
  const statusLine = `${[
    `${rows.length} customer order line${rows.length === 1 ? '' : 's'}`,
    lateCount > 0 ? `${lateCount} supplied by a late order` : undefined,
    unsupplied > 0 ? `${unsupplied} without a production order` : undefined,
    view.late === 1 ? 'late only' : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(', ')}. ${sortText(sort)}`;
  const announced = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (snapshot === undefined) return;
    if (announced.current !== undefined && announced.current !== statusLine) announce(statusLine);
    announced.current = statusLine;
  }, [snapshot, statusLine]);

  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load customer orders', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (rows.length === 0 && allRows.length > 0) {
    state = {
      status: 'empty',
      title: 'No customer order lines match these filters',
      description: 'Change or clear the filters to see customer orders again.',
      action: (
        <Button
          variant="link"
          onClick={() => {
            show(withLateOnly(unfiltered(searchedFor(view, '')), false));
            document.getElementById(searchFieldId)?.focus();
          }}
        >
          Clear filters
        </Button>
      ),
    };
  } else if (allRows.length === 0) {
    state = {
      status: 'empty',
      title: 'No customer orders yet',
      description:
        'Customer orders come from the ERP with the next import, or a planner enters one here.',
      action: (
        <Link to={planningLinks.customerOrders.new({ plant }).href} className={buttonVariants()}>
          <Plus aria-hidden />
          New customer order
        </Link>
      ),
    };
  }
  return (
    <PageFrame
      title="Customer orders"
      meta={
        snapshot?.erp === undefined ? undefined : (
          <span className="text-sm text-muted-foreground">
            ERP data as of {plantTime(snapshot, snapshot.erp.importedAtMs)}
          </span>
        )
      }
      actions={
        <Link to={planningLinks.customerOrders.new({ plant }).href} className={buttonVariants()}>
          <Plus aria-hidden />
          New customer order
        </Link>
      }
      toolbar={
        <div className="flex flex-col gap-2">
          <OrderListToolbar
            searchId={searchFieldId}
            searchLabel="Search customer orders"
            q={view.q ?? ''}
            onSearch={(q) => show(searchedFor(view, q))}
            lateOnly={view.late === 1}
            onLateOnlyChange={(on) => show(withLateOnly(view, on))}
            fields={fields}
            onFilterChange={(key, values) => show(filteredBy(view, key, values))}
            onClearFilters={() => show(unfiltered(view))}
            columns={columnChoices}
            hiddenColumns={hiddenColumns}
            onHiddenColumnsChange={setHiddenColumns}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <p data-list-status>{statusLine}</p>
            <p className="flex flex-wrap gap-x-2">
              {snapshot?.fixture !== undefined && <span>Showing fixture {snapshot.fixture}.</span>}
              <span>{createReason}</span>
            </p>
          </div>
        </div>
      }
      state={state}
    >
      <DataTable
        label="Customer order lines"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        hiddenColumns={hiddenColumns}
        loading={snapshot === undefined}
        sort={sort}
        onSortChange={(next) =>
          show(sortedBy<CustomerOrderListSearch, LineSortId>(view, next, 'wanted'))
        }
        paging={{
          page: 1,
          pageSize: Math.max(25, rows.length),
          totalCount: rows.length,
          hasPreviousPage: false,
          hasNextPage: false,
          onPrevious: () => {},
          onNext: () => {},
        }}
      />
    </PageFrame>
  );
}
