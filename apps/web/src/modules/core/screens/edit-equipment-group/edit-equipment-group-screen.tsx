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
  EquipmentGroupForm,
  type EquipmentGroupValues,
  equipmentGroupFormFields,
} from '../../components/equipment-group-form/index.ts';
import { CoreEquipmentGroup, type EquipmentGroup } from '../../equipment-group.graphql.ts';
import { machinesOf } from '../../equipment-group-facts.ts';
import {
  canChangeGroup,
  equipmentGroupPageState,
  isGroupId,
} from '../../equipment-group-states.tsx';
import { showRegisterSaveError } from '../../master-data/register-save-error.ts';
import type { PlantMachine } from '../../plant-settings-data.ts';
import { usePlantSettings } from '../../plant-settings-source-context.ts';
import { useEquipmentGroups } from '../../use-equipment-groups.ts';
import { usePlaces } from '../../use-places.ts';
import { useViewer } from '../../use-viewer.ts';
import { CoreUpdateEquipmentGroup } from './update-equipment-group.graphql.ts';

/** The form's values as the group holds them. */
function valuesOf(group: EquipmentGroup): EquipmentGroupValues {
  return {
    code: group.code,
    name: group.name,
    color: group.color as EquipmentGroupValues['color'],
  };
}

interface GroupFormProps {
  readonly group: EquipmentGroup;
  readonly machines: readonly PlantMachine[];
  readonly companyName: string;
}

/**
 * The group's form as it was when the page opened. Save sends the name and the color with the
 * version the form was filled from as expectedVersion, so a change someone saved in between is
 * refused with core.version_conflict, not overwritten. Reload reads the saved group outside the
 * page's query, so a failed reload keeps the form and its entries. A saved change returns to the
 * group's page.
 */
function GroupForm({ group, machines, companyName }: GroupFormProps) {
  const client = useApolloClient();
  const { plant } = useShell();
  const navigate = useNavigate();
  const viewer = useViewer();
  const { data } = useEquipmentGroups(false);
  const expectedVersion = useRef(group.version);
  const [conflict, setConflict] = useState(false);
  const form = useZodForm(equipmentGroupFormFields, { defaultValues: valuesOf(group) });
  const [update] = useMutation(CoreUpdateEquipmentGroup);
  const groupPage = coreLinks.settings.equipmentGroups.group({ plant, groupId: group.id }).href;
  const company = group.scope === 'company';

  const save = async (values: EquipmentGroupValues) => {
    setConflict(false);
    const { code, name, color } = values;
    try {
      const { data: saved } = await update({
        variables: {
          input: {
            id: group.id,
            expectedVersion: expectedVersion.current,
            code,
            name,
            ...(color !== undefined && { color }),
          },
        },
      });
      if (!saved) return;
      announce(`Equipment group ${saved.coreUpdateEquipmentGroup.code} saved`);
      await navigate({ to: groupPage, replace: true });
    } catch (error) {
      if (hasErrorCode(error, 'core.version_conflict')) {
        setConflict(true);
        return;
      }
      showRegisterSaveError(form, error, values, {
        forbidden: company
          ? 'You do not have permission to change company equipment groups. They belong to the company, so the change needs the permission there.'
          : 'You do not have permission to change equipment groups at this plant.',
      });
    }
  };

  const onReload = async () => {
    const saved = await client
      .query({
        query: CoreEquipmentGroup,
        variables: { id: group.id },
        fetchPolicy: 'network-only',
      })
      .then(({ data: answer }) => answer?.coreEquipmentGroup ?? undefined)
      .catch(() => undefined);
    if (saved === undefined) {
      form.setError('root.server', {
        type: 'server',
        message: 'Could not reload the equipment group. Your entries are kept. Try again.',
      });
      return;
    }
    form.reset(valuesOf(saved));
    expectedVersion.current = saved.version;
    setConflict(false);
    document.getElementById(fieldId('name'))?.focus();
  };

  const archived = group.archivedAt !== null;
  const allowed = canChangeGroup(viewer, group, 'update');
  const notes = [
    ...(company
      ? [
          `${group.code} is a company group: a change here applies at every plant of ${companyName}.`,
        ]
      : []),
    ...(archived ? [`${group.code} is archived. Restore it on its page to change it.`] : []),
    ...(!archived && !allowed
      ? [
          company
            ? 'You may read this group but not change it: a change to a company group needs the permission at the company.'
            : 'You may read this group but not change it.',
        ]
      : []),
  ];
  return (
    <EquipmentGroupForm
      form={form}
      onSave={save}
      cancelHref={groupPage}
      groups={data?.coreEquipmentGroups.edges.map(({ node }) => node) ?? []}
      groupId={group.id}
      notes={notes}
      machines={machines}
      storedName={group.name}
      conflict={conflict ? { onReload } : undefined}
      editable={!archived && allowed}
    />
  );
}

/** The form's skeleton while the group loads: two sections of field placeholders. */
function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {['group', 'preview'].map((section) => (
        <div
          key={section}
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
        >
          <Skeleton aria-hidden className="h-4 w-32 rounded-sm bg-accent" />
          <div className="grid gap-4 sm:grid-cols-2">
            {(section === 'group' ? ['code', 'name'] : ['band']).map((field) => (
              <div key={field} className="flex flex-col gap-2">
                <Skeleton aria-hidden className="h-3 w-20 rounded-sm bg-accent" />
                <Skeleton aria-hidden className="h-9 w-full rounded-md bg-accent" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-sm text-muted-foreground">Loading the equipment group.</p>
    </div>
  );
}

/**
 * The edit form of an equipment group in plant settings (design #729, EG5): the code, which stays,
 * the name, the 20 palette colors with the other groups that use each, and the band it draws on
 * the board in the name and color entered. Save equipment group shows to a user who may change the
 * group where it sits; to anyone else, and on an archived group, the form is read-only. An id the
 * plant does not see shows the not-found state.
 */
export function EditEquipmentGroupScreen() {
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
  const groupPage = coreLinks.settings.equipmentGroups.group({ plant, groupId }).href;
  const state = equipmentGroupPageState({
    plant,
    plantName: places.plant?.name ?? 'the plant',
    group,
    restLoaded: snapshot !== undefined && viewer.loaded,
    error: error ?? viewer.error,
    retry: () =>
      Promise.all([
        error === undefined ? undefined : refetch(),
        viewer.error === undefined ? undefined : viewer.retry(),
      ]),
  });
  const title = group ? `Equipment group ${group.code}` : 'Equipment group';
  return (
    <PageFrame
      title={`Edit ${title.charAt(0).toLowerCase()}${title.slice(1)}`}
      crumbs={[
        { label: 'Equipment groups', href: coreLinks.settings.equipmentGroups({ plant }).href },
        { label: title, href: groupPage },
      ]}
      currentCrumb="Edit"
      meta={group ? <span className="text-sm text-muted-foreground">{group.name}</span> : undefined}
      state={state}
    >
      {state.status === 'loading' && <FormSkeleton />}
      {state.status === 'ready' && group && snapshot !== undefined && (
        // A reloaded or another group gets a fresh form, so its entries never carry over.
        <GroupForm
          key={group.id}
          group={group}
          machines={machinesOf(snapshot, group.code)}
          companyName={places.company?.name ?? 'the company'}
        />
      )}
    </PageFrame>
  );
}
