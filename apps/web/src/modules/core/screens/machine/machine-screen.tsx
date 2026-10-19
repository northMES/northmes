// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useParams, useSearch } from '@tanstack/react-router';
import { cn } from 'cn';
import { Archive, ChartGantt, CircleCheck, Lock, Pencil } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/primitives/table.tsx';
import {
  type PlantMachine,
  PlantSettingsForbidden,
  type PlantSettingsSnapshot,
} from '../../plant-settings-data.ts';
import {
  allowedIn,
  breaksText,
  groupColorOf,
  groupNamer,
  machineNamer,
  openOrdersOf,
  plantTime,
  shiftText,
  weekOf,
} from '../../plant-settings-facts.ts';
import { plantSettingsActionReason } from '../../plant-settings-reasons.ts';
import { machinePageSearch } from '../../plant-settings-search.ts';
import { usePlantSettings } from '../../plant-settings-source-context.ts';
import { GroupColor } from '../machines/index.ts';

const head = 'h-auto px-3 py-2 text-xs font-semibold text-muted-foreground';
const cell = 'px-3 py-2 whitespace-normal';

/** A section of the page: a card named by its h2, with a line that says where its content comes from. */
function Section({
  title,
  lead,
  action,
  children,
}: {
  readonly title: string;
  readonly lead?: ReactNode;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 text-card-foreground"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id={id} className="text-base font-semibold">
            {title}
          </h2>
          {lead !== undefined && <p className="text-sm text-muted-foreground">{lead}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

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
  readonly machine: PlantMachine;
}) {
  const { plant } = useShell();
  const color = groupColorOf(snapshot, machine);
  const calendar = snapshot.calendars.find((each) => each.name === machine.calendar);
  const lead =
    machine.owner === 'erp'
      ? `From the ERP, machine code ${machine.code}${
          snapshot.erp === undefined
            ? ''
            : `, imported ${plantTime(snapshot, snapshot.erp.importedAtMs)}`
        }. The plannable flag came with it.`
      : 'Created in NorthMES.';
  return (
    <Section title="Machine" lead={lead}>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Definition term="Code" value={machine.code} mono />
        <Definition term="Name" value={machine.name} />
        <Definition
          term="Equipment group"
          value={
            <span className="inline-flex items-center gap-1.5">
              <GroupColor color={color} shape="dot" />
              {groupNamer(snapshot)(machine.group)}
            </span>
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
                to={coreLinks.calendars.calendar({ plant, calendarId: calendar.name }).href}
                className="font-mono text-link underline underline-offset-2 hover:no-underline"
              >
                {calendar.name}
              </Link>
            )
          }
          note={
            calendar === undefined
              ? 'A machine without a calendar has no working time.'
              : `${shiftText(calendar)}, ${breaksText(calendar)}. The plant calendar by default.`
          }
        />
        <Definition
          term="Color stripe"
          value={
            <span className="inline-flex items-center gap-2">
              <GroupColor color={color} shape="stripe" />
              From the group
            </span>
          }
          note="The 6 px stripe before the machine name on the board."
        />
      </dl>
    </Section>
  );
}

/** The Allowed in section (MA3): the routing operations that may run on the machine. */
function AllowedSection({
  snapshot,
  machine,
}: {
  readonly snapshot: PlantSettingsSnapshot;
  readonly machine: PlantMachine;
}) {
  const machineName = machineNamer(snapshot);
  const allowed = allowedIn(snapshot, machine.code);
  return (
    <Section
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
    </Section>
  );
}

/** The week section (MA3): the machine's job orders of the snapshot's week, committed plan. */
function WeekSection({
  snapshot,
  machine,
}: {
  readonly snapshot: PlantSettingsSnapshot;
  readonly machine: PlantMachine;
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
    <Section
      title={`This week on ${machine.name}`}
      lead={`${week.label}, committed plan.`}
      action={
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
    </Section>
  );
}

/**
 * A machine's page in plant settings (E06; design #688, MA3): its code in the h1 with the group's
 * color stripe, name and group beside it; the Machine section with the rule behind each fact, the
 * routing operations that allow the machine and its job orders this week; Edit as a link and
 * Archive disabled until the equipment API exists. An unknown code shows the not-found state (MF2).
 */
export function MachineScreen() {
  const { plant } = useShell();
  const { equipmentId = '' } = useParams({ strict: false });
  const search = machinePageSearch(useSearch({ strict: false }));
  const { snapshot, error, retry } = usePlantSettings(search.preview);
  const machine = snapshot?.equipment.find((each) => each.code === equipmentId);
  const back = coreLinks.machines({ plant }).href;
  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && error instanceof PlantSettingsForbidden) {
    state = {
      status: 'empty',
      icon: Lock,
      title: 'You need the permission to read machines at this plant',
      description: 'Ask your plant admin for a role that can read machines.',
    };
  } else if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load the machine', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (machine === undefined) {
    state = {
      status: 'empty',
      title: 'This machine does not exist or you cannot see it',
      description:
        'The link may be out of date, or the machine belongs to a plant you have no role in.',
      action: (
        <Link to={back} className={buttonVariants({ variant: 'outline' })}>
          Back to Machines
        </Link>
      ),
    };
  }
  const loaded = snapshot !== undefined && machine !== undefined;
  return (
    <PageFrame
      title={machine === undefined ? 'Machine' : `Machine ${machine.code}`}
      crumbs={[{ label: 'Machines', href: back }]}
      meta={
        loaded ? (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <GroupColor color={groupColorOf(snapshot, machine)} shape="stripe" />
            {machine.name}, {groupNamer(snapshot)(machine.group)}
          </span>
        ) : undefined
      }
      actions={
        loaded ? (
          <>
            <Link
              to={coreLinks.machines.machine.edit({ plant, equipmentId: machine.code }).href}
              className={buttonVariants({ variant: 'outline' })}
            >
              <Pencil aria-hidden />
              Edit
            </Link>
            <Button variant="outline" disabled>
              <Archive aria-hidden />
              Archive
            </Button>
          </>
        ) : undefined
      }
      state={state}
    >
      {loaded && (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <p>{plantSettingsActionReason}</p>
            {snapshot.fixture !== undefined && <p>Showing fixture {snapshot.fixture}.</p>}
          </div>
          <MachineSection snapshot={snapshot} machine={machine} />
          <AllowedSection snapshot={snapshot} machine={machine} />
          <WeekSection snapshot={snapshot} machine={machine} />
        </>
      )}
    </PageFrame>
  );
}
