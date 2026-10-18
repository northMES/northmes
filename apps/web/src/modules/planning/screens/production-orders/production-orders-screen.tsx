// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDateTime } from '@northmes/contracts/format';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ChartNoAxesGantt, Clock, Ellipsis, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChoiceMenu } from '../../../../ui/components/choice-menu/index.ts';
import {
  DataTable,
  type DataTableColumn,
  type DataTableGroup,
} from '../../../../ui/components/data-table/index.ts';
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
import {
  type ListFilterField,
  OrderListToolbar,
} from '../../components/order-list-toolbar/index.ts';
import type { GanttSnapshot } from '../../gantt-data.ts';
import { createReason } from '../../mock-reasons.ts';
import { plantTime, timelineLinks } from '../../order-facts.ts';
import {
  groupCountText,
  groupedOrderRows,
  type OrderListRow,
  orderFacets,
  orderListRows,
  orderRowMatches,
  sortedOrderRows,
} from '../../order-list-rows.ts';
import {
  filteredBy,
  groupedBy,
  type OrderGroupKey,
  type OrderListSearch,
  type OrderSortId,
  orderListSearch,
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
const searchFieldId = 'production-orders-search';

/** The choices of Group by (design #687, PL3). */
const groupChoices: readonly {
  readonly value: OrderGroupKey | undefined;
  readonly label: string;
}[] = [
  { value: undefined, label: 'No grouping' },
  { value: 'article', label: 'Article' },
  { value: 'customer', label: 'Customer' },
  { value: 'status', label: 'Status' },
  { value: 'deadlineWeek', label: 'Deadline week' },
];

/** What the cells read besides their row. */
interface CellView {
  readonly snapshot: GanttSnapshot;
  readonly plant: string;
}

/** The order number, the link to the order's page (IdentifierLink in the design). */
function OrderLink({ row, view }: { readonly row: OrderListRow; readonly view: CellView }) {
  return (
    <Link
      to={timelineLinks(view.snapshot, row.order, view.plant).order}
      className="font-mono text-link underline underline-offset-2 hover:no-underline"
      data-order={row.order.number}
    >
      {row.order.number}
    </Link>
  );
}

/** Open on Gantt and the row menu with Show on board and Open order (PL1). */
function RowActions({ row, view }: { readonly row: OrderListRow; readonly view: CellView }) {
  const links = timelineLinks(view.snapshot, row.order, view.plant);
  return (
    <span className="flex items-center justify-end gap-1">
      <Link to={links.gantt} className={`${buttonVariants({ variant: 'outline' })} h-8 px-2.5`}>
        <ChartNoAxesGantt aria-hidden />
        Open on Gantt
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for order ${row.order.number}`}
            />
          }
        >
          <Ellipsis aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem render={<Link to={links.order} />}>Open order</DropdownMenuItem>
          <DropdownMenuItem render={<Link to={links.board} />}>Show on board</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

/** The columns (design #687, PL1), each reading the snapshot through the view it closes over. */
function columnsOf(view: CellView): readonly DataTableColumn<OrderListRow>[] {
  const { timeZone } = view.snapshot.plant;
  return [
    {
      id: 'order',
      header: 'Order',
      sortable: true,
      cell: (row) => <OrderLink row={row} view={view} />,
    },
    {
      id: 'article',
      header: 'Article',
      sortable: true,
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block size-3 rounded-sm border border-border"
            style={{ background: `var(--${row.order.color})` }}
          />
          {row.order.article}
        </span>
      ),
    },
    {
      id: 'quantity',
      header: 'Quantity',
      numeric: true,
      cell: (row) => <span className="font-mono">{quantityText(row.order.quantity)}</span>,
    },
    {
      id: 'deadline',
      header: 'Deadline',
      sortable: true,
      cell: (row) => (
        <span className="font-mono">{formatPlantDateTime(row.order.deadlineMs, timeZone)}</span>
      ),
    },
    {
      id: 'priority',
      header: 'Priority',
      sortable: true,
      numeric: true,
      cell: (row) => <span className="font-mono">{row.order.priority ?? ''}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone={row.order.status === 'released' ? 'success' : 'info'}>
            {statusLabel(row.order.status)}
          </StatusBadge>
          {row.analysis?.late && (
            <StatusBadge tone="destructive" icon={Clock}>
              Late {formatDuration(-row.analysis.slackElapsedS)}
            </StatusBadge>
          )}
        </span>
      ),
    },
    {
      id: 'plannedEnd',
      header: 'Planned end',
      sortable: true,
      cell: (row) => (
        <span className="font-mono">
          {row.analysis?.plannedEndMs === undefined
            ? 'Not placed'
            : plantTime(view.snapshot, row.analysis.plannedEndMs)}
        </span>
      ),
    },
    {
      id: 'customers',
      header: 'Customers',
      cell: (row) =>
        row.customers.length === 0 ? (
          <span className="text-muted-foreground">Stock order</span>
        ) : (
          row.customers.join(', ')
        ),
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
  { id: 'order', label: 'Order', alwaysShown: true },
  { id: 'article', label: 'Article' },
  { id: 'quantity', label: 'Quantity' },
  { id: 'deadline', label: 'Deadline' },
  { id: 'priority', label: 'Priority' },
  { id: 'status', label: 'Status' },
  { id: 'plannedEnd', label: 'Planned end' },
  { id: 'customers', label: 'Customers' },
] as const;

/** "Sorted by deadline, then priority." for the default sort, else the column and its direction. */
function sortText(sort: { readonly id: OrderSortId; readonly desc: boolean }): string {
  if (sort.id === 'deadline' && !sort.desc) return 'Sorted by deadline, then priority.';
  const header = columnChoices.find((column) => column.id === sort.id)?.label ?? sort.id;
  return `Sorted by ${header.toLowerCase()}, ${sort.desc ? 'descending' : 'ascending'}.`;
}

/**
 * The production orders list (plan 07; design #687, PL1 to PL3): every order of the plant with its
 * article and color, quantity, deadline, priority, status with Late by, planned end and customers,
 * Open on Gantt and the row menu in every row, the search, Late only, the Status, Article and
 * Customer filters with their counts, Group by and Columns above it. Search, Late only, the
 * filters, the grouping and the sort live in the URL (ADR 0062); the columns and the collapsed
 * groups stay local. New order waits for the planning server. The fixture fits one page.
 */
export function ProductionOrdersScreen() {
  const { plant } = useShell();
  const view = orderListSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const show = (next: OrderListSearch) =>
    navigate({ to: '.', search: urlSearchOf(next), replace: true });
  const { snapshot, error, retry } = usePlanningSnapshot();
  const [hiddenColumns, setHiddenColumns] = useState<readonly string[]>([]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const allRows = useMemo(
    () => (snapshot === undefined ? [] : orderListRows(snapshot)),
    [snapshot],
  );
  const sort = sortOf<OrderSortId>(view, 'deadline');
  const rows = useMemo(
    () =>
      sortedOrderRows(
        allRows.filter((row) => orderRowMatches(row, view)),
        sort,
      ),
    [allRows, view, sort],
  );
  const groups = useMemo(
    () =>
      snapshot === undefined || view.group === undefined
        ? undefined
        : groupedOrderRows(rows, view.group, snapshot),
    [snapshot, rows, view.group],
  );
  const customerName = (code: string) =>
    snapshot?.customers?.find((customer) => customer.code === code)?.name ?? code;
  const labelOf = (key: 'status' | 'article' | 'customer') =>
    key === 'status' ? statusLabel : key === 'customer' ? customerName : (value: string) => value;
  const fields: ListFilterField[] = (
    [
      ['status', 'Status', 'Show orders with these statuses', 'Remove the status filter'],
      ['article', 'Article', 'Show orders of these articles', 'Remove the article filter'],
      ['customer', 'Customer', 'Show orders of these customers', 'Remove the customer filter'],
    ] as const
  ).map(([key, label, heading, remove]) => ({
    key,
    label,
    heading,
    remove,
    values: orderFacets(allRows, view, key, labelOf(key)),
    picked: view[key] ?? [],
  }));

  const cellView = snapshot === undefined ? undefined : { snapshot, plant };
  const columns = useMemo(() => (cellView === undefined ? [] : columnsOf(cellView)), [cellView]);
  const lateCount = rows.filter((row) => row.analysis?.late).length;
  const notPlaced = rows.filter((row) => row.analysis?.plannedEndMs === undefined).length;
  const statusLine = `${[
    `${rows.length} production order${rows.length === 1 ? '' : 's'}`,
    lateCount > 0 ? `${lateCount} late` : undefined,
    notPlaced > 0 ? `${notPlaced} not placed` : undefined,
    view.late === 1 ? 'late only' : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(', ')}. ${
    groups === undefined
      ? sortText(sort)
      : `${groups.length} group${groups.length === 1 ? '' : 's'} sorted by ${
          groupChoices.find((choice) => choice.value === view.group)?.label.toLowerCase() ?? ''
        }, orders ${sortText(sort).charAt(0).toLowerCase()}${sortText(sort).slice(1)}`
  }`;
  const announced = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (snapshot === undefined) return;
    if (announced.current !== undefined && announced.current !== statusLine) announce(statusLine);
    announced.current = statusLine;
  }, [snapshot, statusLine]);

  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load production orders', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (rows.length === 0 && allRows.length > 0) {
    state = {
      status: 'empty',
      title: 'No production orders match these filters',
      description: 'Change or clear the filters to see production orders again.',
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
      title: 'No production orders yet',
      description:
        'Production orders come from the ERP or are created here. Create the first one, or wait for the next import.',
    };
  }
  const tableGroups: DataTableGroup<OrderListRow>[] | undefined = groups?.map((group) => ({
    id: group.id,
    label: group.label,
    count: groupCountText(group),
    rows: group.rows,
    expanded: !collapsed.has(group.id),
    onExpandedChange: (expanded) =>
      setCollapsed((current) => {
        const next = new Set(current);
        if (expanded) next.delete(group.id);
        else next.add(group.id);
        return next;
      }),
  }));
  return (
    <PageFrame
      title="Production orders"
      meta={
        snapshot?.erp === undefined ? undefined : (
          <span className="text-sm text-muted-foreground">
            ERP data as of {plantTime(snapshot, snapshot.erp.importedAtMs)}
          </span>
        )
      }
      actions={
        <Button disabled>
          <Plus aria-hidden />
          New order
        </Button>
      }
      toolbar={
        <div className="flex flex-col gap-2">
          <OrderListToolbar
            searchId={searchFieldId}
            searchLabel="Search production orders"
            q={view.q ?? ''}
            onSearch={(q) => show(searchedFor(view, q))}
            lateOnly={view.late === 1}
            onLateOnlyChange={(on) => show(withLateOnly(view, on))}
            fields={fields}
            onFilterChange={(key, values) => show(filteredBy(view, key, values))}
            onClearFilters={() => show(unfiltered(view))}
            groupMenu={
              <ChoiceMenu
                label="Group by"
                choices={groupChoices}
                value={view.group}
                onChange={(group) => show(groupedBy(view, group))}
              />
            }
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
        label="Production orders"
        columns={columns}
        rows={rows}
        groups={tableGroups}
        getRowId={(row) => row.id}
        hiddenColumns={hiddenColumns}
        loading={snapshot === undefined}
        sort={sort}
        onSortChange={(next) =>
          show(sortedBy<OrderListSearch, OrderSortId>(view, next, 'deadline'))
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
