// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery } from '@apollo/client/react';
import { coreLinks, updateRole } from '@northmes/core-contracts';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { v7 as uuidv7 } from 'uuid';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { useZodForm } from '../../../../ui/lib/use-zod-form.ts';
import { Field, FieldDescription, FieldLabel } from '../../../../ui/primitives/field.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/primitives/select.tsx';
import { permissionCount } from '../../access-refusal.ts';
import { newRoleSearch } from '../../access-search.ts';
import { RoleForm, type RoleValues, showRoleSaveError } from '../../components/role-form/index.ts';
import { noAccessState } from '../../no-access.tsx';
import { CoreRole } from '../../role.graphql.ts';
import { listRole } from '../../role-cache.ts';
import { isCompanyAdmin, roleKind } from '../../role-kind.ts';
import { CoreRoles, type CoreRolesQuery } from '../../roles.graphql.ts';
import { useCompanyId, usePlaces } from '../../use-places.ts';
import { useViewer } from '../../use-viewer.ts';
import { CoreCreateRole } from './create-role.graphql.ts';

/** A role of the company that a new role can start from. */
type StartRole = CoreRolesQuery['coreRoles'][number];

/** The id of the Start from select. */
const startFromId = 'new-role-start-from';

/** The value of No role in Start from. */
const noRole = 'none';

interface StartFromProps {
  readonly roles: readonly StartRole[];
  readonly value: string;
  readonly onChange: (roleId: string) => void;
}

/** "Custom role. 5 permissions." or "Planning, default role. 8 permissions.": a role's option line. */
function optionLine(role: StartRole): string {
  return `${roleKind(role)}. ${permissionCount(role.permissions.length)}.`;
}

/**
 * Start from (design core-304, RO11 and RO13): a Select with No role, the default, then the
 * custom roles and the default roles of the company, each with its kind and permission count.
 * Choosing a role copies its permissions once. Company admin is left out while question 34 of the
 * design is open.
 */
function StartFrom({ roles, value, onChange }: StartFromProps) {
  const offered = [
    ...roles.filter(({ origin }) => origin === 'CUSTOM'),
    ...roles.filter((role) => role.origin === 'MODULE' && !isCompanyAdmin(role)),
  ];
  const chosen = offered.find(({ id }) => id === value);
  return (
    <Field className="min-w-0">
      <FieldLabel htmlFor={startFromId} className="block text-xs font-semibold text-foreground">
        Start from
      </FieldLabel>
      <Select
        value={value === '' ? noRole : value}
        onValueChange={(next) => onChange(next === noRole || next === null ? '' : String(next))}
        items={[
          { value: noRole, label: 'No role' },
          ...offered.map(({ id, name }) => ({ value: id, label: name })),
        ]}
      >
        <SelectTrigger id={startFromId} className="w-full" aria-describedby={`${startFromId}-hint`}>
          <SelectValue>
            {chosen === undefined ? (
              'No role'
            ) : (
              <>
                {chosen.name}
                <span className="text-muted-foreground">{roleKind(chosen)}</span>
              </>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start">
          <SelectItem value={noRole}>No role</SelectItem>
          {offered.map((role) => (
            <SelectItem key={role.id} value={role.id}>
              <span className="flex flex-col">
                <span>{role.name}</span>
                <span className="text-xs text-muted-foreground">{optionLine(role)}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription id={`${startFromId}-hint`} className="text-xs">
        {chosen === undefined
          ? 'The new role starts with no permissions. Tick the ones it needs below.'
          : `The new role copies its permissions once. It does not follow later changes to ${chosen.name}.`}
      </FieldDescription>
    </Field>
  );
}

/** Who holds the new role (RO13): nobody yet, with where it is given once created. */
function WhoHolds({ name }: { readonly name: string }) {
  return (
    <FormSection title={name.trim() === '' ? 'Who holds the new role' : `Who holds ${name.trim()}`}>
      <p className="text-sm">
        Nobody yet. After you create the role, add it to people on their Access tab.
      </p>
    </FormSection>
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
  const companyId = useCompanyId() ?? '';
  const navigate = useNavigate();
  const places = usePlaces();
  const [id] = useState(() => uuidv7());
  const [startId, setStartId] = useState(() =>
    roles.some((role) => role.id === from && !isCompanyAdmin(role)) ? (from ?? '') : '',
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
      cache.writeQuery({
        query: CoreRole,
        variables: { id: role.id, companyId },
        data: { coreRole: role },
      });
      listRole(cache, role.id);
    },
  });

  const save = async ({ name, permissions, reason }: RoleValues) => {
    setRefused([]);
    try {
      const { data } = await create({
        variables: {
          input: {
            id,
            name,
            permissions,
            companyId,
            ...(reason !== undefined && reason !== '' && { reason }),
          },
        },
      });
      if (!data) return;
      announce(`${data.coreCreateRole.name} created.`);
      await navigate({
        to: coreLinks.settings.roles.role({ companyId, roleId: data.coreCreateRole.id }).href,
        replace: true,
      });
    } catch (error) {
      setRefused(
        showRoleSaveError(
          form,
          error,
          { name, permissions, reason },
          { companyName, roleName: name },
        ),
      );
    }
  };

  return (
    <RoleForm
      form={form}
      onSave={save}
      cancelHref={coreLinks.settings.roles({ companyId }).href}
      saveLabel="Create role"
      failedHeading="The role was not created"
      companyName={companyName}
      reason={{ label: 'Reason', placeholder: 'Why you create this role' }}
      side={<WhoHolds name={form.watch('name') ?? ''} />}
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
  const companyId = useCompanyId() ?? '';
  const places = usePlaces();
  const viewer = useViewer();
  const search = newRoleSearch(useSearch({ strict: false }));
  const { data, error, refetch } = useQuery(CoreRoles, { variables: { companyId } });
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
      error,
      onRetry: () => refetch(),
    };
  } else if (roles === undefined || !viewer.loaded) {
    state = { status: 'loading' };
  }
  return (
    <PageFrame
      title={forbidden ? 'No access to New role' : 'New role'}
      crumbs={[{ label: 'Roles', href: coreLinks.settings.roles({ companyId }).href }]}
      state={state}
    >
      {roles !== undefined && viewer.loaded && !forbidden && (
        <NewRoleForm roles={roles} from={search.from} />
      )}
    </PageFrame>
  );
}
