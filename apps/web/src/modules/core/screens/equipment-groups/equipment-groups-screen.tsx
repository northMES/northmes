// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Info, Layers, Lock, Pencil, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ColumnsMenu } from '../../../../ui/components/columns-menu/index.ts';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { FilterChip } from '../../../../ui/components/filter-chip/index.ts';
import { FilterMenu } from '../../../../ui/components/filter-menu/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Alert, AlertDescription } from '../../../../ui/primitives/alert.tsx';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import { GroupColor } from '../../components/group-color/index.ts';
import {
  colorFromText,
  colorText,
  machineCountText,
  machinesOf,
  ownerText,
} from '../../equipment-group-facts.ts';
import { groupsForbiddenDescription, groupsForbiddenTitle } from '../../equipment-group-states.tsx';
import {
  type PlantEquipmentGroup,
  type PlantMachine,
  PlantSettingsForbidden,
  type PlantSettingsSnapshot,
} from '../../plant-settings-data.ts';
import { plantTime } from '../../plant-settings-facts.ts';
import { plantSettingsActionReason } from '../../plant-settings-reasons.ts';
import {
  type EquipmentGroupListSearch,
  equipmentGroupListSearch,
  urlSearchOf,
} from '../../plant-settings-search.ts';
import { usePlantSettings } from '../../plant-settings-source-context.ts';

/** The id of the filter row, where Clear filters moves focus to the Scope menu. */
const filtersId = 'equipment-groups-filters';

const link = 'text-link underline underline-offset-2 hover:no-underline';

type Scope = PlantEquipmentGroup['scope']['kind'];

/** One row of the list: a group with the plant's machines in it. */
interface GroupRow {
  readonly group: PlantEquipmentGroup;
  readonly machines: readonly PlantMachine[];
}

function columnsOf(plant: string, plantName: string): DataTableColumn<GroupRow>[] {
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
          to={coreLinks.equipmentGroups.group({ plant, groupCode: row.group.code }).href}
          className={`font-mono ${link}`}
        >
          {row.group.code}
        </Link>
      ),
    },
    { id: 'name', header: 'Name', cell: (row) => row.group.name },
    { id: 'scope', header: 'Scope', cell: (row) => row.group.scope.name },
    {
      id: 'machines',
      header: 'Machines',
      cell: (row) =>
        row.machines.length === 0 ? (
          <span className="text-muted-foreground">No machines at {plantName}</span>
        ) : (
          <span className="flex flex-col">
            <span>{machineCountText(row.machines.length)}</span>
            <span className="text-xs text-muted-foreground">
              {row.machines.map((machine) => machine.name).join(', ')}
            </span>
          </span>
        ),
    },
    { id: 'colorFrom', header: 'Color from', cell: (row) => colorFromText(row.group.colorFrom) },
    { id: 'source', header: 'Source', cell: (row) => ownerText(row.group.owner) },
    {
      id: 'actions',
      header: 'Actions',
      headerHidden: true,
      cell: (row) => (
        <span className="flex justify-end">
          <Link
            to={coreLinks.equipmentGroups.group.edit({ plant, groupCode: row.group.code }).href}
            aria-label={`Edit ${row.group.code}`}
            className={`${buttonVariants({ variant: 'outline' })} h-8 px-2.5`}
          >
            <Pencil aria-hidden />
            Edit
          </Link>
        </span>
      ),
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
  { id: 'source', label: 'Source' },
] as const;

/** The groups of the snapshot by code, each with the plant's machines in it. */
function rowsOf(snapshot: PlantSettingsSnapshot): GroupRow[] {
  return [...snapshot.equipmentGroups]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((group) => ({ group, machines: machinesOf(snapshot, group.code) }));
}

/** "HEAT is a company group with no machines at Plant A.", for each group without machines here. */
function idleText(rows: readonly GroupRow[], plantName: string): string {
  return rows
    .filter((row) => row.machines.length === 0)
    .map((row) =>
      row.group.scope.kind === 'company'
        ? ` ${row.group.code} is a company group with no machines at ${plantName}.`
        : ` ${row.group.code} has no machines at ${plantName}.`,
    )
    .join('');
}

/**
 * The equipment groups of the plant in plant settings (design #729, EG1 to EG9): the color rule,
 * the Scope filter and Columns, and one row per group with its color, code, name, scope, the
 * plant's machines in it, where its color came from and its source. The Scope filter lives in the
 * URL (ADR 0062); the columns stay local. The preview key opens the loading, empty, failed and
 * no-access states on the fixture. New equipment group waits for the equipment API.
 */
export function EquipmentGroupsScreen() {
  const { plant } = useShell();
  const view = equipmentGroupListSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const show = (next: EquipmentGroupListSearch) =>
    navigate({ to: '.', search: urlSearchOf(next), replace: true });
  const { snapshot, error, retry } = usePlantSettings(view.preview);
  const [hiddenColumns, setHiddenColumns] = useState<readonly string[]>([]);
  const plantName = snapshot?.plant.name ?? 'the plant';
  const companyName = snapshot?.company.name ?? 'The company';

  const allRows = useMemo(() => (snapshot === undefined ? [] : rowsOf(snapshot)), [snapshot]);
  const rows = allRows.filter(
    (row) => view.scope === undefined || view.scope.includes(row.group.scope.kind),
  );
  const columns = useMemo(() => columnsOf(plant, plantName), [plant, plantName]);
  const scopeLabel = (value: Scope) => (value === 'company' ? companyName : plantName);
  const scopeOptions = (['company', 'plant'] as const).map((value) => ({
    value,
    label: scopeLabel(value),
    count: allRows.filter((row) => row.group.scope.kind === value).length,
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

  const forbidden = snapshot === undefined && error instanceof PlantSettingsForbidden;
  const failed = snapshot === undefined && error !== undefined;
  const machineCount = rows.reduce((sum, row) => sum + row.machines.length, 0);
  const statusLine =
    allRows.length === 0
      ? 'No equipment groups.'
      : `${rows.length} equipment group${rows.length === 1 ? '' : 's'}, ${machineCount} machine${
          machineCount === 1 ? '' : 's'
        }. Sorted by code.${idleText(rows, plantName)}`;
  const announced = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (snapshot === undefined) return;
    if (announced.current !== undefined && announced.current !== statusLine) announce(statusLine);
    announced.current = statusLine;
  }, [snapshot, statusLine]);

  let state: PageState = { status: 'ready' };
  if (forbidden) {
    state = {
      status: 'empty',
      icon: Lock,
      title: groupsForbiddenTitle,
      description: groupsForbiddenDescription,
    };
  } else if (failed) {
    state = { status: 'error', title: 'Could not load equipment groups', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (allRows.length === 0) {
    state = {
      status: 'empty',
      icon: Layers,
      title: 'No equipment groups yet',
      description:
        'Equipment groups come from the ERP with the machines, or are created here. Every machine on the board needs a group.',
    };
  } else if (rows.length === 0) {
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
      meta={
        snapshot?.erp === undefined ? undefined : (
          <span className="text-sm text-muted-foreground">
            ERP data as of {plantTime(snapshot, snapshot.erp.importedAtMs)}
          </span>
        )
      }
      actions={
        forbidden ? undefined : (
          <Button disabled>
            <Plus aria-hidden />
            New equipment group
          </Button>
        )
      }
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
                A group keeps the color it has. A group new from the ERP takes the color the ERP
                sends, else the first of the 20 palette colors that no other group uses.
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
                {failed ? '' : snapshot === undefined ? 'Loading equipment groups.' : statusLine}
              </p>
              <p className="flex flex-wrap gap-x-2">
                {snapshot?.fixture !== undefined && (
                  <span>Showing fixture {snapshot.fixture}.</span>
                )}
                <span>{plantSettingsActionReason}</span>
              </p>
            </div>
          </div>
        )
      }
      state={state}
    >
      <DataTable
        label={snapshot === undefined ? 'Equipment groups' : `Equipment groups of ${plantName}`}
        scrollLabel="Equipment groups, scrolls sideways"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.group.code}
        hiddenColumns={hiddenColumns}
        headerMenu={
          <ColumnsMenu
            compact
            columns={columnChoices}
            hidden={hiddenColumns}
            onChange={setHiddenColumns}
          />
        }
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
