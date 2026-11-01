// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useParams } from '@tanstack/react-router';
import { Archive, Pencil } from 'lucide-react';
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
import { GroupBand } from '../../components/group-band/index.ts';
import { GroupColor } from '../../components/group-color/index.ts';
import { ScrollTable } from '../../components/scroll-table/index.ts';
import { CoreEquipmentGroup } from '../../equipment-group.graphql.ts';
import { colorNote, colorText, machineCountText, machinesOf } from '../../equipment-group-facts.ts';
import {
  canChangeGroup,
  equipmentGroupPageState,
  isGroupId,
  machinesFixtureNote,
} from '../../equipment-group-states.tsx';
import type { GroupColorFrom } from '../../plant-settings-data.ts';
import { usePlantSettings } from '../../plant-settings-source-context.ts';
import { usePlaces } from '../../use-places.ts';
import { useViewer } from '../../use-viewer.ts';
import { EquipmentGroupActions } from './equipment-group-actions.tsx';

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
 * name, its scope and its color with where the color came from, the plant's machines in it, and
 * the band it draws on the board. Edit equipment group shows to a user who may change the group,
 * Archive or Restore to one who may archive it, where it sits. An archived group carries the
 * Archived badge. The group comes from the API by its id; its machines still come from the fixture
 * G1 by its code. History is not built in this round.
 */
export function EquipmentGroupScreen() {
  const { plant } = useShell();
  const { groupId = '' } = useParams({ strict: false });
  const valid = isGroupId(groupId);
  const { data, error, refetch } = useQuery(CoreEquipmentGroup, {
    variables: { id: groupId },
    skip: !valid,
  });
  const { snapshot } = usePlantSettings(undefined);
  const places = usePlaces();
  const viewer = useViewer();
  // An old link by the group's code names no group.
  const group = !valid ? null : data === undefined ? undefined : data.coreEquipmentGroup;
  const plantName = places.plant?.name ?? 'the plant';
  const companyName = places.company?.name ?? 'the company';
  const back = coreLinks.settings.equipmentGroups({ plant }).href;

  const state = equipmentGroupPageState({
    plant,
    plantName,
    group,
    restLoaded: snapshot !== undefined && viewer.loaded,
    error: error ?? viewer.error,
    retry: () =>
      Promise.all([
        error === undefined ? undefined : refetch(),
        viewer.error === undefined ? undefined : viewer.retry(),
      ]),
  });
  const machines = snapshot === undefined || !group ? [] : machinesOf(snapshot, group.code);
  const editable = group && group.archivedAt === null && canChangeGroup(viewer, group, 'update');
  return (
    <PageFrame
      title={group ? `Equipment group ${group.code}` : 'Equipment group'}
      crumbs={[{ label: 'Equipment groups', href: back }]}
      state={state}
      actions={
        group ? (
          <>
            {editable && (
              <Link
                to={
                  coreLinks.settings.equipmentGroups.group.edit({ plant, groupId: group.id }).href
                }
                className={buttonVariants({ variant: 'outline' })}
              >
                <Pencil aria-hidden />
                Edit equipment group
              </Link>
            )}
            <EquipmentGroupActions group={group} />
          </>
        ) : undefined
      }
      meta={group ? <span className="text-sm text-muted-foreground">{group.name}</span> : undefined}
    >
      {state.status === 'ready' && group && (
        <>
          {group.archivedAt !== null && (
            <p>
              <StatusBadge tone="neutral" icon={Archive}>
                Archived
              </StatusBadge>
            </p>
          )}
          <PageSection title="Equipment group">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Term term="Code">
                <span className="font-mono">{group.code}</span>
              </Term>
              <Term term="Name">{group.name}</Term>
              <Term
                term="Scope"
                {...(group.scope === 'company' && {
                  note: `A company group: every plant of ${companyName} may use it.`,
                })}
              >
                {group.scope === 'company' ? companyName : plantName}
              </Term>
              <Term term="Color" note={colorNote(group.colorFrom as GroupColorFrom)}>
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
          <p className="text-xs text-muted-foreground">{machinesFixtureNote}</p>
        </>
      )}
    </PageFrame>
  );
}
