// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useMutation } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { v7 as uuidv7 } from 'uuid';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { useZodForm } from '../../../../ui/lib/use-zod-form.ts';
import {
  MachineForm,
  type MachineValues,
  machineFormFields,
} from '../../components/machine-form/index.ts';
import { CoreEquipment } from '../../equipment.graphql.ts';
import { createMachineForbiddenState } from '../../machine-states.tsx';
import { showRegisterSaveError } from '../../master-data/register-save-error.ts';
import { useEquipmentGroups } from '../../use-equipment-groups.ts';
import { usePlaces } from '../../use-places.ts';
import { useViewer } from '../../use-viewer.ts';
import { CoreCreateEquipment } from './create-machine.graphql.ts';

/**
 * The new machine page: the machine form with the active groups the plant sees, plannable and on
 * its group's color until the user says otherwise, validated with the fields of
 * core.createEquipment. Save sends the values under a uuidv7 the page made once, so a retry after a
 * lost answer finds the first machine (ADR 0012). A saved machine opens on its page, and the
 * polite region says "Machine PRESS9 created". A user who may not create machines here sees the
 * no-access state.
 */
export function NewMachineScreen() {
  const { plant } = useShell();
  const navigate = useNavigate();
  const viewer = useViewer();
  const places = usePlaces();
  const { data } = useEquipmentGroups(false);
  const [id] = useState(() => uuidv7());
  const form = useZodForm(machineFormFields, {
    defaultValues: { code: '', name: '', groupId: '', isPlannable: true, color: 'group' },
  });
  const [create] = useMutation(CoreCreateEquipment, {
    // The machine's page opens on the answer, and every list reads the machines again.
    update: (cache, { data: answer }) => {
      if (!answer) return;
      const machine = answer.coreCreateEquipment;
      cache.writeQuery({
        query: CoreEquipment,
        variables: { id: machine.id },
        data: { coreEquipment: machine },
      });
      cache.evict({ fieldName: 'coreEquipmentList' });
      cache.gc();
    },
  });
  const machines = coreLinks.settings.machines({ plant }).href;

  const save = async (values: MachineValues) => {
    const { code, name, groupId, isPlannable = true, color = 'group' } = values;
    try {
      const { data: created } = await create({
        variables: { input: { id, code, name, groupId, isPlannable, color } },
      });
      if (!created) return;
      const machine = created.coreCreateEquipment;
      announce(`Machine ${machine.code} created`);
      await navigate({
        to: coreLinks.settings.machines.machine({ plant, equipmentId: machine.id }).href,
        replace: true,
      });
    } catch (error) {
      showRegisterSaveError(form, error, values, {
        forbidden: 'You do not have permission to create machines at this plant.',
      });
    }
  };

  const plantName = places.plant?.name ?? 'the plant';
  let state: PageState = { status: 'ready' };
  if (viewer.error !== undefined) {
    state = {
      status: 'error',
      title: 'Could not open New machine',
      error: viewer.error,
      onRetry: viewer.retry,
    };
  } else if (!viewer.loaded) {
    state = { status: 'loading' };
  } else if (!viewer.can('core.equipment:create')) {
    state = createMachineForbiddenState(plantName);
  }
  return (
    <PageFrame title="New machine" crumbs={[{ label: 'Machines', href: machines }]} state={state}>
      {state.status === 'ready' && (
        <MachineForm
          form={form}
          onSave={save}
          cancelHref={machines}
          groups={data?.coreEquipmentGroups.edges.map(({ node }) => node) ?? []}
          isNew
        />
      )}
    </PageFrame>
  );
}
