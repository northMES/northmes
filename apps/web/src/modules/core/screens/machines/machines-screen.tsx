// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { CircleCheck, Ellipsis, Lock, Pencil, Plus } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ColumnsMenu } from '../../../../ui/components/columns-menu/index.ts';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { FilterChip } from '../../../../ui/components/filter-chip/index.ts';
import { FilterMenu } from '../../../../ui/components/filter-menu/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { SearchField } from '../../../../ui/components/search-field/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../ui/primitives/dropdown-menu.tsx';
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import { GroupColor } from '../../components/group-color/index.ts';
import {
  type PlantMachine,
  PlantSettingsForbidden,
  type PlantSettingsSnapshot,
} from '../../plant-settings-data.ts';
import { allowedIn, allowedInText, groupNamer, plantTime } from '../../plant-settings-facts.ts';
import { plantSettingsActionReason } from '../../plant-settings-reasons.ts';
import {
  type MachineListSearch,
  machineListSearch,
  urlSearchOf,
} from '../../plant-settings-search.ts';
import { usePlantSettings } from '../../plant-settings-source-context.ts';

/** The id of the search input, where Clear filters moves focus. */
const searchFieldId = 'machines-search';

/** The token of the Calendar filter for a machine without one. */
const noCalendar = 'none';

/** One row of the list: a machine with what the columns show of it. */
interface MachineRow {
  readonly machine: PlantMachine;
  readonly groupName: string;
  readonly groupColor: string | undefined;
  readonly allowedCount: number;
}

interface CellView {
  readonly plant: string;
}

function columnsOf(view: CellView): readonly DataTableColumn<MachineRow>[] {
  return [
    {
      id: 'code',
      header: 'Code',
      cell: (row) => (
        <Link
          to={coreLinks.machines.machine({ plant: view.plant, equipmentId: row.machine.code }).href}
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
        <span className="inline-flex items-center gap-2">
          <GroupColor color={row.groupColor} shape="stripe" />
          {row.machine.name}
        </span>
      ),
    },
    {
      id: 'group',
      header: 'Group',
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5">
          <GroupColor color={row.groupColor} shape="dot" />
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
        row.machine.calendar === null ? (
          <span className="text-muted-foreground">None</span>
        ) : (
          <Link
            to={
              coreLinks.calendars.calendar({ plant: view.plant, calendarId: row.machine.calendar })
                .href
            }
            className="font-mono text-link underline underline-offset-2 hover:no-underline"
          >
            {row.machine.calendar}
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
      cell: (row) => {
        const edit = coreLinks.machines.machine.edit({
          plant: view.plant,
          equipmentId: row.machine.code,
        }).href;
        return (
          <span className="flex items-center justify-end gap-1">
            <Link to={edit} className={`${buttonVariants({ variant: 'outline' })} h-8 px-2.5`}>
              <Pencil aria-hidden />
              Edit
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Actions for ${row.machine.code}`}
                  />
                }
              >
                <Ellipsis aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem render={<Link to={edit} />}>Edit</DropdownMenuItem>
                <DropdownMenuItem disabled>Archive</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        );
      },
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

/** The rows of the snapshot, by code. */
function rowsOf(snapshot: PlantSettingsSnapshot): MachineRow[] {
  const groupName = groupNamer(snapshot);
  return [...snapshot.equipment]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((machine) => ({
      machine,
      groupName: groupName(machine.group),
      groupColor: snapshot.equipmentGroups.find((group) => group.code === machine.group)?.color,
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
  if (except !== 'group' && view.group !== undefined && !view.group.includes(row.machine.group)) {
    return false;
  }
  const calendar = row.machine.calendar ?? noCalendar;
  return except === 'calendar' || view.calendar === undefined || view.calendar.includes(calendar);
}

/** The equipment groups above the table (MA1): each a link to the list filtered to it. */
function EquipmentGroups({
  snapshot,
  rows,
}: {
  readonly snapshot: PlantSettingsSnapshot;
  readonly rows: readonly MachineRow[];
}) {
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
        <Button variant="outline" className="h-8 px-3" disabled>
          <Plus aria-hidden />
          New equipment group
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {snapshot.equipmentGroups.map((group) => {
          const count = rows.filter((row) => row.machine.group === group.code).length;
          return (
            <Link
              key={group.code}
              to={coreLinks.machines({ plant }, { group: group.code }).href}
              className={`${buttonVariants({ variant: 'outline' })} h-8 gap-2 px-2.5 font-normal`}
            >
              <GroupColor color={group.color} shape="dot" />
              {/* The spaces keep the link's name "Machining MACH 3 machines" in words. */}
              <span>{group.name}</span>{' '}
              <span className="font-mono text-xs text-muted-foreground">{group.code}</span>{' '}
              <span className="text-xs text-muted-foreground">
                {count === 1 ? '1 machine' : `${count} machines`}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The machines of the plant in plant settings (E06; design #688, MA1 to MA9): the equipment groups
 * above the table, the search, the Group and Calendar filters with their counts, Plannable only
 * and Columns, and one row per machine with its code, name with the group's color stripe, group,
 * plannable flag, calendar and the count of routing operations that allow it. Search, the filters
 * and Plannable only live in the URL (ADR 0062); the columns stay local. The preview key opens the
 * loading, empty, failed and no-access states on the fixture. New machine, New equipment group
 * and Archive wait for the equipment API.
 */
export function MachinesScreen() {
  const { plant } = useShell();
  const view = machineListSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const show = (next: MachineListSearch) =>
    navigate({ to: '.', search: urlSearchOf(next), replace: true });
  const { snapshot, error, retry } = usePlantSettings(view.preview);
  const [hiddenColumns, setHiddenColumns] = useState<readonly string[]>([]);
  const plannableId = `${searchFieldId}-plannable`;

  const allRows = useMemo(() => (snapshot === undefined ? [] : rowsOf(snapshot)), [snapshot]);
  const rows = allRows.filter((row) => matches(row, view));
  const columns = useMemo(() => columnsOf({ plant }), [plant]);
  const groupName = snapshot === undefined ? (code: string) => code : groupNamer(snapshot);
  const facets = (key: 'group' | 'calendar') => {
    // A picked value stays in the menu and names its chip even when no row passes with it.
    const counts = new Map<string, number>((view[key] ?? []).map((value) => [value, 0]));
    for (const row of allRows) {
      if (!matches(row, view, key)) continue;
      const value = key === 'group' ? row.machine.group : (row.machine.calendar ?? noCalendar);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([value, count]) => ({
        value,
        label: key === 'group' ? groupName(value) : value === noCalendar ? 'None' : value,
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

  const forbidden = snapshot === undefined && error instanceof PlantSettingsForbidden;
  const plannable = rows.filter((row) => row.machine.isPlannable).length;
  const statusLine = `${rows.length} machine${rows.length === 1 ? '' : 's'}, ${plannable} plannable, ${
    snapshot?.equipmentGroups.length ?? 0
  } equipment group${snapshot?.equipmentGroups.length === 1 ? '' : 's'}${
    view.plannable === 1 ? ', plannable only' : ''
  }. Sorted by code. Allowed in counts the routing operations that may run on the machine.`;
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
      title: 'You need the permission to read machines at this plant',
      description: 'Ask your plant admin for a role that can read machines.',
    };
  } else if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load machines', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (allRows.length === 0) {
    state = {
      status: 'empty',
      title: 'No machines yet',
      description:
        'Machines come from the ERP or are created here. Create the first one, or wait for the next import.',
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
            New machine
          </Button>
        )
      }
      toolbar={
        forbidden ? undefined : (
          <div className="flex flex-col gap-3">
            {snapshot !== undefined && allRows.length > 0 && (
              <EquipmentGroups snapshot={snapshot} rows={allRows} />
            )}
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
              <ColumnsMenu
                columns={columnChoices}
                hidden={hiddenColumns}
                onChange={setHiddenColumns}
              />
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
              <p data-list-status>{statusLine}</p>
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
        label="Machines"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.machine.code}
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
