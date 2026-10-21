// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useParams, useSearch } from '@tanstack/react-router';
import { Lock, Pencil } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
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
import { GroupBand } from '../../components/group-band/index.ts';
import { GroupColor } from '../../components/group-color/index.ts';
import { ScrollTable } from '../../components/scroll-table/index.ts';
import { SourceTag } from '../../components/source-tag/index.ts';
import { colorNote, colorText, machineCountText, machinesOf } from '../../equipment-group-facts.ts';
import { PlantSettingsForbidden } from '../../plant-settings-data.ts';
import { machinePageSearch } from '../../plant-settings-search.ts';
import { usePlantSettings } from '../../plant-settings-source-context.ts';

const head = 'h-auto px-3 py-2 text-xs font-semibold text-muted-foreground';
const cell = 'px-3 py-2 whitespace-normal';
const link = 'text-link underline underline-offset-2 hover:no-underline';

/** A section of the page: a card named by its h2, with a line under the heading. */
function Section({
  title,
  lead,
  children,
}: {
  readonly title: string;
  readonly lead?: ReactNode;
  readonly children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 text-card-foreground"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {lead !== undefined && <p className="text-sm text-muted-foreground">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

/** One term of the group's description list, with an optional note under its value. */
function Term({
  term,
  children,
  note,
}: {
  readonly term: string;
  readonly children: ReactNode;
  readonly note?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-muted-foreground">{term}</dt>
      <dd className="flex flex-col gap-0.5 text-sm">
        <span className="flex flex-wrap items-center gap-2">{children}</span>
        {note !== undefined && <span className="text-xs text-muted-foreground">{note}</span>}
      </dd>
    </div>
  );
}

/**
 * An equipment group's page in plant settings (design #729, EG4): its code in the h1 with its
 * name, where it came from, its scope and its color with where the color came from, the plant's
 * machines in it, and the band it draws on the board. A group the snapshot does not hold shows
 * the not-found state. History is not built in this round.
 */
export function EquipmentGroupScreen() {
  const { plant } = useShell();
  const { groupCode = '' } = useParams({ strict: false });
  const search = machinePageSearch(useSearch({ strict: false }));
  const { snapshot, error, retry } = usePlantSettings(search.preview);
  const group = snapshot?.equipmentGroups.find((each) => each.code === groupCode);
  const back = coreLinks.equipmentGroups({ plant }).href;

  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && error instanceof PlantSettingsForbidden) {
    state = {
      status: 'empty',
      icon: Lock,
      title: 'You need the permission to manage the settings of this plant',
      description: 'Ask your plant admin for a role that manages plant settings.',
    };
  } else if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load the equipment group', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (group === undefined) {
    state = {
      status: 'empty',
      title: 'This equipment group does not exist or you cannot see it',
      description: 'The link may be out of date, or the group belongs to another plant.',
      action: (
        <Link to={back} className={buttonVariants({ variant: 'outline' })}>
          Back to Equipment groups
        </Link>
      ),
    };
  }
  const machines = snapshot === undefined ? [] : machinesOf(snapshot, groupCode);
  const plantName = snapshot?.plant.name ?? 'the plant';
  return (
    <PageFrame
      title={`Equipment group ${group?.code ?? groupCode}`}
      crumbs={[{ label: 'Equipment groups', href: back }]}
      state={state}
      actions={
        group === undefined ? undefined : (
          <Link
            to={coreLinks.equipmentGroups.group.edit({ plant, groupCode: group.code }).href}
            className={buttonVariants({ variant: 'outline' })}
          >
            <Pencil aria-hidden />
            Edit equipment group
          </Link>
        )
      }
      meta={
        group === undefined ? undefined : (
          <span className="text-sm text-muted-foreground">{group.name}</span>
        )
      }
    >
      {snapshot !== undefined && group !== undefined && (
        <>
          <Section
            title="Equipment group"
            lead={
              group.owner === 'northmes'
                ? 'Created in NorthMES.'
                : 'Imported from the ERP with the machines.'
            }
          >
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Term term="Code">
                <span className="font-mono">{group.code}</span>
                <SourceTag kind={group.owner === 'northmes' ? 'northmes' : 'erp'} />
              </Term>
              <Term term="Name">{group.name}</Term>
              <Term
                term="Scope"
                {...(group.scope.kind === 'company' && {
                  note: `A company group: every plant of ${group.scope.name} may use it.`,
                })}
              >
                {group.scope.name}
              </Term>
              <Term term="Color" note={colorNote(group.colorFrom)}>
                <GroupColor color={group.color} shape="stripe" />
                {colorText(group.color)}
              </Term>
            </dl>
          </Section>
          <Section
            title="Machines"
            lead={`${machineCountText(machines.length)} at ${plantName}. A machine's group is set on the machine's page.`}
          >
            {machines.length > 0 && (
              <ScrollTable label={`Machines in ${group.code}`}>
                <Table>
                  <TableCaption className="sr-only">Machines in {group.code}</TableCaption>
                  <TableHeader className="bg-muted">
                    <TableRow className="hover:bg-transparent">
                      {['Code', 'Name', 'Plannable', 'Calendar'].map((label) => (
                        <TableHead key={label} scope="col" className={head}>
                          {label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {machines.map((machine) => (
                      <TableRow key={machine.code}>
                        <TableCell className={cell}>
                          <Link
                            to={
                              coreLinks.machines.machine({ plant, equipmentId: machine.code }).href
                            }
                            className={`font-mono ${link}`}
                          >
                            {machine.code}
                          </Link>
                        </TableCell>
                        <TableCell className={cell}>{machine.name}</TableCell>
                        <TableCell className={cell}>{machine.isPlannable ? 'Yes' : 'No'}</TableCell>
                        <TableCell className={`${cell} font-mono`}>
                          {machine.calendar ?? 'None'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollTable>
            )}
          </Section>
          <Section title="On the board" lead="The color and the name are always shown together.">
            <GroupBand
              name={group.name}
              color={group.color}
              machines={machines.map((machine) => machine.name)}
            />
          </Section>
          {snapshot.fixture !== undefined && (
            <p className="text-xs text-muted-foreground">Showing fixture {snapshot.fixture}.</p>
          )}
        </>
      )}
    </PageFrame>
  );
}
