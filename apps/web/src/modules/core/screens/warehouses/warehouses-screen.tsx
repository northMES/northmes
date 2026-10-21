// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDateTime } from '@northmes/contracts/format';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Info, Lock, Plus, Warehouse as WarehouseIcon } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ColumnsMenu } from '../../../../ui/components/columns-menu/index.ts';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { FilterChip } from '../../../../ui/components/filter-chip/index.ts';
import { FilterMenu } from '../../../../ui/components/filter-menu/index.ts';
import { OwnerTag } from '../../../../ui/components/owner-tag/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { SearchField } from '../../../../ui/components/search-field/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/primitives/alert.tsx';
import { Button } from '../../../../ui/primitives/button.tsx';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import {
  urlSearchOf,
  type WarehouseListSearch,
  warehouseListSearch,
} from '../../warehouse-list-search.ts';
import {
  type Warehouse,
  WarehousesForbidden,
  type WarehousesSnapshot,
} from '../../warehouses-data.ts';
import { useWarehouses } from '../../warehouses-source-context.ts';

/** The id of the search input, where Clear filters moves focus. */
const searchFieldId = 'warehouses-search';

/** Why New warehouse, Edit and Map to plant are drawn but disabled on the fixture. */
const warehouseActionReason =
  'Changes to warehouses wait for the warehouse API; this page reads the fixture G1.';

function columnsOf(snapshot: WarehousesSnapshot): DataTableColumn<Warehouse>[] {
  return [
    {
      id: 'code',
      header: 'Code',
      cell: (row) => <span className="font-mono font-medium">{row.code}</span>,
    },
    { id: 'name', header: 'Name', cell: (row) => row.name },
    {
      id: 'externalCode',
      header: 'External code',
      cell: (row) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="font-mono">{row.externalCode}</span>
          <OwnerTag>From the ERP</OwnerTag>
        </span>
      ),
    },
    {
      id: 'plant',
      header: 'Plant',
      cell: (row) =>
        row.plant === null ? (
          <span className="flex flex-col gap-0.5">
            <StatusBadge tone="warning">Not mapped</StatusBadge>
            <span className="text-xs text-muted-foreground">
              Orders go to the default plant, {snapshot.defaultPlant.name}. Stock is not counted.
            </span>
          </span>
        ) : (
          row.plant.name
        ),
    },
    {
      id: 'stockRows',
      header: 'Stock rows',
      numeric: true,
      cell: (row) => <span className="font-mono">{row.stockRows}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      headerHidden: true,
      cell: (row) => (
        <span className="flex justify-end">
          <Button
            variant="outline"
            className="h-8 px-2.5"
            disabled
            aria-label={row.plant === null ? `Map ${row.code} to a plant` : `Edit ${row.code}`}
          >
            {row.plant === null ? 'Map to plant' : 'Edit'}
          </Button>
        </span>
      ),
    },
  ];
}

const columnChoices = [
  { id: 'code', label: 'Code', alwaysShown: true },
  { id: 'name', label: 'Name' },
  { id: 'externalCode', label: 'External code' },
  { id: 'plant', label: 'Plant' },
  { id: 'stockRows', label: 'Stock rows' },
] as const;

/** Whether a row passes the view's search, Not mapped only and Plant filter, the Plant aside. */
function matches(row: Warehouse, view: WarehouseListSearch, except?: 'plant'): boolean {
  if (view.unmapped === 1 && row.plant !== null) return false;
  if (view.q !== undefined) {
    const needle = view.q.toLowerCase();
    if (![row.code, row.name, row.externalCode].some((t) => t.toLowerCase().includes(needle))) {
      return false;
    }
  }
  if (except === 'plant' || view.plant === undefined) return true;
  return row.plant !== null && view.plant.includes(row.plant.slug);
}

/**
 * The company's warehouses in company settings (ADR 0032; design #729, WH1 to WH6): one row per
 * warehouse with its code, name, the external code from the ERP, the plant it maps to or Not
 * mapped with what that means, and its stock rows. A warehouse maps to one plant: its stock counts
 * for that plant's material warnings only. Search, Plant and Not mapped only live in the URL (ADR
 * 0062). New warehouse, Edit and Map to plant wait for the warehouse API. The preview key opens
 * the loading, empty, failed and no-access states on the fixture.
 */
export function WarehousesScreen() {
  const view = warehouseListSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const show = (next: WarehouseListSearch) =>
    navigate({ to: '.', search: urlSearchOf(next), replace: true });
  const { snapshot, error, retry } = useWarehouses(view.preview);
  const [hiddenColumns, setHiddenColumns] = useState<readonly string[]>([]);
  const unmappedId = useId();

  const allRows = useMemo(
    () =>
      snapshot === undefined
        ? []
        : [...snapshot.warehouses].sort((a, b) => a.code.localeCompare(b.code)),
    [snapshot],
  );
  const rows = allRows.filter((row) => matches(row, view));
  const columns = useMemo(() => (snapshot === undefined ? [] : columnsOf(snapshot)), [snapshot]);
  const plantOptions = (snapshot?.plants ?? []).map((plant) => ({
    value: plant.slug,
    label: plant.name,
    count: allRows.filter((row) => matches(row, view, 'plant') && row.plant?.slug === plant.slug)
      .length,
  }));
  const withPlant = (values: readonly string[]) => {
    const { plant: _, ...rest } = view;
    show(values.length === 0 ? rest : { ...rest, plant: values });
  };
  const clearFilters = () => {
    const { q: _q, plant: _p, unmapped: _u, ...rest } = view;
    show(rest);
    document.getElementById(searchFieldId)?.focus();
  };

  const unmapped = rows.filter((row) => row.plant === null).length;
  const statusLine = `${rows.length} warehouse${rows.length === 1 ? '' : 's'}, ${rows.length - unmapped} mapped to a plant, ${unmapped} not mapped. Sorted by code.`;
  const announced = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (snapshot === undefined) return;
    if (announced.current !== undefined && announced.current !== statusLine) announce(statusLine);
    announced.current = statusLine;
  }, [snapshot, statusLine]);

  const forbidden = snapshot === undefined && error instanceof WarehousesForbidden;
  let state: PageState = { status: 'ready' };
  if (forbidden) {
    state = {
      status: 'empty',
      icon: Lock,
      title: "You need the permission to manage this company's warehouses",
      description:
        'Warehouses map to plants, so they are company settings. Ask your company admin for a role that manages them. The Stock page of a plant shows its stock.',
    };
  } else if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load warehouses', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (allRows.length === 0) {
    state = {
      status: 'empty',
      icon: WarehouseIcon,
      title: 'No warehouses yet',
      description:
        'Warehouses come from the ERP with the first stock import, or are created here for orders that NorthMES releases.',
    };
  } else if (rows.length === 0) {
    state = {
      status: 'empty',
      title: 'No warehouses match these filters',
      description: 'Change or clear the filters to see warehouses again.',
      action: (
        <Button variant="link" onClick={clearFilters}>
          Clear filters
        </Button>
      ),
    };
  }
  return (
    <PageFrame
      title="Warehouses"
      meta={
        snapshot?.importedAtMs === undefined ? undefined : (
          <span className="text-sm text-muted-foreground">
            ERP data as of {formatPlantDateTime(snapshot.importedAtMs, snapshot.timeZone)}
          </span>
        )
      }
      actions={
        forbidden ? undefined : (
          <Button disabled>
            <Plus aria-hidden />
            New warehouse
          </Button>
        )
      }
      toolbar={
        forbidden ? undefined : (
          <div className="flex flex-col gap-3">
            <Alert role="note" className="border-info bg-info-subtle text-foreground">
              <Info aria-hidden className="text-info" />
              <AlertTitle>Warehouses come from the ERP with the stock import.</AlertTitle>
              <AlertDescription className="text-foreground">
                Map each warehouse to the plant whose orders and stock it holds. Stock counts for
                the material warnings of that plant only. Code, name and external code stay as the
                ERP sends them.
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SearchField
                  id={searchFieldId}
                  label="Search warehouses"
                  value={view.q ?? ''}
                  onSearch={(q) => {
                    const { q: _, ...rest } = view;
                    show(q.trim() === '' ? rest : { ...rest, q: q.trim() });
                  }}
                  className="w-full max-w-sm"
                />
                <FilterMenu
                  label="Plant"
                  heading="Show warehouses mapped to these plants"
                  options={plantOptions}
                  selected={view.plant ?? []}
                  onChange={withPlant}
                />
                <Field orientation="horizontal" className="w-auto">
                  <Checkbox
                    id={unmappedId}
                    checked={view.unmapped === 1}
                    onCheckedChange={(checked) => {
                      const { unmapped: _, ...rest } = view;
                      show(checked ? { ...rest, unmapped: 1 } : rest);
                    }}
                  />
                  <FieldLabel htmlFor={unmappedId}>Not mapped only</FieldLabel>
                </Field>
              </div>
              <ColumnsMenu
                columns={columnChoices}
                hidden={hiddenColumns}
                onChange={setHiddenColumns}
              />
            </div>
            {view.plant !== undefined && (
              <div className="flex flex-wrap items-center gap-2">
                <FilterChip
                  label="Plant"
                  values={view.plant.map((slug) => {
                    const option = plantOptions.find((each) => each.value === slug);
                    return { label: option?.label ?? slug, count: option?.count ?? 0 };
                  })}
                  removeLabel="Remove the plant filter"
                  onRemove={() => withPlant([])}
                />
                <Button variant="link" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <p data-list-status>{snapshot === undefined ? 'Loading warehouses.' : statusLine}</p>
              <p className="flex flex-wrap gap-x-2">
                {snapshot?.fixture !== undefined && (
                  <span>Showing fixture {snapshot.fixture}.</span>
                )}
                <span>{warehouseActionReason}</span>
              </p>
            </div>
          </div>
        )
      }
      state={state}
    >
      <DataTable
        label="Warehouses"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.code}
        hiddenColumns={hiddenColumns}
        loading={snapshot === undefined}
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
