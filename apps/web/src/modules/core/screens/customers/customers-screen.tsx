// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDateTime, formatPlantDay, pinnedLocale } from '@northmes/contracts/format';
import { coreLinks } from '@northmes/core-contracts';
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Clock, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ColumnsMenu } from '../../../../ui/components/columns-menu/index.ts';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { FilterChip } from '../../../../ui/components/filter-chip/index.ts';
import { FilterMenu } from '../../../../ui/components/filter-menu/index.ts';
import { OwnerTag } from '../../../../ui/components/owner-tag/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { SearchField } from '../../../../ui/components/search-field/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import { type CustomerSummary, customerSummaries, ordersText } from '../../customer-facts.ts';
import {
  type CustomerListSearch,
  type CustomerSortId,
  customerListSearch,
  sortedBy,
  sortOf,
  urlSearchOf,
} from '../../customer-list-search.ts';
import type { CustomerOwner } from '../../customers-data.ts';
import { useCustomers } from '../../customers-source-context.ts';

/** The id of the search input, where Clear filters moves focus. */
const searchFieldId = 'customers-search';

/** The owner of a customer as the Source filter names it. */
const sourceLabels: Readonly<Record<CustomerOwner, string>> = {
  erp: 'From the ERP',
  northmes: 'NorthMES',
};

const link = 'text-link underline underline-offset-2 hover:no-underline';

function columnsOf(plant: string): readonly DataTableColumn<CustomerSummary>[] {
  const pageOf = (row: CustomerSummary) =>
    coreLinks.customers.customer({ plant, customerId: row.customer.code }).href;
  return [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      cell: (row) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <Link to={pageOf(row)} className={link} data-customer={row.customer.code}>
            {row.customer.name}
          </Link>
          {row.customer.owner === 'erp' && <OwnerTag>From the ERP</OwnerTag>}
        </span>
      ),
    },
    {
      id: 'code',
      header: 'Customer number',
      sortable: true,
      cell: (row) => (
        <Link to={pageOf(row)} className={`font-mono ${link}`}>
          {row.customer.code}
        </Link>
      ),
    },
    {
      id: 'lines',
      header: 'Open lines',
      sortable: true,
      numeric: true,
      cell: (row) => <span className="font-mono">{row.lines}</span>,
    },
    {
      id: 'orders',
      header: 'Supplied by',
      sortable: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span>{ordersText(row.orders.length)}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.orders.join(', ')}</span>
        </span>
      ),
    },
    {
      id: 'late',
      header: 'Late',
      sortable: true,
      cell: (row) =>
        row.late === 0 ? (
          <span className="text-xs text-muted-foreground">None</span>
        ) : (
          <StatusBadge tone="destructive" icon={Clock}>
            {row.late} late
          </StatusBadge>
        ),
    },
    {
      id: 'notSupplied',
      header: 'Not supplied',
      sortable: true,
      cell: (row) =>
        row.notSupplied === 0 ? (
          <span className="text-xs text-muted-foreground">None</span>
        ) : (
          <StatusBadge tone="neutral">{row.notSupplied} not supplied</StatusBadge>
        ),
    },
    {
      id: 'nextWanted',
      header: 'Next wanted',
      sortable: true,
      cell: (row) => (
        <span className="font-mono">
          {row.nextWanted === undefined ? '' : formatPlantDay(row.nextWanted)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      headerHidden: true,
      cell: (row) => (
        <span className="flex justify-end">
          <Link
            to={planningLinks.customerOrders({ plant }, { customer: row.customer.code }).href}
            aria-label={`Customer orders of ${row.customer.name}`}
            className={`${buttonVariants({ variant: 'outline' })} h-8 px-2.5`}
          >
            Customer orders
          </Link>
        </span>
      ),
    },
  ];
}

const columnChoices = [
  { id: 'name', label: 'Name', alwaysShown: true },
  { id: 'code', label: 'Customer number' },
  { id: 'lines', label: 'Open lines' },
  { id: 'orders', label: 'Supplied by' },
  { id: 'late', label: 'Late' },
  { id: 'notSupplied', label: 'Not supplied' },
  { id: 'nextWanted', label: 'Next wanted' },
] as const;

/** The sort key of a row under a column; none for a customer without lines under Next wanted. */
function sortKey(row: CustomerSummary, id: CustomerSortId): number | string | undefined {
  switch (id) {
    case 'name':
      return row.customer.name;
    case 'code':
      return row.customer.code;
    case 'lines':
      return row.lines;
    case 'orders':
      return row.orders.length;
    case 'late':
      return row.late;
    case 'notSupplied':
      return row.notSupplied;
    case 'nextWanted':
      return row.nextWanted;
  }
}

/** Names and codes compare in the pinned locale (ADR 0061), so "de Wit" sorts among the D. */
const collator = new Intl.Collator(pinnedLocale, { sensitivity: 'base' });

/** The rows sorted on a column, a missing value last in either direction, the name breaking ties. */
function sorted(
  rows: readonly CustomerSummary[],
  sort: { readonly id: CustomerSortId; readonly desc: boolean },
): CustomerSummary[] {
  const direction = sort.desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = sortKey(a, sort.id);
    const right = sortKey(b, sort.id);
    if (left === undefined || right === undefined) {
      if (left !== right) return left === undefined ? 1 : -1;
    } else if (left !== right) {
      const order =
        typeof left === 'string' && typeof right === 'string'
          ? collator.compare(left, right)
          : left < right
            ? -1
            : 1;
      if (order !== 0) return order * direction;
    }
    return collator.compare(a.customer.name, b.customer.name);
  });
}

/** Whether a row passes the view's search, Source filter and the two flags, the Source aside. */
function matches(row: CustomerSummary, view: CustomerListSearch, except?: 'source'): boolean {
  if (view.late === 1 && row.late === 0) return false;
  if (view.unsupplied === 1 && row.notSupplied === 0) return false;
  if (view.q !== undefined) {
    const needle = view.q.toLowerCase();
    if (![row.customer.name, row.customer.code].some((t) => t.toLowerCase().includes(needle))) {
      return false;
    }
  }
  return (
    except === 'source' || view.source === undefined || view.source.includes(row.customer.owner)
  );
}

function sortText(sort: { readonly id: CustomerSortId; readonly desc: boolean }): string {
  if (sort.id === 'name' && !sort.desc) return 'Sorted by name.';
  const header = columnChoices.find((column) => column.id === sort.id)?.label ?? sort.id;
  return `Sorted by ${header.toLowerCase()}, ${sort.desc ? 'descending' : 'ascending'}.`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The customers register under Master data (design #728, CU1 to CU5): a core code register like
 * the articles, read-only for the planner, because the ERP sends each customer's number and name
 * (ADR 0032). One row per customer with the From the ERP tag, its number, its open customer order
 * lines, the production orders that supply them, its late and unsupplied lines and its next wanted
 * date, and a link to its lines on the customer orders list. Search, Source, With late lines, With
 * lines not supplied and the sort live in the URL (ADR 0062); the columns stay local. The preview
 * key opens the loading, empty and failed states on the fixture.
 */
export function CustomersScreen() {
  const { plant } = useShell();
  const view = customerListSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const show = (next: CustomerListSearch) =>
    navigate({ to: '.', search: urlSearchOf(next), replace: true });
  const { snapshot, error, retry } = useCustomers(view.preview);
  const [hiddenColumns, setHiddenColumns] = useState<readonly string[]>([]);
  const lateId = `${searchFieldId}-late`;
  const unsuppliedId = `${searchFieldId}-unsupplied`;

  const allRows = useMemo(
    () => (snapshot === undefined ? [] : customerSummaries(snapshot)),
    [snapshot],
  );
  const sort = sortOf(view);
  const rows = sorted(
    allRows.filter((row) => matches(row, view)),
    sort,
  );
  const columns = useMemo(() => columnsOf(plant), [plant]);
  const sources = (() => {
    // A picked value stays in the menu and names its chip even when no row passes with it.
    const counts = new Map<string, number>((view.source ?? []).map((value) => [value, 0]));
    for (const row of allRows) {
      if (!matches(row, view, 'source')) continue;
      counts.set(row.customer.owner, (counts.get(row.customer.owner) ?? 0) + 1);
    }
    return [...counts.entries()].map(([value, count]) => ({
      value,
      label: sourceLabels[value as CustomerOwner],
      count,
    }));
  })();
  const withSource = (values: readonly string[]) => {
    const { source: _, ...rest } = view;
    show(values.length === 0 ? rest : { ...rest, source: values as CustomerOwner[] });
  };
  const withFlag = (key: 'late' | 'unsupplied', on: boolean) => {
    const { [key]: _, ...rest } = view;
    show(on ? { ...rest, [key]: 1 } : rest);
  };
  const clearFilters = () => {
    const { q: _q, source: _s, late: _l, unsupplied: _u, ...rest } = view;
    show(rest);
    document.getElementById(searchFieldId)?.focus();
  };

  const lines = rows.reduce((sum, row) => sum + row.lines, 0);
  const late = rows.reduce((sum, row) => sum + row.late, 0);
  const notSupplied = rows.reduce((sum, row) => sum + row.notSupplied, 0);
  const statusLine = `${[
    plural(rows.length, 'customer', 'customers'),
    plural(lines, 'open customer order line', 'open customer order lines'),
    `${late} late`,
    `${notSupplied} not supplied`,
    view.late === 1 ? 'with late lines' : undefined,
    view.unsupplied === 1 ? 'with lines not supplied' : undefined,
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
    state = { status: 'error', title: 'Could not load customers', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (allRows.length === 0) {
    state = {
      status: 'empty',
      icon: Users,
      title: 'No customers yet',
      description:
        'Customers come from the ERP with their number and name. They appear here after the next import.',
    };
  } else if (rows.length === 0) {
    state = {
      status: 'empty',
      title: 'No customers match these filters',
      description: 'Change or clear the filters to see customers again.',
      action: (
        <Button variant="link" onClick={clearFilters}>
          Clear filters
        </Button>
      ),
    };
  }
  const empty = snapshot !== undefined && allRows.length === 0;
  return (
    <PageFrame
      title="Customers"
      meta={
        snapshot === undefined ? undefined : (
          <span className="text-sm text-muted-foreground">
            {snapshot.erp === undefined
              ? 'No import yet'
              : `ERP data as of ${formatPlantDateTime(snapshot.erp.importedAtMs, snapshot.plant.timeZone)}`}
          </span>
        )
      }
      toolbar={
        empty ? undefined : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SearchField
                  id={searchFieldId}
                  label="Search customers"
                  value={view.q ?? ''}
                  onSearch={(q) => {
                    const { q: _, ...rest } = view;
                    show(q.trim() === '' ? rest : { ...rest, q: q.trim() });
                  }}
                  className="w-full max-w-sm"
                />
                <FilterMenu
                  label="Source"
                  heading="Show customers from these sources"
                  options={sources}
                  selected={view.source ?? []}
                  onChange={withSource}
                />
                <Field orientation="horizontal" className="w-auto">
                  <Checkbox
                    id={lateId}
                    checked={view.late === 1}
                    onCheckedChange={(checked) => withFlag('late', checked)}
                  />
                  <FieldLabel htmlFor={lateId}>With late lines</FieldLabel>
                </Field>
                <Field orientation="horizontal" className="w-auto">
                  <Checkbox
                    id={unsuppliedId}
                    checked={view.unsupplied === 1}
                    onCheckedChange={(checked) => withFlag('unsupplied', checked)}
                  />
                  <FieldLabel htmlFor={unsuppliedId}>With lines not supplied</FieldLabel>
                </Field>
              </div>
              <ColumnsMenu
                columns={columnChoices}
                hidden={hiddenColumns}
                onChange={setHiddenColumns}
              />
            </div>
            {view.source !== undefined && (
              <div className="flex flex-wrap items-center gap-2">
                <FilterChip
                  label="Source"
                  values={view.source.map((value) => ({
                    label: sourceLabels[value],
                    count: sources.find((each) => each.value === value)?.count ?? 0,
                  }))}
                  removeLabel="Remove the source filter"
                  onRemove={() => withSource([])}
                />
                <Button variant="link" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <p data-list-status>{snapshot === undefined ? 'Loading customers.' : statusLine}</p>
              {snapshot?.fixture !== undefined && <p>Showing fixture {snapshot.fixture}.</p>}
            </div>
          </div>
        )
      }
      state={state}
    >
      <DataTable
        label="Customers"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.customer.code}
        hiddenColumns={hiddenColumns}
        loading={snapshot === undefined}
        sort={sort}
        onSortChange={(next) => show(sortedBy(view, next))}
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
