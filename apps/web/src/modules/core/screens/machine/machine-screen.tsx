// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useParams } from '@tanstack/react-router';
import { cn } from 'cn';
import { Archive, ChartGantt, CircleCheck, Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageFrame } from '../../../../ui/components/page-frame/index.ts';
import { PageSection } from '../../../../ui/components/page-section/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { buttonVariants } from '../../../../ui/primitives/button.tsx';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/primitives/table.tsx';
import { GroupColor } from '../../components/group-color/index.ts';
import { CoreEquipment, type Machine } from '../../equipment.graphql.ts';
import { colorText } from '../../equipment-group-facts.ts';
import { calendarOf, stripeColorOf } from '../../machine-facts.ts';
import { isMachineId, machinePageState } from '../../machine-states.tsx';
import type { PlantSettingsSnapshot } from '../../plant-settings-data.ts';
import {
  allowedIn,
  machineNamer,
  openOrdersOf,
  patternText,
  plantTime,
  weekOf,
} from '../../plant-settings-facts.ts';
import { machineFixtureNote } from '../../plant-settings-reasons.ts';
import { usePlantSettings } from '../../plant-settings-source-context.ts';
import { usePlaces } from '../../use-places.ts';
import { useViewer } from '../../use-viewer.ts';
import { MachineActions } from './machine-actions.tsx';

/** A machine as the fixture's sections read it: by its code, named by its name. */
type NamedMachine = Pick<Machine, 'code' | 'name'>;

const head = 'h-auto px-3 py-2 text-xs font-semibold text-muted-foreground';
const cell = 'px-3 py-2 whitespace-normal';

/** A term, its value and the note under the value that names its rule (MA3). */
function Definition({
  term,
  value,
  note,
  mono = false,
}: {
  readonly term: string;
  readonly value: ReactNode;
  readonly note?: ReactNode;
  readonly mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-muted-foreground">{term}</dt>
      <dd className="flex flex-col gap-0.5">
        <span className={cn('text-sm', mono && 'font-mono')}>{value}</span>
        {note !== undefined && <span className="text-xs text-muted-foreground">{note}</span>}
      </dd>
    </div>
  );
}

/** The Machine section (MA3): the facts with the rule behind each. */
function MachineSection({
  snapshot,
  machine,
}: {
  readonly snapshot: PlantSettingsSnapshot;
  readonly machine: Machine;
}) {
  const { plant } = useShell();
  const calendar = calendarOf(snapshot, machine.code);
  return (
    <PageSection title="Machine">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Definition term="Code" value={machine.code} mono />
        <Definition term="Name" value={machine.name} />
        <Definition
          term="Equipment group"
          value={
            machine.group === null ? (
              <span className="text-muted-foreground">Not shown</span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <GroupColor color={machine.group.color} shape="dot" />
                <Link
                  to={
                    coreLinks.settings.equipmentGroups.group({ plant, groupId: machine.groupId })
                      .href
                  }
                  className="text-link underline underline-offset-2 hover:no-underline"
                >
                  {machine.group.name}
                </Link>
              </span>
            )
          }
          note="Its row band on the board."
        />
        <Definition
          term="Plannable"
          value={
            machine.isPlannable ? (
              <StatusBadge tone="success" icon={CircleCheck}>
                Yes
              </StatusBadge>
            ) : (
              <StatusBadge tone="neutral">No</StatusBadge>
            )
          }
          note={
            machine.isPlannable
              ? 'Appears on the board and the Gantt; autoplan places job orders on it.'
              : 'Not on the board; autoplan places nothing on it.'
          }
        />
        <Definition
          term="Calendar"
          value={
            calendar === undefined ? (
              <span className="text-muted-foreground">None</span>
            ) : (
              <Link
                to={
                  coreLinks.settings.calendars.calendar({ plant, calendarId: calendar.name }).href
                }
                className="font-mono text-link underline underline-offset-2 hover:no-underline"
              >
                {calendar.name}
              </Link>
            )
          }
          note={
            calendar === undefined
              ? 'A machine without a calendar has no working time.'
              : `${patternText(calendar)}.${calendar.plantDefault ? ' The plant calendar by default.' : ''}`
          }
        />
        <Definition
          term="Color stripe"
          value={
            <span className="inline-flex items-center gap-2">
              <GroupColor color={stripeColorOf(machine)} shape="stripe" />
              {machine.color === null
                ? `From the group${machine.group === null ? '' : `, ${colorText(machine.group.color)}`}`
                : `${colorText(machine.color)}, its own`}
            </span>
          }
          note="The 6 px stripe before the machine name on the board."
        />
      </dl>
    </PageSection>
  );
}

/** The Allowed in section (MA3): the routing operations that may run on the machine. */
function AllowedSection({
  snapshot,
  machine,
}: {
  readonly snapshot: PlantSettingsSnapshot;
  readonly machine: NamedMachine;
}) {
  const machineName = machineNamer(snapshot);
  const allowed = allowedIn(snapshot, machine.code);
  return (
    <PageSection
      title="Allowed in"
      lead={
        allowed.length === 0
          ? 'No routing operation names this machine.'
          : `${allowed.length} routing operation${allowed.length === 1 ? '' : 's'} may run on this machine. Autoplan prefers the default machine of each operation.`
      }
    >
      {allowed.length > 0 && (
        <Table>
          <TableCaption className="sr-only">
            Routing operations that may run on {machine.name}
          </TableCaption>
          <TableHeader className="bg-muted">
            <TableRow className="hover:bg-transparent">
              {['Article', 'Operation', 'Other allowed machines', 'Open orders'].map((label) => (
                <TableHead key={label} scope="col" className={head}>
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {allowed.map((operation) => (
              <TableRow key={`${operation.routing.article}-${operation.sequence}`}>
                <TableCell className={cell}>{operation.routing.article}</TableCell>
                <TableCell className={cell}>
                  <span className="font-mono">{operation.sequence}</span> {operation.name}
                </TableCell>
                <TableCell className={cell}>
                  {operation.others.length === 0 ? (
                    <span className="text-muted-foreground">None, only machine</span>
                  ) : (
                    operation.others.map(machineName).join(', ')
                  )}
                </TableCell>
                <TableCell className={cn(cell, 'font-mono')}>
                  {openOrdersOf(snapshot, operation.routing.article).join(', ')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageSection>
  );
}

/** The week section (MA3): the machine's job orders of the snapshot's week, committed plan. */
function WeekSection({
  snapshot,
  machine,
}: {
  readonly snapshot: PlantSettingsSnapshot;
  readonly machine: NamedMachine;
}) {
  const { plant } = useShell();
  const week = weekOf(snapshot.nowMs, snapshot.plant.timeZone);
  const rows = snapshot.jobOrders
    .filter(
      (row) =>
        row.equipment === machine.code && row.endMs > week.fromMs && row.setupStartMs < week.toMs,
    )
    .sort((a, b) => a.setupStartMs - b.setupStartMs);
  return (
    <PageSection
      title={`This week on ${machine.name}`}
      lead={`${week.label}, committed plan.`}
      actions={
        <Link
          to={planningLinks.board({ plant }, { zoom: 'week', from: week.monday }).href}
          className={`${buttonVariants({ variant: 'outline' })} h-8 px-3`}
        >
          <ChartGantt aria-hidden />
          Show on board
        </Link>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No job order on this machine this week.</p>
      ) : (
        <Table>
          <TableCaption className="sr-only">
            Job orders on {machine.name} in {week.label}
          </TableCaption>
          <TableHeader className="bg-muted">
            <TableRow className="hover:bg-transparent">
              {['Job order', 'Article', 'Setup start', 'End'].map((label) => (
                <TableHead key={label} scope="col" className={head}>
                  {label}
                </TableHead>
              ))}
              <TableHead scope="col" className={cn(head, 'text-end')}>
                Quantity
              </TableHead>
              <TableHead scope="col" className={head}>
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className={cell}>
                  <span className="font-mono font-medium">{row.displayNumber}</span>{' '}
                  <span className="text-muted-foreground">{row.operationName}</span>
                </TableCell>
                <TableCell className={cell}>{row.article}</TableCell>
                <TableCell className={cn(cell, 'font-mono')}>
                  {plantTime(snapshot, row.setupStartMs)}
                </TableCell>
                <TableCell className={cn(cell, 'font-mono')}>
                  {plantTime(snapshot, row.endMs)}
                </TableCell>
                <TableCell className={cn(cell, 'text-end font-mono')}>{row.quantity} pcs</TableCell>
                <TableCell className={cell}>
                  <StatusBadge tone={row.status === 'planned' ? 'info' : 'success'}>
                    {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                  </StatusBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageSection>
  );
}

/**
 * A machine's page in plant settings (design #688, MA3): its code in the h1 with its color stripe,
 * name and group beside it; the Machine section with the rule behind each fact, the routing
 * operations that allow the machine and its job orders this week. The machine comes from the API
 * by its id; its calendar, the routing operations and the week still come from the fixture G1 by
 * its code. Edit machine shows to a user who may change it, Archive or Restore to one who may
 * archive it. An archived machine carries the Archived badge; an unknown id or an old link by code
 * shows the not-found state (MF2).
 */
export function MachineScreen() {
  const { plant } = useShell();
  const { equipmentId = '' } = useParams({ strict: false });
  const valid = isMachineId(equipmentId);
  const { data, error, refetch } = useQuery(CoreEquipment, {
    variables: { id: equipmentId },
    skip: !valid,
  });
  const { snapshot } = usePlantSettings(undefined);
  const places = usePlaces();
  const viewer = useViewer();
  // An old link by the machine's code names no machine.
  const machine = !valid ? null : data === undefined ? undefined : data.coreEquipment;
  const back = coreLinks.settings.machines({ plant }).href;
  const state = machinePageState({
    plant,
    plantName: places.plant?.name ?? 'the plant',
    machine,
    restLoaded: snapshot !== undefined && viewer.loaded,
    error: error ?? viewer.error,
    retry: () =>
      Promise.all([
        error === undefined ? undefined : refetch(),
        viewer.error === undefined ? undefined : viewer.retry(),
      ]),
  });
  const editable = machine && machine.archivedAt === null && viewer.can('core.equipment:update');
  return (
    <PageFrame
      title={machine ? `Machine ${machine.code}` : 'Machine'}
      crumbs={[{ label: 'Machines', href: back }]}
      meta={
        machine ? (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <GroupColor color={stripeColorOf(machine)} shape="stripe" />
            {machine.group === null ? machine.name : `${machine.name}, ${machine.group.name}`}
          </span>
        ) : undefined
      }
      actions={
        machine ? (
          <>
            {editable && (
              <Link
                to={
                  coreLinks.settings.machines.machine.edit({ plant, equipmentId: machine.id }).href
                }
                className={buttonVariants({ variant: 'outline' })}
              >
                <Pencil aria-hidden />
                Edit machine
              </Link>
            )}
            <MachineActions machine={machine} />
          </>
        ) : undefined
      }
      state={state}
    >
      {state.status === 'ready' && machine && snapshot !== undefined && (
        <>
          {machine.archivedAt !== null && (
            <p>
              <StatusBadge tone="neutral" icon={Archive}>
                Archived
              </StatusBadge>
            </p>
          )}
          <MachineSection snapshot={snapshot} machine={machine} />
          <AllowedSection snapshot={snapshot} machine={machine} />
          <WeekSection snapshot={snapshot} machine={machine} />
          <p className="text-xs text-muted-foreground">{machineFixtureNote}</p>
        </>
      )}
    </PageFrame>
  );
}
