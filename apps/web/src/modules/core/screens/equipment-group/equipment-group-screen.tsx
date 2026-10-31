// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic

import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useParams, useSearch } from '@tanstack/react-router';
import { Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageFrame } from '../../../../ui/components/page-frame/index.ts';
import { PageSection } from '../../../../ui/components/page-section/index.ts';
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
import { equipmentGroupPageState } from '../../equipment-group-states.tsx';
import { equipmentGroupPageSearch } from '../../plant-settings-search.ts';
import { usePlantSettings } from '../../plant-settings-source-context.ts';

const head = 'h-auto px-3 py-2 text-xs font-semibold text-muted-foreground';
const cell = 'px-3 py-2 whitespace-normal';
const link = 'text-link underline underline-offset-2 hover:no-underline';

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
  const search = equipmentGroupPageSearch(useSearch({ strict: false }));
  const { snapshot, error, retry } = usePlantSettings(search.preview);
  const group = snapshot?.equipmentGroups.find((each) => each.code === groupCode);
  const back = coreLinks.settings.equipmentGroups({ plant }).href;

  const state = equipmentGroupPageState({
    plant,
    loaded: snapshot !== undefined,
    found: group !== undefined,
    error,
    retry,
  });
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
            to={
              coreLinks.settings.equipmentGroups.group.edit({ plant, groupCode: group.code }).href
            }
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
          <PageSection
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
                <SourceTag kind={group.owner} />
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
          </PageSection>
          <PageSection
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
                              coreLinks.settings.machines.machine({
                                plant,
                                equipmentId: machine.code,
                              }).href
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
          </PageSection>
          <PageSection
            title="On the board"
            lead="Only plannable machines have a row on the board. The color and the name are always shown together."
          >
            <GroupBand name={group.name} color={group.color} machines={machines} />
          </PageSection>
          {snapshot.fixture !== undefined && (
            <p className="text-xs text-muted-foreground">Showing fixture {snapshot.fixture}.</p>
          )}
        </>
      )}
    </PageFrame>
  );
}
