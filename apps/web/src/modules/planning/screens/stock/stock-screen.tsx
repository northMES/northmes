// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDate } from '@northmes/contracts/format';
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Clock, Lock, PackageOpen, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ColumnsMenu } from '../../../../ui/components/columns-menu/index.ts';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { FilterChip } from '../../../../ui/components/filter-chip/index.ts';
import { FilterMenu } from '../../../../ui/components/filter-menu/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { SearchField } from '../../../../ui/components/search-field/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/primitives/alert.tsx';
import { Button } from '../../../../ui/primitives/button.tsx';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import { InventoryForbidden, type InventorySnapshot } from '../../inventory-data.ts';
import { useInventory } from '../../inventory-source-context.ts';
import {
  compareCodes,
  isAtPlant,
  materialShortages,
  plantWarehouses,
  type StockRow,
  stockRows,
} from '../../material-projection.ts';
import {
  amountText,
  incomingText,
  jobOrderHref,
  quantityWithUnit,
  stockTime,
  whenText,
} from '../../stock-facts.ts';
import {
  type ArticleKind,
  type StockSearch,
  type StockSortId,
  stockSearch,
  urlSearchOf,
} from '../../stock-search.ts';

/** The id of the search input, where Clear filters moves focus. */
const searchFieldId = 'stock-search';

const link = 'text-link underline underline-offset-2 hover:no-underline';

const kindLabels: Readonly<Record<ArticleKind, string>> = {
  material: 'Material',
  finished: 'Finished article',
};

/** Why an article falls below zero, with the link to the job orders or the late order (ST1). */
function ShortFor({ row, plant, snapshot }: CellProps) {
  const short = row.short;
  if (short === undefined) return <span className="text-xs text-muted-foreground">None</span>;
  if (short.kind === 'material') {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <StatusBadge tone="warning" icon={TriangleAlert}>
          Material short
        </StatusBadge>
        {short.shortages.map((shortage) => (
          <Link
            key={shortage.movement.id}
            to={jobOrderHref(shortage.movement, plant, snapshot.plant.timeZone)}
            className={`font-mono ${link}`}
          >
            {shortage.jobOrder.displayNumber}
          </Link>
        ))}
      </span>
    );
  }
  if (short.kind === 'belowZero') {
    return <span className="text-xs text-muted-foreground">No order or job order named</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <StatusBadge tone="destructive" icon={Clock}>
        Late order
      </StatusBadge>
      <span>
        <Link
          to={planningLinks.orders.order({ plant, orderId: short.order.id }).href}
          className={`font-mono ${link}`}
        >
          {short.order.number}
        </Link>
        {short.movement.customerOrderLine !== undefined &&
          ` for customer order ${short.movement.customerOrderLine.customerOrder}`}
      </span>
    </span>
  );
}

/** The next incoming movement, None planned for a short article, None needed otherwise. */
function nextIncomingText(row: StockRow, timeZone: string): string | undefined {
  if (row.nextIncoming !== undefined) {
    return incomingText(row.nextIncoming, row.article.unit, timeZone);
  }
  return undefined;
}

interface CellProps {
  readonly row: StockRow;
  readonly plant: string;
  readonly snapshot: InventorySnapshot;
}

function columnsOf(snapshot: InventorySnapshot, plant: string): DataTableColumn<StockRow>[] {
  const timeZone = snapshot.plant.timeZone;
  return [
    {
      id: 'article',
      header: 'Article',
      sortable: true,
      cell: (row) => (
        <span className="flex flex-col">
          <Link
            to={planningLinks.stock.article({ plant, articleId: row.article.number }).href}
            className={`font-mono ${link}`}
          >
            {row.article.number}
          </Link>
          <span className="text-xs text-muted-foreground">{row.article.name}</span>
        </span>
      ),
    },
    { id: 'unit', header: 'Unit', cell: (row) => row.article.unit },
    {
      id: 'inStock',
      header: 'In stock',
      numeric: true,
      cell: (row) => <span className="font-mono">{amountText(row.inStock)}</span>,
    },
    {
      id: 'lowest',
      header: 'Lowest projected',
      sortable: true,
      numeric: true,
      cell: (row) =>
        row.lowest.balance < 0 ? (
          <span className="flex flex-wrap items-center justify-end gap-1.5">
            <span className="font-mono font-semibold text-destructive">
              {amountText(row.lowest.balance)}
            </span>
            <StatusBadge tone="destructive">Below zero</StatusBadge>
          </span>
        ) : (
          <span className="font-mono">{amountText(row.lowest.balance)}</span>
        ),
    },
    {
      id: 'at',
      header: 'At',
      cell: (row) => (
        <span className="font-mono">
          {whenText(row.lowest.atMs, row.lowest.dateOnly, timeZone)}
        </span>
      ),
    },
    {
      id: 'shortFor',
      header: 'Short for',
      cell: (row) => <ShortFor row={row} plant={plant} snapshot={snapshot} />,
    },
    {
      id: 'nextIncoming',
      header: 'Next incoming',
      cell: (row) => {
        const text = nextIncomingText(row, timeZone);
        return text === undefined ? (
          <span className="text-xs text-muted-foreground">
            {row.short === undefined ? 'None needed' : 'None planned'}
          </span>
        ) : (
          <span className="font-mono">{text}</span>
        );
      },
    },
  ];
}

const columnChoices = [
  { id: 'article', label: 'Article', alwaysShown: true },
  { id: 'unit', label: 'Unit' },
  { id: 'inStock', label: 'In stock' },
  { id: 'lowest', label: 'Lowest projected' },
  { id: 'at', label: 'At' },
  { id: 'shortFor', label: 'Short for' },
  { id: 'nextIncoming', label: 'Next incoming' },
] as const;

/** The rows sorted on a column; without one, the projection's own order: materials first, by lowest. */
function sorted(
  rows: readonly StockRow[],
  sort: { readonly id: StockSortId; readonly desc: boolean } | undefined,
): StockRow[] {
  if (sort === undefined) return [...rows];
  const direction = sort.desc ? -1 : 1;
  return [...rows].sort((a, b) =>
    sort.id === 'article'
      ? compareCodes(a.article.number, b.article.number) * direction
      : (a.lowest.balance - b.lowest.balance) * direction ||
        compareCodes(a.article.number, b.article.number),
  );
}

/** Each job order short of material, one sentence each, in the note above the table (ST1). */
function ShortNote({ snapshot }: { readonly snapshot: InventorySnapshot }) {
  const { plant } = useShell();
  const shortages = materialShortages(snapshot);
  if (shortages.length === 0) return null;
  const materials = new Set(shortages.map((each) => each.material.number)).size;
  const timeZone = snapshot.plant.timeZone;
  return (
    <Alert role="note" className="border-warning bg-warning-subtle text-foreground">
      <TriangleAlert aria-hidden className="text-warning" />
      <AlertTitle>
        {materials === 1
          ? '1 article is short for a job order.'
          : `${materials} articles are short for a job order.`}
      </AlertTitle>
      <AlertDescription className="text-foreground">
        {shortages.map((shortage) => (
          <span key={shortage.movement.id}>
            {`${shortage.material.name} is ${quantityWithUnit(shortage.shortfall, shortage.material.unit)} short when ${shortage.jobOrder.displayNumber} ${shortage.jobOrder.article} starts${
              shortage.jobOrder.machine === undefined ? '' : ` on ${shortage.jobOrder.machine}`
            }, ${whenText(shortage.movement.atMs, shortage.movement.dateOnly, timeZone)}. `}
            <Link
              to={planningLinks.stock.article({ plant, articleId: shortage.material.number }).href}
              className={link}
            >
              Show the stock of {shortage.material.name}
            </Link>
          </span>
        ))}
      </AlertDescription>
    </Alert>
  );
}

/** One article as a card at narrow widths (ST3): its key values in a list, nothing scrolls. */
function StockCard({ row, plant, snapshot }: CellProps) {
  const timeZone = snapshot.plant.timeZone;
  return (
    <li className="grid gap-1 rounded-lg border border-border bg-card px-3 py-2.5">
      <span className="flex items-center gap-2">
        <Link
          to={planningLinks.stock.article({ plant, articleId: row.article.number }).href}
          className={`font-mono font-medium ${link}`}
        >
          {row.article.number}
        </Link>
        {row.short !== undefined && (
          <span className="ms-auto">
            <ShortFor row={row} plant={plant} snapshot={snapshot} />
          </span>
        )}
      </span>
      <span>{row.article.name}</span>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.8125rem]">
        <dt className="text-muted-foreground">In stock</dt>
        <dd className="text-end font-mono text-xs">
          {quantityWithUnit(row.inStock, row.article.unit)}
        </dd>
        <dt className="text-muted-foreground">Lowest projected</dt>
        <dd className="text-end font-mono text-xs">
          {quantityWithUnit(row.lowest.balance, row.article.unit)}
          {row.lowest.balance < 0 && ', below zero'}
        </dd>
        <dt className="text-muted-foreground">At</dt>
        <dd className="text-end font-mono text-xs">
          {whenText(row.lowest.atMs, row.lowest.dateOnly, timeZone)}
        </dd>
        <dt className="text-muted-foreground">Next incoming</dt>
        <dd className="text-end font-mono text-xs">
          {nextIncomingText(row, timeZone) ??
            (row.short === undefined ? 'None needed' : 'None planned')}
        </dd>
      </dl>
    </li>
  );
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The Stock page of a plant under Planning (plan 07, Material warnings; design #729, ST1 to ST7):
 * one row per article with stock in the warehouses mapped to the plant, its unit, what is in
 * stock, the lowest projected balance and when, why it falls below zero (a job order short of
 * material, or a late order before its customer demand), and the next incoming movement. A note
 * above the table names each article short for a job order. Search, Warehouse, Kind of article,
 * Below zero only and the sort live in the URL (ADR 0062). Read-only: stock and planned movements
 * come from the ERP. At narrow widths the rows become cards (ST3). The preview key opens the
 * loading, empty, failed and no-access states on the fixture.
 */
export function StockScreen() {
  const { plant } = useShell();
  const view = stockSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const show = (next: StockSearch) =>
    navigate({ to: '.', search: urlSearchOf(next), replace: true });
  const { snapshot, error, retry } = useInventory(view.preview);
  const [hiddenColumns, setHiddenColumns] = useState<readonly string[]>([]);
  const belowId = `${searchFieldId}-below`;

  const warehouses = useMemo(
    () => (snapshot === undefined ? [] : plantWarehouses(snapshot)),
    [snapshot],
  );
  // The picked warehouses that map to the plant, as a key, so the rows recompute only when it changes.
  const countedKey = (view.warehouse ?? [])
    .filter((code) => warehouses.some((each) => each.code === code))
    .join(',');
  const counted = useMemo(
    () => (countedKey === '' ? undefined : countedKey.split(',')),
    [countedKey],
  );
  const plantRows = useMemo(() => (snapshot === undefined ? [] : stockRows(snapshot)), [snapshot]);
  const allRows = useMemo(
    () =>
      snapshot === undefined
        ? []
        : counted === undefined
          ? plantRows
          : stockRows(snapshot, counted),
    [snapshot, counted, plantRows],
  );
  const sort =
    view.sort === undefined
      ? undefined
      : { id: view.sort.replace(/^-/, '') as StockSortId, desc: view.sort.startsWith('-') };
  const rows = sorted(
    allRows.filter((row) => {
      if (view.below === 1 && row.lowest.balance >= 0) return false;
      if (view.kind !== undefined && !view.kind.includes(row.article.kind)) return false;
      if (view.q === undefined) return true;
      const needle = view.q.toLowerCase();
      return [row.article.number, row.article.name].some((t) => t.toLowerCase().includes(needle));
    }),
    sort,
  );
  const columns = useMemo(
    () => (snapshot === undefined ? [] : columnsOf(snapshot, plant)),
    [snapshot, plant],
  );
  const withList = (key: 'warehouse' | 'kind', values: readonly string[]) => {
    const { [key]: _, ...rest } = view;
    show(values.length === 0 ? rest : ({ ...rest, [key]: values } as StockSearch));
  };
  const clearFilters = () => {
    const { q: _q, warehouse: _w, kind: _k, below: _b, ...rest } = view;
    show(rest);
    document.getElementById(searchFieldId)?.focus();
  };

  const plantName = snapshot?.plant.name ?? 'the plant';
  const belowZero = rows.filter((row) => row.lowest.balance < 0).length;
  const sortText =
    sort === undefined
      ? 'Sorted by kind of article, then lowest projected balance.'
      : `Sorted by ${sort.id === 'article' ? 'article' : 'lowest projected balance'}, ${sort.desc ? 'descending' : 'ascending'}.`;
  const filters = [
    view.q === undefined ? undefined : `matching "${view.q}"`,
    view.kind === undefined
      ? undefined
      : view.kind.map((kind) => kindLabels[kind].toLowerCase()).join(' and '),
    view.below === 1 ? 'below zero only' : undefined,
  ].filter((part) => part !== undefined);
  const statusLine = `${plural(rows.length, 'article', 'articles')} with stock or planned movements, ${belowZero} below zero in the projection${
    filters.length === 0 ? '' : `, ${filters.join(', ')}`
  }. ${sortText} Lowest projected sums ${
    counted === undefined ? `every warehouse mapped to ${plantName}` : counted.join(', ')
  }; purchase requisitions are ${snapshot?.countPurchaseRequisitions ? '' : 'not '}counted (${plantName} setting).`;
  const announced = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (snapshot === undefined) return;
    if (announced.current !== undefined && announced.current !== statusLine) announce(statusLine);
    announced.current = statusLine;
  }, [snapshot, statusLine]);

  const forbidden = snapshot === undefined && error instanceof InventoryForbidden;
  let state: PageState = { status: 'ready' };
  if (forbidden) {
    state = {
      status: 'empty',
      icon: Lock,
      title: 'You need the permission to read stock at this plant',
      description: 'Ask your plant admin for a role that can read stock.',
    };
  } else if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load the stock', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (plantRows.length === 0) {
    state = {
      status: 'empty',
      icon: PackageOpen,
      title: 'No stock from the ERP yet',
      description: `Stock balances and planned movements come from the ERP connection. The first stock import of ${plantName} has not run, or no warehouse is mapped to ${plantName}. Until then no job order shows a material warning.`,
    };
  } else if (rows.length === 0) {
    state = {
      status: 'empty',
      title: 'No articles match these filters',
      description: 'Change or clear the filters to see the stock again.',
      action: (
        <Button variant="link" onClick={clearFilters}>
          Clear filters
        </Button>
      ),
    };
  }
  const filtered = counted !== undefined || view.kind !== undefined;
  const kindOptions = (['material', 'finished'] as const).map((kind) => ({
    value: kind,
    label: kindLabels[kind],
    count: allRows.filter((row) => row.article.kind === kind).length,
  }));
  const warehouseOptions = useMemo(
    () =>
      warehouses.map((warehouse) => ({
        value: warehouse.code,
        label: `${warehouse.code} ${warehouse.name}`,
        count:
          snapshot === undefined
            ? 0
            : snapshot.articles.filter((article) =>
                isAtPlant(snapshot, article.number, [warehouse.code]),
              ).length,
      })),
    [snapshot, warehouses],
  );
  return (
    <PageFrame
      title="Stock"
      meta={
        snapshot === undefined ? undefined : (
          <span className="text-sm text-muted-foreground">
            {`${plantName}. ERP data as of ${stockTime(snapshot, snapshot.stockAsOfMs)}. Read-only: stock and planned movements come from the ERP.`}
          </span>
        )
      }
      toolbar={
        forbidden ? undefined : (
          <div className="flex flex-col gap-3">
            {snapshot !== undefined && <ShortNote snapshot={snapshot} />}
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SearchField
                  id={searchFieldId}
                  label="Search articles"
                  value={view.q ?? ''}
                  onSearch={(q) => {
                    const { q: _, ...rest } = view;
                    show(q.trim() === '' ? rest : { ...rest, q: q.trim() });
                  }}
                  className="w-full max-w-sm"
                />
                <FilterMenu
                  label="Warehouse"
                  heading={`Sum these warehouses of ${plantName}`}
                  options={warehouseOptions}
                  selected={counted ?? []}
                  onChange={(values) => withList('warehouse', values)}
                />
                <FilterMenu
                  label="Kind of article"
                  heading="Show these kinds of article"
                  options={kindOptions}
                  selected={view.kind ?? []}
                  onChange={(values) => withList('kind', values)}
                />
                <Field orientation="horizontal" className="w-auto">
                  <Checkbox
                    id={belowId}
                    checked={view.below === 1}
                    onCheckedChange={(checked) => {
                      const { below: _, ...rest } = view;
                      show(checked ? { ...rest, below: 1 } : rest);
                    }}
                  />
                  <FieldLabel htmlFor={belowId}>Below zero only</FieldLabel>
                </Field>
                {snapshot !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    Projected to{' '}
                    {formatPlantDate(snapshot.projectedToMs - 1, snapshot.plant.timeZone)}
                  </span>
                )}
              </div>
              <ColumnsMenu
                columns={columnChoices}
                hidden={hiddenColumns}
                onChange={setHiddenColumns}
              />
            </div>
            {filtered && (
              <div className="flex flex-wrap items-center gap-2">
                {counted !== undefined && (
                  <FilterChip
                    label="Warehouse"
                    values={counted.map((code) => ({
                      label: code,
                      count: warehouseOptions.find((each) => each.value === code)?.count ?? 0,
                    }))}
                    removeLabel="Remove the warehouse filter"
                    onRemove={() => withList('warehouse', [])}
                  />
                )}
                {view.kind !== undefined && (
                  <FilterChip
                    label="Kind of article"
                    values={view.kind.map((kind) => ({
                      label: kindLabels[kind],
                      count: kindOptions.find((each) => each.value === kind)?.count ?? 0,
                    }))}
                    removeLabel="Remove the kind filter"
                    onRemove={() => withList('kind', [])}
                  />
                )}
                <Button variant="link" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <p data-list-status>{snapshot === undefined ? 'Loading the stock.' : statusLine}</p>
              {snapshot?.fixture !== undefined && <p>Showing fixture {snapshot.fixture}.</p>}
            </div>
          </div>
        )
      }
      state={state}
    >
      {snapshot !== undefined && rows.length > 0 && (
        <ul aria-label={`Stock of ${plantName} by article`} className="grid gap-2 sm:hidden">
          {rows.map((row) => (
            <StockCard key={row.article.number} row={row} plant={plant} snapshot={snapshot} />
          ))}
        </ul>
      )}
      <div className={snapshot === undefined ? undefined : 'hidden sm:block'}>
        <DataTable
          label={`Stock of ${plantName} by article`}
          columns={columns}
          rows={rows}
          getRowId={(row) => row.article.number}
          hiddenColumns={hiddenColumns}
          loading={snapshot === undefined}
          {...(sort !== undefined && { sort })}
          onSortChange={(next) => {
            const { sort: _, ...rest } = view;
            show({
              ...rest,
              sort: next.desc ? `-${next.id as StockSortId}` : (next.id as StockSortId),
            });
          }}
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
      </div>
    </PageFrame>
  );
}
