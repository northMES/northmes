// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery } from '@apollo/client/react';
import { coreLinks, updateRole } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { v7 as uuidv7 } from 'uuid';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { useZodForm } from '../../../../ui/lib/use-zod-form.ts';
import { Field, FieldDescription, FieldLabel } from '../../../../ui/primitives/field.tsx';
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '../../../../ui/primitives/native-select.tsx';
import { newRoleSearch } from '../../access-search.ts';
import { RoleForm, type RoleValues, showRoleSaveError } from '../../components/role-form/index.ts';
import { noAccessState } from '../../no-access.tsx';
import { CoreRole } from '../../role.graphql.ts';
import { listRole } from '../../role-cache.ts';
import { CoreRoles, type CoreRolesQuery } from '../../roles.graphql.ts';
import { usePlaces } from '../../use-places.ts';
import { useViewer } from '../../use-viewer.ts';
import { CoreCreateRole } from './create-role.graphql.ts';

/** A role of the company that a new role can start from. */
type StartRole = CoreRolesQuery['coreRoles'][number];

/** The id of the Start from select. */
const startFromId = 'new-role-start-from';

interface StartFromProps {
  readonly roles: readonly StartRole[];
  readonly value: string;
  readonly onChange: (roleId: string) => void;
}

/**
 * Start from (design core-304, RO11 and RO13): No role, the default, then the custom roles and
 * the default roles of the company. Choosing a role copies its permissions once.
 */
function StartFrom({ roles, value, onChange }: StartFromProps) {
  const chosen = roles.find(({ id }) => id === value);
  return (
    <Field className="max-w-120">
      <FieldLabel htmlFor={startFromId} className="block text-xs font-semibold text-foreground">
        Start from
      </FieldLabel>
      <NativeSelect
        id={startFromId}
        className="w-full"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={`${startFromId}-hint`}
      >
        <NativeSelectOption value="">No role</NativeSelectOption>
        <NativeSelectOptGroup label="Custom roles">
          {roles
            .filter(({ origin }) => origin === 'CUSTOM')
            .map((role) => (
              <NativeSelectOption key={role.id} value={role.id}>
                {role.name}
              </NativeSelectOption>
            ))}
        </NativeSelectOptGroup>
        <NativeSelectOptGroup label="Default roles">
          {roles
            .filter(({ origin }) => origin === 'MODULE')
            .map((role) => (
              <NativeSelectOption key={role.id} value={role.id}>
                {role.name}
              </NativeSelectOption>
            ))}
        </NativeSelectOptGroup>
      </NativeSelect>
      <FieldDescription id={`${startFromId}-hint`} className="text-xs">
        {chosen === undefined
          ? 'The new role starts with no permission.'
          : `The new role copies its permissions once. It does not follow later changes to ${chosen.name}.`}
      </FieldDescription>
    </Field>
  );
}

/** The form of New role, once the roles to start from have loaded. */
function NewRoleForm({
  roles,
  from,
}: {
  readonly roles: readonly StartRole[];
  readonly from?: string;
}) {
  const { plant } = useShell();
  const navigate = useNavigate();
  const places = usePlaces();
  const [id] = useState(() => uuidv7());
  const [startId, setStartId] = useState(() =>
    roles.some((role) => role.id === from) ? (from ?? '') : '',
  );
  const [refused, setRefused] = useState<readonly string[]>([]);
  const start = roles.find((role) => role.id === startId);
  const form = useZodForm(updateRole.fields, {
    defaultValues: { name: '', permissions: [...(start?.permissions ?? [])], reason: undefined },
  });
  const companyName = places.company?.name ?? 'the company';
  const [create] = useMutation(CoreCreateRole, {
    // The role's page reads the new role from the cache, and the roles list, Start from and Add
    // role list it.
    update(cache, { data }) {
      if (!data) return;
      const role = data.coreCreateRole;
      cache.writeQuery({ query: CoreRole, variables: { id: role.id }, data: { coreRole: role } });
      listRole(cache, role.id);
    },
  });

  const save = async ({ name, permissions }: RoleValues) => {
    setRefused([]);
    try {
      const { data } = await create({ variables: { input: { id, name, permissions } } });
      if (!data) return;
      announce(`${data.coreCreateRole.name} created.`);
      await navigate({
        to: coreLinks.roles.role({ plant, roleId: data.coreCreateRole.id }).href,
        replace: true,
      });
    } catch (error) {
      setRefused(
        showRoleSaveError(form, error, { name, permissions }, { companyName, roleName: name }),
      );
    }
  };

  return (
    <RoleForm
      form={form}
      onSave={save}
      cancelHref={coreLinks.roles({ plant }).href}
      saveLabel="Create role"
      failedHeading="The role was not created"
      companyName={companyName}
      refused={refused}
      baseline={
        start === undefined ? undefined : { name: start.name, permissions: start.permissions }
      }
      startFrom={
        <StartFrom
          roles={roles}
          value={startId}
          onChange={(roleId) => {
            setStartId(roleId);
            const role = roles.find(({ id: each }) => each === roleId);
            // The role's permissions are copied once, as the hint says.
            form.setValue('permissions', [...(role?.permissions ?? [])], { shouldDirty: true });
          }}
        />
      }
    />
  );
}

/**
 * New role (design core-304, RO11 to RO16): Role name, Start from (No role, or a role whose
 * permissions it copies once, also from the URL's from), the permission checklist with the
 * difference from that role, and Create role. A created role's page replaces the form in the
 * history, and the polite region says "Night planner created.". A reader without
 * core.role:manage gets the page "No access to New role" (RO31).
 */
export function NewRoleScreen() {
  const { plant } = useShell();
  const places = usePlaces();
  const viewer = useViewer();
  const search = newRoleSearch(useSearch({ strict: false }));
  const { data, error, refetch } = useQuery(CoreRoles);
  const roles = data?.coreRoles;
  // The API checks core.role:manage at the company (ADR 0010).
  const forbidden = viewer.loaded && !viewer.canAtCompany('core.role:manage');
  const companyName = places.company?.name ?? 'the company';
  let state: PageState = { status: 'ready' };
  if (forbidden) {
    state = noAccessState(
      'New role',
      'core.role:manage',
      companyName,
      `a company admin of ${companyName}`,
    );
  } else if (roles === undefined && error !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load the roles to start from',
      description: 'Check the connection, then try again.',
      onRetry: () => {
        refetch().catch(() => {});
      },
    };
  } else if (roles === undefined || !viewer.loaded) {
    state = { status: 'loading' };
  }
  return (
    <PageFrame
      title={forbidden ? 'No access to New role' : 'New role'}
      crumbs={[{ label: 'Roles', href: coreLinks.roles({ plant }).href }]}
      state={state}
    >
      {roles !== undefined && viewer.loaded && !forbidden && (
        <NewRoleForm roles={roles} from={search.from} />
      )}
    </PageFrame>
  );
}
