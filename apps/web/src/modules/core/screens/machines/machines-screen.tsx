// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Archive, CircleCheck, Pencil, Plus } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ColumnsMenu } from '../../../../ui/components/columns-menu/index.ts';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { FilterChip } from '../../../../ui/components/filter-chip/index.ts';
import { FilterMenu } from '../../../../ui/components/filter-menu/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { SearchField } from '../../../../ui/components/search-field/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { isForbidden } from '../../../../ui/lib/graphql-errors.ts';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import { GroupColor } from '../../components/group-color/index.ts';
import { machineCountText } from '../../equipment-group-facts.ts';
import type { MachineRow as Machine } from '../../equipment-list.graphql.ts';
import { calendarOf, stripeColorOf } from '../../machine-facts.ts';
import { readForbiddenState } from '../../no-access.tsx';
import type { PlantSettingsSnapshot } from '../../plant-settings-data.ts';
import { allowedIn, allowedInText } from '../../plant-settings-facts.ts';
import { machineFixtureNote } from '../../plant-settings-reasons.ts';
import {
  type MachineListSearch,
  machineListSearch,
  urlSearchOf,
} from '../../plant-settings-search.ts';
import { usePlantSettings } from '../../plant-settings-source-context.ts';
import { useMachines } from '../../use-machines.ts';
import { usePlaces } from '../../use-places.ts';
import { useViewer, type Viewer } from '../../use-viewer.ts';

/** The id of the search input, where Clear filters moves focus. */
const searchFieldId = 'machines-search';

/** The id of the Show archived checkbox, which its label names. */
const showArchivedId = 'machines-show-archived';

/** The token of the Calendar filter for a machine without one. */
const noCalendar = 'none';

/** One row of the list: a machine with what the columns show of it. */
interface MachineRow {
  readonly machine: Machine;
  /** The group's code, which the Group filter keeps in the URL; empty where it is not shown. */
  readonly groupCode: string;
  readonly groupName: string;
  /** The calendar's name from the fixture G1, or none. */
  readonly calendar: string | null;
  readonly allowedCount: number;
}

interface CellView {
  readonly plant: string;
  readonly viewer: Viewer;
}

function columnsOf(view: CellView): readonly DataTableColumn<MachineRow>[] {
  return [
    {
      id: 'code',
      header: 'Code',
      cell: (row) => (
        <Link
          to={
            coreLinks.settings.machines.machine({
              plant: view.plant,
              equipmentId: row.machine.id,
            }).href
          }
          className="font-mono text-link underline underline-offset-2 hover:no-underline"
          data-machine={row.machine.code}
        >
          {row.machine.code}
        </Link>
      ),
    },
    {
      id: 'name',
      header: 'Name',
      cell: (row) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <GroupColor color={stripeColorOf(row.machine)} shape="stripe" />
          {row.machine.name}
          {row.machine.archivedAt !== null && (
            <StatusBadge tone="neutral" icon={Archive}>
              Archived
            </StatusBadge>
          )}
        </span>
      ),
    },
    {
      id: 'group',
      header: 'Group',
      cell: (row) =>
        row.machine.group === null ? (
          <span className="text-muted-foreground">Not shown</span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <GroupColor color={row.machine.group.color} shape="dot" />
            {row.groupName}
          </span>
        ),
    },
    {
      id: 'plannable',
      header: 'Plannable',
      cell: (row) =>
        row.machine.isPlannable ? (
          <StatusBadge tone="success" icon={CircleCheck}>
            Yes
          </StatusBadge>
        ) : (
          <StatusBadge tone="neutral">No</StatusBadge>
        ),
    },
    {
      id: 'calendar',
      header: 'Calendar',
      cell: (row) =>
        row.calendar === null ? (
          <span className="text-muted-foreground">None</span>
        ) : (
          <Link
            to={
              coreLinks.settings.calendars.calendar({
                plant: view.plant,
                calendarId: row.calendar,
              }).href
            }
            className="font-mono text-link underline underline-offset-2 hover:no-underline"
          >
            {row.calendar}
          </Link>
        ),
    },
    {
      id: 'allowedIn',
      header: 'Allowed in',
      cell: (row) => <span className="font-mono">{allowedInText(row.allowedCount)}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      headerHidden: true,
      cell: (row) =>
        row.machine.archivedAt === null && view.viewer.can('core.equipment:update') ? (
          <span className="flex justify-end">
            <Link
              to={
                coreLinks.settings.machines.machine.edit({
                  plant: view.plant,
                  equipmentId: row.machine.id,
                }).href
              }
              aria-label={`Edit ${row.machine.code}`}
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
  { id: 'code', label: 'Code', alwaysShown: true },
  { id: 'name', label: 'Name' },
  { id: 'group', label: 'Group' },
  { id: 'plannable', label: 'Plannable' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'allowedIn', label: 'Allowed in' },
] as const;

/**
 * The rows of the machines in the API's order, by code, each with its calendar and the routing
 * operations that allow it from the fixture G1.
 */
function rowsOf(machines: readonly Machine[], snapshot: PlantSettingsSnapshot): MachineRow[] {
  return machines.map((machine) => ({
    machine,
    groupCode: machine.group?.code ?? '',
    groupName: machine.group?.name ?? '',
    calendar: calendarOf(snapshot, machine.code)?.name ?? null,
    allowedCount: allowedIn(snapshot, machine.code).length,
  }));
}

/** Whether a row passes the view's search, Plannable only and filters, a field left out aside. */
function matches(row: MachineRow, view: MachineListSearch, except?: 'group' | 'calendar'): boolean {
  if (view.plannable === 1 && !row.machine.isPlannable) return false;
  if (view.q !== undefined) {
    const needle = view.q.toLowerCase();
    if (
      ![row.machine.code, row.machine.name, row.groupName].some((text) =>
        text.toLowerCase().includes(needle),
      )
    ) {
      return false;
    }
  }
  if (except !== 'group' && view.group !== undefined && !view.group.includes(row.groupCode)) {
    return false;
  }
  const calendar = row.calendar ?? noCalendar;
  return except === 'calendar' || view.calendar === undefined || view.calendar.includes(calendar);
}

/** A group that holds machines at the plant, with how many. */
interface GroupHere {
  readonly code: string;
  readonly name: string;
  readonly color: string;
  readonly count: number;
}

/**
 * The groups that hold active machines at the plant, by code: a company group with none here leads
 * nowhere.
 */
function groupsHere(rows: readonly MachineRow[]): GroupHere[] {
  const groups = new Map<string, GroupHere>();
  for (const { machine } of rows) {
    if (machine.group === null || machine.archivedAt !== null) continue;
    const known = groups.get(machine.group.code);
    groups.set(machine.group.code, {
      code: machine.group.code,
      name: machine.group.name,
      color: machine.group.color,
      count: (known?.count ?? 0) + 1,
    });
  }
  return [...groups.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/** New equipment group, for a holder of core.equipmentGroup:create at the plant or the company. */
function NewEquipmentGroupLink() {
  const { plant } = useShell();
  const viewer = useViewer();
  const permission = 'core.equipmentGroup:create';
  if (!viewer.can(permission) && !viewer.canAtCompany(permission)) return null;
  return (
    <Link
      to={coreLinks.settings.equipmentGroups.new({ plant }).href}
      className={`${buttonVariants({ variant: 'outline' })} h-8 px-3`}
    >
      <Plus aria-hidden />
      New equipment group
    </Link>
  );
}

/** The equipment groups above the table (MA1): each a link to the list filtered to it. */
function EquipmentGroups({ rows }: { readonly rows: readonly MachineRow[] }) {
  const { plant } = useShell();
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 text-card-foreground"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id={headingId} className="text-sm font-semibold">
            Equipment groups
          </h2>
          <p className="text-sm text-muted-foreground">
            A group is a band of rows on the board. Its color and name are always shown together.
          </p>
        </div>
        <NewEquipmentGroupLink />
      </div>
      <div className="flex flex-wrap gap-2">
        {groupsHere(rows).map((group) => (
          <Link
            key={group.code}
            to={coreLinks.settings.machines({ plant }, { group: group.code }).href}
            className={`${buttonVariants({ variant: 'outline' })} h-8 gap-2 px-2.5 font-normal`}
          >
            <GroupColor color={group.color} shape="dot" />
            {/* The spaces keep the link's name "Machining MACH 3 machines" in words. */}
            <span>{group.name}</span>{' '}
            <span className="font-mono text-xs text-muted-foreground">{group.code}</span>{' '}
            <span className="text-xs text-muted-foreground">{machineCountText(group.count)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** New machine, for a holder of core.equipment:create at the plant. */
function NewMachineLink() {
  const { plant } = useShell();
  const viewer = useViewer();
  if (!viewer.can('core.equipment:create')) return null;
  return (
    <Link to={coreLinks.settings.machines.new({ plant }).href} className={buttonVariants()}>
      <Plus aria-hidden />
      New machine
    </Link>
  );
}

/**
 * The machines of the plant in plant settings (design #688, MA1 to MA9): the equipment groups
 * above the table, the search, the Group and Calendar filters with their counts, Plannable only,
 * Show archived and Columns, and one row per machine with its code, name with its color stripe,
 * group, plannable flag, calendar and the count of routing operations that allow it. The machines
 * come from the API, every page of them; their calendars and routing operations still come from
 * the fixture G1 by code. Search, the filters, Plannable only and Show archived live in the URL
 * (ADR 0062); the columns stay local. Edit shows on a machine the user may change, New machine to
 * a user who may create one.
 */
export function MachinesScreen() {
  const { plant } = useShell();
  const view = machineListSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const show = (next: MachineListSearch) =>
    navigate({ to: '.', search: urlSearchOf(next), replace: true });
  const showArchived = view.archived === 1;
  const { data, previousData, error, refetch, pageError, retryPage } = useMachines(showArchived);
  const { snapshot } = usePlantSettings(undefined);
  const places = usePlaces();
  const viewer = useViewer();
  const [hiddenColumns, setHiddenColumns] = useState<readonly string[]>([]);
  const plannableId = `${searchFieldId}-plannable`;
  const plantName = places.plant?.name ?? 'the plant';

  // The rows of the list before stand in only while the next answer loads, never for a failed one.
  const failed = data === undefined && error !== undefined;
  const page = data?.coreEquipmentList ?? (failed ? undefined : previousData?.coreEquipmentList);
  // The list counts as loaded once every page is in, so the status line never counts one page.
  const loaded =
    page !== undefined &&
    snapshot !== undefined &&
    (!page.pageInfo.hasNextPage || pageError !== undefined);
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
  const rows = allRows.filter((row) => matches(row, view));
  const columns = columnsOf({ plant, viewer });
  const groupNames = new Map(allRows.map((row) => [row.groupCode, row.groupName]));
  const facets = (key: 'group' | 'calendar') => {
    // A picked value stays in the menu and names its chip even when no row passes with it.
    const counts = new Map<string, number>((view[key] ?? []).map((value) => [value, 0]));
    for (const row of allRows) {
      if (!matches(row, view, key)) continue;
      const value = key === 'group' ? row.groupCode : (row.calendar ?? noCalendar);
      // A group the user cannot read has no code to filter by.
      if (value === '') continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([value, count]) => ({
        value,
        label:
          key === 'group'
            ? (groupNames.get(value) ?? value)
            : value === noCalendar
              ? 'None'
              : value,
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  };
  const fields = [
    {
      key: 'group' as const,
      label: 'Group',
      heading: 'Show machines in these groups',
      remove: 'Remove the group filter',
    },
    {
      key: 'calendar' as const,
      label: 'Calendar',
      heading: 'Show machines on these calendars',
      remove: 'Remove the calendar filter',
    },
  ].map((field) => ({ ...field, values: facets(field.key), picked: view[field.key] ?? [] }));
  const filtered = view.group !== undefined || view.calendar !== undefined;
  const withFilter = (key: 'group' | 'calendar', values: readonly string[]) => {
    const { [key]: _, ...rest } = view;
    show(values.length === 0 ? rest : { ...rest, [key]: values });
  };
  const unfiltered = () => {
    const { group: _g, calendar: _c, ...rest } = view;
    return rest;
  };

  const forbidden = data === undefined && isForbidden(error);
  const plannable = rows.filter((row) => row.machine.isPlannable).length;
  const groupCount = groupsHere(allRows).length;
  const statusLine = `${rows.length} machine${rows.length === 1 ? '' : 's'}, ${plannable} plannable, ${groupCount} equipment group${groupCount === 1 ? '' : 's'}${
    view.plannable === 1 ? ', plannable only' : ''
  }. Sorted by code. Allowed in counts the routing operations that may run on the machine.`;
  const announced = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!loaded) return;
    if (announced.current !== undefined && announced.current !== statusLine) announce(statusLine);
    announced.current = statusLine;
  }, [loaded, statusLine]);

  let state: PageState = { status: 'ready' };
  if (forbidden) {
    state = readForbiddenState('machines', plantName);
  } else if (failed) {
    state = { status: 'error', title: 'Could not load machines', error, onRetry: () => refetch() };
  } else if (pageError !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load machines',
      error: pageError,
      onRetry: retryPage,
    };
  } else if (!loaded) {
    state = { status: 'loading' };
  } else if (allRows.length === 0) {
    state = {
      status: 'empty',
      title: 'No machines yet',
      description: viewer.can('core.equipment:create')
        ? 'Create the first machine here. Every machine belongs to an equipment group.'
        : 'A plant admin creates the machines here.',
      action: <NewMachineLink />,
    };
  } else if (rows.length === 0) {
    state = {
      status: 'empty',
      title: 'No machines match these filters',
      description: 'Change or clear the filters to see machines again.',
      action: (
        <Button
          variant="link"
          onClick={() => {
            const { q: _q, plannable: _p, ...rest } = unfiltered();
            show(rest);
            document.getElementById(searchFieldId)?.focus();
          }}
        >
          Clear filters
        </Button>
      ),
    };
  }
  return (
    <PageFrame
      title="Machines"
      actions={forbidden ? undefined : <NewMachineLink />}
      toolbar={
        forbidden ? undefined : (
          <div className="flex flex-col gap-3">
            {loaded && allRows.length > 0 && <EquipmentGroups rows={allRows} />}
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SearchField
                  id={searchFieldId}
                  label="Search machines"
                  value={view.q ?? ''}
                  onSearch={(q) => {
                    const { q: _, ...rest } = view;
                    show(q.trim() === '' ? rest : { ...rest, q: q.trim() });
                  }}
                  className="w-full max-w-sm"
                />
                {fields.map((field) => (
                  <FilterMenu
                    key={field.key}
                    label={field.label}
                    heading={field.heading}
                    options={field.values}
                    selected={field.picked}
                    onChange={(values) => withFilter(field.key, values)}
                  />
                ))}
                <Field orientation="horizontal" className="w-auto">
                  <Checkbox
                    id={plannableId}
                    checked={view.plannable === 1}
                    onCheckedChange={(checked) => {
                      const { plannable: _, ...rest } = view;
                      show(checked ? { ...rest, plannable: 1 } : rest);
                    }}
                  />
                  <FieldLabel htmlFor={plannableId}>Plannable only</FieldLabel>
                </Field>
              </div>
              <Field orientation="horizontal" className="min-h-(--nm-target-min) w-auto">
                <Checkbox
                  id={showArchivedId}
                  checked={showArchived}
                  onCheckedChange={(shown) => {
                    const { archived: _, ...rest } = view;
                    show(shown ? { ...rest, archived: 1 } : rest);
                  }}
                />
                <FieldLabel htmlFor={showArchivedId}>Show archived</FieldLabel>
              </Field>
            </div>
            {filtered && (
              <div className="flex flex-wrap items-center gap-2">
                {fields.map((field) =>
                  field.picked.length === 0 ? null : (
                    <FilterChip
                      key={field.key}
                      label={field.label}
                      values={field.picked.map((value) => {
                        const facet = field.values.find((each) => each.value === value);
                        return { label: facet?.label ?? value, count: facet?.count ?? 0 };
                      })}
                      removeLabel={field.remove}
                      onRemove={() => withFilter(field.key, [])}
                    />
                  ),
                )}
                <Button
                  variant="link"
                  onClick={() => {
                    show(unfiltered());
                    document.getElementById(searchFieldId)?.focus();
                  }}
                >
                  Clear filters
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <p data-list-status>
                {failed || pageError !== undefined ? '' : loaded ? statusLine : 'Loading machines.'}
              </p>
              <p>{machineFixtureNote}</p>
            </div>
          </div>
        )
      }
      state={state}
      busy={data === undefined && page !== undefined}
    >
      <DataTable
        label="Machines"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.machine.id}
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
