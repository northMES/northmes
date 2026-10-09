// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from '@apollo/client/react';
import { coreLinks, updateRole } from '@northmes/core-contracts';
import { useNavigate } from '@tanstack/react-router';
import { Minus, Plus, User } from 'lucide-react';
import { useRef, useState } from 'react';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { hasErrorCode } from '../../../../ui/lib/graphql-errors.ts';
import { useZodForm } from '../../../../ui/lib/use-zod-form.ts';
import { listOf } from '../../access-refusal.ts';
import {
  RoleForm,
  type RoleRefusal,
  type RoleValues,
  showRoleSaveError,
} from '../../components/role-form/index.ts';
import { noAccessState } from '../../no-access.tsx';
import { permissionLine } from '../../permission-names.ts';
import { roleSavedMessage, roleSavedState } from '../../role-saved.ts';
import { useCompanyId, usePlaces } from '../../use-places.ts';
import { type Role, useRole } from '../../use-role.tsx';
import { useViewer } from '../../use-viewer.ts';
import { CoreUpdateRole } from './update-role.graphql.ts';

/** The places where the role is assigned, each once, the company first. */
function assignedPlaces(role: Role): { readonly id: string; readonly name: string }[] {
  const scopes = new Map(role.holders.map(({ scope }) => [scope.id, scope]));
  return [...scopes.values()]
    .sort((a, b) => Number(a.kind === 'PLANT') - Number(b.kind === 'PLANT'))
    .map(({ id, name }) => ({ id, name }));
}

/**
 * Where Shift lead applies (RO17): to whom the role is assigned and where, and that a saved change
 * applies to them from their next action, each holder with the place under the name.
 */
function WhereApplies({ role }: { readonly role: Role }) {
  const people = new Set(role.holders.map(({ user }) => user.id)).size;
  const places = listOf(assignedPlaces(role).map(({ name }) => name));
  return (
    <FormSection title={`Where ${role.name} applies`}>
      {people === 0 ? (
        <p className="text-sm">Nobody holds {role.name} yet.</p>
      ) : (
        <>
          <p className="text-sm">
            Assigned to {people} {people === 1 ? 'person' : 'people'} at {places}. A saved change
            applies to them from their next action.
          </p>
          <ul className="flex flex-col gap-2">
            {role.holders.map(({ id, user, scope }) => (
              <li key={id} className="flex items-start gap-2 text-sm">
                <User aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="flex flex-col">
                  <span>{user.name}</span>
                  <span className="text-xs text-muted-foreground">{scope.name}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </FormSection>
  );
}

/**
 * Changes not saved (RO17, NO15): what the ticks add to and remove from the saved role, each as
 * "Added: Run autoplan" with its id. It shows while the permissions differ from the saved ones.
 */
function ChangesNotSaved({
  saved,
  value,
}: {
  readonly saved: readonly string[];
  readonly value: readonly string[];
}) {
  const added = value.filter((key) => !saved.includes(key));
  const removed = saved.filter((key) => !value.includes(key));
  if (added.length === 0 && removed.length === 0) return null;
  const line = (change: 'Added' | 'Removed', key: string) => (
    <li key={`${change}-${key}`} className="flex items-start gap-2 text-sm">
      {change === 'Added' ? (
        <Plus aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
      ) : (
        <Minus aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
      )}
      <span className="flex flex-col">
        <span>
          {change}: {permissionLine(key)}
        </span>
        <span className="font-mono text-xs break-all text-muted-foreground">{key}</span>
      </span>
    </li>
  );
  return (
    <FormSection title="Changes not saved">
      <ul className="flex flex-col gap-2">
        {added.map((key) => line('Added', key))}
        {removed.map((key) => line('Removed', key))}
      </ul>
    </FormSection>
  );
}

interface EditRoleFormProps {
  readonly role: Role;
  readonly reload: () => Promise<Role | undefined>;
}

/**
 * The form of a custom role as it was when the page opened. Save sends the version the form was
 * filled from, so a change someone saved in between is refused with core.version_conflict, not
 * overwritten (ADR 0017).
 */
function EditRoleForm({ role, reload }: EditRoleFormProps) {
  const companyId = useCompanyId() ?? '';
  const navigate = useNavigate();
  const places = usePlaces();
  const expectedVersion = useRef(role.version);
  const [conflict, setConflict] = useState(false);
  const [refusal, setRefusal] = useState<RoleRefusal | undefined>(undefined);
  const form = useZodForm(updateRole.fields, {
    defaultValues: { name: role.name, permissions: [...role.permissions], reason: '' },
  });
  const [update] = useMutation(CoreUpdateRole);
  const companyName = places.company?.name ?? 'the company';
  const permissions = form.watch('permissions') ?? [];
  const permissionsChanged =
    permissions.length !== role.permissions.length ||
    permissions.some((key) => !role.permissions.includes(key));

  const save = async ({ name, permissions, reason }: RoleValues) => {
    setConflict(false);
    setRefusal(undefined);
    try {
      const { data } = await update({
        variables: {
          input: {
            id: role.id,
            expectedVersion: expectedVersion.current,
            name,
            permissions,
            ...(reason !== undefined && reason !== '' && { reason }),
          },
        },
      });
      if (!data) return;
      const saved = data.coreUpdateRole;
      const message = roleSavedMessage(saved.name, saved.holders);
      announce(message);
      await navigate({
        to: coreLinks.settings.roles.role({ companyId, roleId: role.id }).href,
        replace: true,
        state: roleSavedState(message),
      });
    } catch (error) {
      if (hasErrorCode(error, 'core.version_conflict')) {
        setConflict(true);
        return;
      }
      setRefusal(
        showRoleSaveError(
          form,
          error,
          { name, permissions, reason },
          {
            companyName,
            roleName: role.name,
            placeName: (scopeId) =>
              [places.company, ...places.plants].find((place) => place?.id === scopeId)?.name,
          },
        ),
      );
    }
  };

  // Reload role: the saved name and permissions and their version replace the typed ones, and
  // focus moves to Role name, where the change starts again.
  const onReload = async () => {
    let saved: Role | undefined;
    try {
      saved = await reload();
    } catch {
      form.setError('root.server', {
        message: 'Could not reload the role. Check the connection, then try again.',
      });
      return;
    }
    if (saved === undefined) return;
    form.reset({ name: saved.name, permissions: [...saved.permissions], reason: '' });
    expectedVersion.current = saved.version;
    setConflict(false);
    document.getElementById(fieldId('name'))?.focus();
  };

  return (
    <RoleForm
      form={form}
      onSave={save}
      cancelHref={coreLinks.settings.roles.role({ companyId, roleId: role.id }).href}
      saveLabel="Save role"
      failedHeading={`${role.name} was not saved`}
      companyName={companyName}
      conflict={conflict ? { onReload } : undefined}
      refusal={refusal}
      current={role.permissions}
      saved={role.permissions}
      assigned={{ roleName: role.name, places: assignedPlaces(role) }}
      reason={{ label: 'Reason for change', placeholder: 'Why you change this role' }}
      side={
        <>
          <WhereApplies role={role} />
          <ChangesNotSaved saved={role.permissions} value={permissions} />
        </>
      }
      dirtyLine={!permissionsChanged}
    />
  );
}

/**
 * Edit role (design core-304, RO17 to RO20, RO39 and RO41): the role form filled in with the
 * custom role, with the reason of the change. A saved change opens the role's page in place of
 * the form, and the polite region says "Shift lead saved. It applies to 2 people from their next
 * action."; a refused save keeps every tick, the name and the reason, and its summary says why. A
 * default role cannot be edited, and a reader without core.role:manage gets the page "No access
 * to Edit role" (RO31).
 */
export function EditRoleScreen() {
  const companyId = useCompanyId() ?? '';
  const places = usePlaces();
  const viewer = useViewer();
  const { role, state: loaded, reload } = useRole();
  // The API checks core.role:manage at the role's company (ADR 0010).
  const forbidden = viewer.loaded && !viewer.canAtCompany('core.role:manage');
  const companyName = places.company?.name ?? 'the company';
  let state: PageState = loaded;
  if (forbidden) {
    state = noAccessState(
      'Edit role',
      'core.role:manage',
      companyName,
      `a company admin of ${companyName}`,
    );
  } else if (loaded.status === 'ready' && !viewer.loaded) {
    state = { status: 'loading' };
  } else if (role?.origin === 'MODULE') {
    state = {
      status: 'empty',
      title: `${role.name} cannot be edited`,
      description:
        'Default roles come from their module and cannot be changed. To change one, make a new role from it.',
    };
  }
  const roles = { label: 'Roles', href: coreLinks.settings.roles({ companyId }).href };
  return (
    <PageFrame
      title={
        forbidden
          ? 'No access to Edit role'
          : role === undefined
            ? 'Edit role'
            : `Edit ${role.name}`
      }
      meta={
        role?.origin === 'CUSTOM' && !forbidden ? (
          <span>Custom role, {companyName}</span>
        ) : undefined
      }
      crumbs={
        role === undefined
          ? [roles]
          : [
              roles,
              {
                label: role.name,
                href: coreLinks.settings.roles.role({ companyId, roleId: role.id }).href,
              },
            ]
      }
      state={state}
    >
      {role !== undefined && state.status === 'ready' && (
        <EditRoleForm key={role.id} role={role} reload={reload} />
      )}
    </PageFrame>
  );
}
