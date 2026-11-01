// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Archive, Info, Layers, Pencil, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ColumnsMenu } from '../../../../ui/components/columns-menu/index.ts';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { FilterChip } from '../../../../ui/components/filter-chip/index.ts';
import { FilterMenu } from '../../../../ui/components/filter-menu/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { isForbidden } from '../../../../ui/lib/graphql-errors.ts';
import { Alert, AlertDescription } from '../../../../ui/primitives/alert.tsx';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import { GroupColor } from '../../components/group-color/index.ts';
import {
  colorFromText,
  colorText,
  machineCountText,
  machinesOf,
} from '../../equipment-group-facts.ts';
import { canChangeGroup, machinesFixtureNote } from '../../equipment-group-states.tsx';
import type { EquipmentGroupRow } from '../../equipment-groups.graphql.ts';
import { readForbiddenState } from '../../no-access.tsx';
import type {
  GroupColorFrom,
  PlantMachine,
  PlantSettingsSnapshot,
} from '../../plant-settings-data.ts';
import {
  type EquipmentGroupListSearch,
  equipmentGroupListSearch,
  urlSearchOf,
} from '../../plant-settings-search.ts';
import { usePlantSettings } from '../../plant-settings-source-context.ts';
import { useEquipmentGroups } from '../../use-equipment-groups.ts';
import { usePlaces } from '../../use-places.ts';
import { useViewer, type Viewer } from '../../use-viewer.ts';

/** The id of the filter row, where Clear filters moves focus to the Scope menu. */
const filtersId = 'equipment-groups-filters';

/** The id of the Show archived checkbox, which its label names. */
const showArchivedId = 'equipment-groups-show-archived';

const link = 'text-link underline underline-offset-2 hover:no-underline';

type Scope = 'company' | 'plant';

/** One row of the list: a group with the plant's machines in it. */
interface GroupRow {
  readonly group: EquipmentGroupRow;
  readonly machines: readonly PlantMachine[];
}

/** The names a row shows: the scope's, and the plant's for its machines. */
interface Names {
  readonly plant: string;
  readonly company: string;
}

function columnsOf(plant: string, names: Names, viewer: Viewer): DataTableColumn<GroupRow>[] {
  return [
    {
      id: 'color',
      header: 'Color',
      cell: (row) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <GroupColor color={row.group.color} shape="stripe" />
          {colorText(row.group.color)}
        </span>
      ),
    },
    {
      id: 'code',
      header: 'Code',
      cell: (row) => (
        <Link
          to={coreLinks.settings.equipmentGroups.group({ plant, groupId: row.group.id }).href}
          className={`font-mono ${link}`}
        >
          {row.group.code}
        </Link>
      ),
    },
    {
      id: 'name',
      header: 'Name',
      cell: (row) =>
        row.group.archivedAt === null ? (
          row.group.name
        ) : (
          <span className="flex flex-wrap items-center gap-2">
            {row.group.name}
            <StatusBadge tone="neutral" icon={Archive}>
              Archived
            </StatusBadge>
          </span>
        ),
    },
    {
      id: 'scope',
      header: 'Scope',
      cell: (row) => (row.group.scope === 'company' ? names.company : names.plant),
    },
    {
      id: 'machines',
      header: 'Machines',
      cell: (row) =>
        row.machines.length === 0 ? (
          <span className="text-muted-foreground">No machines at {names.plant}</span>
        ) : (
          <span className="flex flex-col">
            <span>{machineCountText(row.machines.length)}</span>
            <span className="text-xs text-muted-foreground">
              {row.machines.map((machine) => machine.name).join(', ')}
            </span>
          </span>
        ),
    },
    {
      id: 'colorFrom',
      header: 'Color from',
      cell: (row) => colorFromText(row.group.colorFrom as GroupColorFrom),
    },
    {
      id: 'actions',
      header: 'Actions',
      headerHidden: true,
      cell: (row) =>
        row.group.archivedAt === null && canChangeGroup(viewer, row.group, 'update') ? (
          <span className="flex justify-end">
            <Link
              to={
                coreLinks.settings.equipmentGroups.group.edit({ plant, groupId: row.group.id }).href
              }
              aria-label={`Edit ${row.group.code}`}
              className={`${buttonVariants({ variant: 'outline' })} h-8 px-2.5`}
            >
              <Pencil aria-hidden />
              Edit
            </Link>
          </span>
        ) : null,
    },
  ];
}

const columnChoices = [
  { id: 'color', label: 'Color' },
  { id: 'code', label: 'Code', alwaysShown: true },
  { id: 'name', label: 'Name' },
  { id: 'scope', label: 'Scope' },
  { id: 'machines', label: 'Machines' },
  { id: 'colorFrom', label: 'Color from' },
] as const;

/** The groups in the API's order, by code, each with the plant's machines in it. */
function rowsOf(groups: readonly EquipmentGroupRow[], snapshot: PlantSettingsSnapshot): GroupRow[] {
  return groups.map((group) => ({ group, machines: machinesOf(snapshot, group.code) }));
}

/** "HEAT is a company group with no machines at Plant A.", for each group without machines here. */
function idleText(rows: readonly GroupRow[], plantName: string): string {
  return rows
    .filter((row) => row.machines.length === 0)
    .map((row) =>
      row.group.scope === 'company'
        ? ` ${row.group.code} is a company group with no machines at ${plantName}.`
        : ` ${row.group.code} has no machines at ${plantName}.`,
    )
    .join('');
}

/** New equipment group, for a holder of core.equipmentGroup:create at the plant or the company. */
function NewEquipmentGroupLink() {
  const { plant } = useShell();
  const viewer = useViewer();
  const permission = 'core.equipmentGroup:create';
  if (!viewer.can(permission) && !viewer.canAtCompany(permission)) return null;
  return (
    <Link to={coreLinks.settings.equipmentGroups.new({ plant }).href} className={buttonVariants()}>
      <Plus aria-hidden />
      New equipment group
    </Link>
  );
}

/**
 * The equipment groups the plant sees in plant settings (design #729, EG1 to EG9): the color rule,
 * the Scope filter, Show archived and Columns, and one row per group with its color, code, name,
 * scope, the plant's machines in it and where its color came from. The groups come from the API,
 * the plant's own and the company's, every page of them; the machines in each still come from the
 * fixture G1. The Scope filter lives in the URL (ADR 0062); Show archived and the columns stay
 * local. Edit shows on a group the user may change, New equipment group to a user who may create
 * one at the plant or the company.
 */
export function EquipmentGroupsScreen() {
  const { plant } = useShell();
  const view = equipmentGroupListSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const show = (next: EquipmentGroupListSearch) =>
    navigate({ to: '.', search: urlSearchOf(next), replace: true });
  const [showArchived, setShowArchived] = useState(false);
  const { data, previousData, error, refetch, pageError, retryPage } =
    useEquipmentGroups(showArchived);
  const { snapshot } = usePlantSettings(undefined);
  const places = usePlaces();
  const viewer = useViewer();
  const [hiddenColumns, setHiddenColumns] = useState<readonly string[]>([]);
  const names: Names = {
    plant: places.plant?.name ?? 'the plant',
    company: places.company?.name ?? 'The company',
  };

  const page = data?.coreEquipmentGroups ?? previousData?.coreEquipmentGroups;
  const loaded = page !== undefined && snapshot !== undefined;
  const allRows = useMemo(
    () =>
      page === undefined || snapshot === undefined
        ? []
        : rowsOf(
            page.edges.map(({ node }) => node),
            snapshot,
          ),
    [page, snapshot],
  );
  const rows = allRows.filter(
    (row) => view.scope === undefined || view.scope.includes(row.group.scope as Scope),
  );
  const columns = columnsOf(plant, names, viewer);
  const scopeLabel = (value: Scope) => (value === 'company' ? names.company : names.plant);
  const scopeOptions = (['company', 'plant'] as const).map((value) => ({
    value,
    label: scopeLabel(value),
    count: allRows.filter((row) => row.group.scope === value).length,
  }));
  const withScope = (values: readonly string[]) => {
    const { scope: _, ...rest } = view;
    const scope = values.filter(
      (value): value is Scope => value === 'company' || value === 'plant',
    );
    show(scope.length === 0 ? rest : { ...rest, scope });
  };
  const clearFilters = () => {
    withScope([]);
    document.querySelector<HTMLElement>(`#${filtersId} button`)?.focus();
  };

  const forbidden = data === undefined && isForbidden(error);
  const failed = page === undefined && error !== undefined;
  const machineCount = rows.reduce((sum, row) => sum + row.machines.length, 0);
  const statusLine =
    allRows.length === 0
      ? 'No equipment groups.'
      : `${rows.length} equipment group${rows.length === 1 ? '' : 's'}, ${machineCount} machine${
          machineCount === 1 ? '' : 's'
        }. Sorted by code.${idleText(rows, names.plant)}`;
  const announced = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!loaded) return;
    if (announced.current !== undefined && announced.current !== statusLine) announce(statusLine);
    announced.current = statusLine;
  }, [loaded, statusLine]);

  let state: PageState = { status: 'ready' };
  if (forbidden) {
    state = readForbiddenState('equipment groups', names.plant);
  } else if (failed) {
    state = {
      status: 'error',
      title: 'Could not load equipment groups',
      error,
      onRetry: () => refetch(),
    };
  } else if (pageError !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load equipment groups',
      error: pageError,
      onRetry: retryPage,
    };
  } else if (!loaded) {
    state = { status: 'loading' };
  } else if (allRows.length === 0 && !showArchived) {
    state = {
      status: 'empty',
      icon: Layers,
      title: 'No equipment groups yet',
      description: 'Every machine on the board needs a group. Create the first one here.',
      action: <NewEquipmentGroupLink />,
    };
  } else if (rows.length === 0 && view.scope !== undefined) {
    state = {
      status: 'empty',
      title: 'No equipment groups match these filters',
      description: 'Change or clear the filters to see equipment groups again.',
      action: (
        <Button variant="link" onClick={clearFilters}>
          Clear filters
        </Button>
      ),
    };
  }
  return (
    <PageFrame
      title="Equipment groups"
      actions={forbidden ? undefined : <NewEquipmentGroupLink />}
      toolbar={
        forbidden ? undefined : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              A group is a band of machine rows on the board, with its color and name always shown
              together.
            </p>
            <Alert role="note">
              <Info aria-hidden />
              <AlertDescription className="text-foreground">
                A group keeps the color it has. A new group without a picked color takes the first
                of the 20 palette colors that no other group uses.
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <div id={filtersId} className="flex flex-wrap items-center gap-2">
                <FilterMenu
                  label="Scope"
                  heading="Show equipment groups of these scopes"
                  options={scopeOptions}
                  selected={view.scope ?? []}
                  onChange={withScope}
                />
              </div>
              <Field orientation="horizontal" className="w-auto">
                <Checkbox
                  id={showArchivedId}
                  checked={showArchived}
                  onCheckedChange={(shown) => setShowArchived(shown)}
                />
                <FieldLabel htmlFor={showArchivedId}>Show archived</FieldLabel>
              </Field>
            </div>
            {view.scope !== undefined && (
              <div className="flex flex-wrap items-center gap-2">
                <FilterChip
                  label="Scope"
                  values={view.scope.map((value) => ({
                    label: scopeLabel(value),
                    count: scopeOptions.find((each) => each.value === value)?.count ?? 0,
                  }))}
                  removeLabel="Remove the scope filter"
                  onRemove={() => withScope([])}
                />
                <Button variant="link" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <p data-list-status>
                {failed ? '' : loaded ? statusLine : 'Loading equipment groups.'}
              </p>
              <p>{machinesFixtureNote}</p>
            </div>
          </div>
        )
      }
      state={state}
      busy={data === undefined && page !== undefined}
    >
      <DataTable
        label={loaded ? `Equipment groups of ${names.plant}` : 'Equipment groups'}
        scrollLabel="Equipment groups, scrolls sideways"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.group.id}
        hiddenColumns={hiddenColumns}
        headerMenu={
          <ColumnsMenu
            compact
            columns={columnChoices}
            hidden={hiddenColumns}
            onChange={setHiddenColumns}
          />
        }
        loading={!loaded}
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
