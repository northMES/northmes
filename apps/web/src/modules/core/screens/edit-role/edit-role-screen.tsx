// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from '@apollo/client/react';
import { coreLinks, updateRole } from '@northmes/core-contracts';
import { useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { hasErrorCode } from '../../../../ui/lib/graphql-errors.ts';
import { useZodForm } from '../../../../ui/lib/use-zod-form.ts';
import { RoleForm, type RoleValues, showRoleSaveError } from '../../components/role-form/index.ts';
import { noAccessState } from '../../no-access.tsx';
import { useCompanyId, usePlaces } from '../../use-places.ts';
import { type Role, useRole } from '../../use-role.tsx';
import { useViewer } from '../../use-viewer.ts';
import { CoreUpdateRole } from './update-role.graphql.ts';

/** "It applies to 2 people from their next action." for the people who hold the role here. */
function appliesTo(count: number): string {
  if (count === 0) return 'Nobody holds it here.';
  return `It applies to ${count} ${count === 1 ? 'person' : 'people'} from their next action.`;
}

/** The places where the role is assigned, each once, the company first. */
function assignedPlaces(role: Role): { readonly id: string; readonly name: string }[] {
  const scopes = new Map(role.holders.map(({ scope }) => [scope.id, scope]));
  return [...scopes.values()]
    .sort((a, b) => Number(a.kind === 'PLANT') - Number(b.kind === 'PLANT'))
    .map(({ id, name }) => ({ id, name }));
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
  const [refused, setRefused] = useState<readonly string[]>([]);
  const form = useZodForm(updateRole.fields, {
    defaultValues: { name: role.name, permissions: [...role.permissions], reason: '' },
  });
  const [update] = useMutation(CoreUpdateRole);
  const companyName = places.company?.name ?? 'the company';

  const save = async ({ name, permissions, reason }: RoleValues) => {
    setConflict(false);
    setRefused([]);
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
      announce(`${saved.name} saved. ${appliesTo(saved.holders.length)}`);
      await navigate({
        to: coreLinks.settings.roles.role({ companyId, roleId: role.id }).href,
        replace: true,
      });
    } catch (error) {
      if (hasErrorCode(error, 'core.version_conflict')) {
        setConflict(true);
        return;
      }
      setRefused(
        showRoleSaveError(
          form,
          error,
          { name, permissions, reason },
          { companyName, roleName: role.name },
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
      refused={refused}
      current={role.permissions}
      assigned={{ roleName: role.name, places: assignedPlaces(role) }}
      withReason
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
