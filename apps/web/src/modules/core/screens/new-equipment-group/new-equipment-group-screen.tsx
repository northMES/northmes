// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useMutation } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { v7 as uuidv7 } from 'uuid';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { useZodForm } from '../../../../ui/lib/use-zod-form.ts';
import {
  EquipmentGroupForm,
  type EquipmentGroupValues,
  equipmentGroupFormFields,
  type ScopeChoice,
} from '../../components/equipment-group-form/index.ts';
import { CoreEquipmentGroup } from '../../equipment-group.graphql.ts';
import { createGroupForbiddenState } from '../../equipment-group-states.tsx';
import { showRegisterSaveError } from '../../master-data/register-save-error.ts';
import { useEquipmentGroups } from '../../use-equipment-groups.ts';
import { usePlaces } from '../../use-places.ts';
import { useViewer } from '../../use-viewer.ts';
import { CoreCreateEquipmentGroup } from './create-equipment-group.graphql.ts';

const permission = 'core.equipmentGroup:create';

/**
 * The new equipment group page: the group form with the scopes where the user may create, the
 * plant first, validated with the fields of core.createEquipmentGroup. Save sends the values under
 * a uuidv7 the page made once, so a retry after a lost answer finds the first group (ADR 0012), and
 * sends a color only when one was picked, so the API takes the first free one. A saved group opens
 * on its page, and the polite region says "Equipment group PAINT created". A user who may create a
 * group nowhere here sees the no-access state.
 */
export function NewEquipmentGroupScreen() {
  const { plant } = useShell();
  const navigate = useNavigate();
  const viewer = useViewer();
  const places = usePlaces();
  const { data, error, pageError } = useEquipmentGroups(false);
  const groupsComplete =
    data !== undefined &&
    !data.coreEquipmentGroups.pageInfo.hasNextPage &&
    error === undefined &&
    pageError === undefined;
  const [id] = useState(() => uuidv7());
  const plantName = places.plant?.name ?? 'the plant';
  const scopes: ScopeChoice[] = [
    ...(viewer.can(permission) ? [{ value: 'plant' as const, label: plantName }] : []),
    ...(viewer.canAtCompany(permission)
      ? [
          {
            value: 'company' as const,
            label: `${places.company?.name ?? 'The company'}, for every plant of it`,
          },
        ]
      : []),
  ];
  const form = useZodForm(equipmentGroupFormFields, {
    defaultValues: { code: '', name: '' },
  });
  const firstScope = scopes[0]?.value;
  // The first scope the user may create at, once the viewer's permissions are in.
  useEffect(() => {
    if (firstScope !== undefined && form.getValues('scope') === undefined) {
      form.setValue('scope', firstScope);
    }
  }, [firstScope, form]);
  const [create] = useMutation(CoreCreateEquipmentGroup, {
    // The group's page opens on the answer, and every list reads the groups again.
    update: (cache, { data: answer }) => {
      if (!answer) return;
      const group = answer.coreCreateEquipmentGroup;
      cache.writeQuery({
        query: CoreEquipmentGroup,
        variables: { id: group.id },
        data: { coreEquipmentGroup: group },
      });
      cache.evict({ fieldName: 'coreEquipmentGroups' });
      cache.gc();
    },
  });
  const groups = coreLinks.settings.equipmentGroups({ plant }).href;

  const save = async (values: EquipmentGroupValues) => {
    const { code, name, color, scope = firstScope ?? 'plant' } = values;
    try {
      const { data: created } = await create({
        variables: { input: { id, scope, code, name, ...(color !== undefined && { color }) } },
      });
      if (!created) return;
      const group = created.coreCreateEquipmentGroup;
      announce(`Equipment group ${group.code} created`);
      await navigate({
        to: coreLinks.settings.equipmentGroups.group({ plant, groupId: group.id }).href,
        replace: true,
      });
    } catch (error) {
      showRegisterSaveError(form, error, values, {
        forbidden:
          scope === 'company'
            ? 'You do not have permission to create company equipment groups. They belong to the company, so it needs the permission there.'
            : 'You do not have permission to create equipment groups at this plant.',
      });
    }
  };

  let state: PageState = { status: 'ready' };
  if (viewer.error !== undefined) {
    state = {
      status: 'error',
      title: 'Could not open New equipment group',
      error: viewer.error,
      onRetry: viewer.retry,
    };
  } else if (!viewer.loaded) {
    state = { status: 'loading' };
  } else if (scopes.length === 0) {
    state = createGroupForbiddenState(plantName);
  }
  return (
    <PageFrame
      title="New equipment group"
      crumbs={[{ label: 'Equipment groups', href: groups }]}
      state={state}
    >
      {state.status === 'ready' && (
        <EquipmentGroupForm
          form={form}
          onSave={save}
          cancelHref={groups}
          groups={data?.coreEquipmentGroups.edges.map(({ node }) => node) ?? []}
          groupsComplete={groupsComplete}
          scopes={scopes}
          machines={[]}
        />
      )}
    </PageFrame>
  );
}
