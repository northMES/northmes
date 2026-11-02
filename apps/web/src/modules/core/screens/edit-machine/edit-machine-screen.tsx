// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { PageFrame } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { hasErrorCode } from '../../../../ui/lib/graphql-errors.ts';
import { useZodForm } from '../../../../ui/lib/use-zod-form.ts';
import { Skeleton } from '../../../../ui/primitives/skeleton.tsx';
import {
  MachineForm,
  type MachineFormGroup,
  type MachineValues,
  machineFormFields,
} from '../../components/machine-form/index.ts';
import { CoreEquipment, type Machine } from '../../equipment.graphql.ts';
import { isMachineId, machinePageState } from '../../machine-states.tsx';
import { showRegisterSaveError } from '../../master-data/register-save-error.ts';
import { useEquipmentGroups } from '../../use-equipment-groups.ts';
import { usePlaces } from '../../use-places.ts';
import { useViewer } from '../../use-viewer.ts';
import { CoreUpdateEquipment } from './update-machine.graphql.ts';

/** The form's values as the machine holds them. */
function valuesOf(machine: Machine): MachineValues {
  return {
    code: machine.code,
    name: machine.name,
    groupId: machine.groupId,
    isPlannable: machine.isPlannable,
    color: (machine.color ?? 'group') as MachineValues['color'],
  };
}

/**
 * The groups the machine may join: the active ones the plant sees, by code, and the machine's own
 * group when it is archived, so the form still names it.
 */
function groupsFor(
  machine: Machine,
  active: readonly MachineFormGroup[] | undefined,
): MachineFormGroup[] {
  const groups = [...(active ?? [])];
  const own = machine.group;
  if (own !== null && !groups.some((each) => each.id === own.id)) {
    groups.push(own);
    groups.sort((a, b) => a.code.localeCompare(b.code));
  }
  return groups;
}

/**
 * The machine's form as it was when the page opened. Save sends the name, the group, the plannable
 * flag and the color stripe with the version the form was filled from as expectedVersion, so a
 * change someone saved in between is refused with core.version_conflict, not overwritten. Reload
 * reads the saved machine outside the page's query, so a failed reload keeps the form and its
 * entries. A saved change returns to the machine's page.
 */
function EditForm({ machine }: { readonly machine: Machine }) {
  const client = useApolloClient();
  const { plant } = useShell();
  const navigate = useNavigate();
  const viewer = useViewer();
  const { data } = useEquipmentGroups(false);
  const expectedVersion = useRef(machine.version);
  const [conflict, setConflict] = useState(false);
  const form = useZodForm(machineFormFields, { defaultValues: valuesOf(machine) });
  const [update] = useMutation(CoreUpdateEquipment, {
    update: (cache) => {
      cache.evict({ fieldName: 'coreEquipmentList' });
      cache.gc();
    },
  });
  const machinePage = coreLinks.settings.machines.machine({ plant, equipmentId: machine.id }).href;

  const save = async (values: MachineValues) => {
    setConflict(false);
    const { code, name, groupId, isPlannable = true, color = 'group' } = values;
    try {
      const { data: saved } = await update({
        variables: {
          input: {
            id: machine.id,
            expectedVersion: expectedVersion.current,
            code,
            name,
            groupId,
            isPlannable,
            color,
          },
        },
      });
      if (!saved) return;
      announce(`Machine ${saved.coreUpdateEquipment.code} saved`);
      await navigate({ to: machinePage, replace: true });
    } catch (error) {
      if (hasErrorCode(error, 'core.version_conflict')) {
        setConflict(true);
        return;
      }
      showRegisterSaveError(form, error, values, {
        forbidden: 'You do not have permission to change machines at this plant.',
      });
    }
  };

  const onReload = async () => {
    const saved = await client
      .query({ query: CoreEquipment, variables: { id: machine.id }, fetchPolicy: 'network-only' })
      .then(({ data: answer }) => answer?.coreEquipment ?? undefined)
      .catch(() => undefined);
    if (saved === undefined) {
      form.setError('root.server', {
        type: 'server',
        message: 'Could not reload the machine. Your entries are kept. Try again.',
      });
      return;
    }
    form.reset(valuesOf(saved));
    expectedVersion.current = saved.version;
    setConflict(false);
    document.getElementById(fieldId('name'))?.focus();
  };

  const archived = machine.archivedAt !== null;
  const allowed = viewer.can('core.equipment:update');
  const notes = [
    ...(archived ? [`${machine.code} is archived. Restore it on its page to change it.`] : []),
    ...(!archived && !allowed ? ['You may read this machine but not change it.'] : []),
  ];
  return (
    <MachineForm
      form={form}
      onSave={save}
      cancelHref={machinePage}
      groups={groupsFor(
        machine,
        data?.coreEquipmentGroups.edges.map(({ node }) => node),
      )}
      notes={notes}
      conflict={conflict ? { onReload } : undefined}
      editable={!archived && allowed}
    />
  );
}

/** The form's skeleton while the machine loads (MF1): one section of field placeholders. */
function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <Skeleton aria-hidden className="h-4 w-32 rounded-sm bg-accent" />
        <div className="grid gap-4 sm:grid-cols-2">
          {['code', 'name', 'group'].map((field) => (
            <div key={field} className="flex flex-col gap-2">
              <Skeleton aria-hidden className="h-3 w-20 rounded-sm bg-accent" />
              <Skeleton aria-hidden className="h-9 w-full rounded-md bg-accent" />
            </div>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Loading the machine.</p>
    </div>
  );
}

/**
 * The edit form of a machine in plant settings (design #688, MA4 and MF1 to MF4): the code, which
 * stays, the name, the equipment group, the plannable flag and the color stripe. Save machine
 * shows to a user who may change machines at the plant; to anyone else, and on an archived
 * machine, the form is read-only. An id the plant does not have shows the not-found state.
 */
export function EditMachineScreen() {
  const { plant } = useShell();
  const { equipmentId = '' } = useParams({ strict: false });
  const valid = isMachineId(equipmentId);
  const { data, error, refetch } = useQuery(CoreEquipment, {
    variables: { id: equipmentId },
    skip: !valid,
  });
  const places = usePlaces();
  const viewer = useViewer();
  // An old link by the machine's code names no machine.
  const machine = !valid ? null : data === undefined ? undefined : data.coreEquipment;
  const machinePage = coreLinks.settings.machines.machine({ plant, equipmentId }).href;
  const state = machinePageState({
    plant,
    plantName: places.plant?.name ?? 'the plant',
    machine,
    restLoaded: viewer.loaded,
    error: error ?? viewer.error,
    retry: () =>
      Promise.all([
        error === undefined ? undefined : refetch(),
        viewer.error === undefined ? undefined : viewer.retry(),
      ]),
  });
  return (
    <PageFrame
      title={machine ? `Edit machine ${machine.code}` : 'Edit machine'}
      crumbs={[
        { label: 'Machines', href: coreLinks.settings.machines({ plant }).href },
        ...(machine ? [{ label: `Machine ${machine.code}`, href: machinePage }] : []),
      ]}
      currentCrumb="Edit"
      meta={
        machine ? <span className="text-sm text-muted-foreground">{machine.name}</span> : undefined
      }
      state={state}
    >
      {state.status === 'loading' && <FormSkeleton />}
      {/* A reloaded or another machine gets a fresh form, so its entries never carry over. */}
      {state.status === 'ready' && machine && <EditForm key={machine.id} machine={machine} />}
    </PageFrame>
  );
}
