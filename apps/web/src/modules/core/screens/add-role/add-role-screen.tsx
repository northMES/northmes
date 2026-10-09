// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { useNavigate } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { Controller } from 'react-hook-form';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import { ErrorSummary } from '../../../../ui/components/error-summary/index.ts';
import { FormActions } from '../../../../ui/components/form-actions/index.ts';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { UnsavedChangesGuard } from '../../../../ui/components/unsaved-changes-guard/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { hasErrorCode } from '../../../../ui/lib/graphql-errors.ts';
import { summaryErrors, useZodForm } from '../../../../ui/lib/use-zod-form.ts';
import { Label } from '../../../../ui/primitives/label.tsx';
import { RadioGroup, RadioGroupItem } from '../../../../ui/primitives/radio-group.tsx';
import {
  listOf,
  missingPermissionsOf,
  permissionCount,
  permissionList,
} from '../../access-refusal.ts';
import { noAccessState } from '../../no-access.tsx';
import { permissionLine, permissionWithId } from '../../permission-names.ts';
import { addHolder } from '../../role-cache.ts';
import { roleKind } from '../../role-kind.ts';
import { CoreRoles, type CoreRolesQuery } from '../../roles.graphql.ts';
import { type Place, usePlaces } from '../../use-places.ts';
import { type User, useUser } from '../../use-user.tsx';
import { useViewer, type Viewer } from '../../use-viewer.ts';
import { CoreUser } from '../../user.graphql.ts';
import { CoreAssignRole } from './assign-role.graphql.ts';

/** A role of the company, as the picker lists it. */
type PickRole = CoreRolesQuery['coreRoles'][number];

/** The fields of Add role: where the role applies, and the role. */
const addRoleFields = z.object({
  where: z.enum(['plant', 'company']),
  roleId: z.string().min(1, 'Choose a role.'),
});

type AddRoleValues = z.output<typeof addRoleFields>;

/** The id of a role's radio, which a summary link to Role may lead to. */
function radioIdOf(roleId: string): string {
  return `add-role-${roleId}`;
}

/** How a role of the picker reads at the place: its line, and whether it can be added there. */
interface RoleOption {
  /**
   * The line under the role's name (AS3): "Custom role. 9 permissions.", or what keeps it from
   * being added, such as "Custom role. Needs 3 permissions you do not hold at Plant A: ...".
   */
  readonly line: string;
  /** The role cannot be added at the place: the user holds it there, or it needs permissions. */
  readonly locked: boolean;
  /** The role needs permissions the assigner does not hold at the place. */
  readonly needsPermissions: boolean;
}

/** The role as the picker lists it at the place, for the user and the assigner. */
function optionOf(
  role: PickRole,
  user: User,
  where: AddRoleValues['where'],
  place: Place,
  viewer: Viewer,
): RoleOption {
  const kind = where === 'company' ? 'COMPANY' : 'PLANT';
  const held = user.roleAssignments.some(
    (each) => each.role?.id === role.id && each.scope.kind === kind,
  );
  const holds = where === 'company' ? viewer.canAtCompany : viewer.can;
  const missing = role.permissions.filter((key) => !holds(key));
  const parts = [`${roleKind(role)}.`];
  if (held) parts.push(`${user.name} already holds it at ${place.name}.`);
  if (missing.length > 0) {
    const named = missing.slice(0, 3).map(permissionWithId);
    const more = missing.length > 3 ? `, and ${missing.length - 3} more` : '';
    parts.push(
      `Needs ${permissionCount(missing.length)} you do not hold at ${place.name}: ${listOf(named)}${more}.`,
    );
  }
  if (!held && missing.length === 0) parts.push(`${permissionCount(role.permissions.length)}.`);
  return {
    line: parts.join(' '),
    locked: held || missing.length > 0,
    needsPermissions: missing.length > 0,
  };
}

interface RolePickerProps {
  readonly roles: readonly PickRole[];
  readonly value: string;
  readonly onChange: (roleId: string) => void;
  readonly optionOf: (role: PickRole) => RoleOption;
  readonly error?: string;
  readonly placeName: string;
}

/**
 * Role (design core-304, AS3): one radio group in two groups, the roles the assigner can give at
 * the place and the roles that need permissions the assigner does not hold there, each with the
 * custom roles first and then the default roles, by name. A role that cannot be added stays in
 * the list, disabled, with what keeps it. One Tab stop; the arrow keys choose.
 */
function RolePicker({ roles, value, onChange, optionOf, error, placeName }: RolePickerProps) {
  const labelId = useId();
  const hintId = useId();
  const errorId = useId();
  const options = roles.map((role) => ({ role, option: optionOf(role) }));
  const group = (title: string, needsPermissions: boolean) => {
    const listed = options.filter(({ option }) => option.needsPermissions === needsPermissions);
    if (listed.length === 0) return null;
    return (
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs font-semibold text-muted-foreground">{title}</legend>
        {listed.map(({ role, option }) => {
          const lineId = `${radioIdOf(role.id)}-line`;
          return (
            <div key={role.id} className="flex min-h-9 items-start gap-3 py-1 text-sm">
              <RadioGroupItem
                id={radioIdOf(role.id)}
                value={role.id}
                disabled={option.locked}
                aria-describedby={lineId}
                aria-invalid={error !== undefined || undefined}
                className="mt-0.5"
              />
              <span className="flex flex-col">
                <Label htmlFor={radioIdOf(role.id)} className="font-normal">
                  {role.name}
                </Label>
                <span id={lineId} className="text-xs text-muted-foreground">
                  {option.line}
                </span>
              </span>
            </div>
          );
        })}
      </fieldset>
    );
  };
  return (
    <div className="flex flex-col gap-2">
      <p id={labelId} className="text-xs font-semibold">
        Role
      </p>
      <p id={hintId} className="text-xs text-muted-foreground">
        Roles that need permissions you do not hold at {placeName} stay in the list, with what they
        need.
      </p>
      <RadioGroup
        aria-labelledby={labelId}
        aria-describedby={[error === undefined ? '' : errorId, hintId].join(' ').trim()}
        value={value}
        onValueChange={(next) => onChange(String(next))}
        className="flex flex-col gap-3"
      >
        {group(`You can assign these at ${placeName}`, false)}
        {group(`Needs permissions you do not hold at ${placeName}`, true)}
      </RadioGroup>
      {error !== undefined && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** The permissions of the chosen role and whether the assigner holds each at the place (AS3). */
function ChosenRole({
  role,
  holds,
  placeName,
}: {
  readonly role: PickRole;
  readonly holds: (key: string) => boolean;
  readonly placeName: string;
}) {
  return (
    <FormSection title={`Permissions of ${role.name}`}>
      <ul className="flex flex-col gap-1 text-sm">
        {role.permissions.map((key) => (
          <li key={key} className="flex flex-wrap gap-x-3">
            <span>{permissionLine(key)}</span>
            <span className="font-mono text-xs text-muted-foreground">{key}</span>
            <span className="text-xs text-muted-foreground">
              {holds(key) ? `You hold it at ${placeName}.` : `You do not hold it at ${placeName}.`}
            </span>
          </li>
        ))}
      </ul>
    </FormSection>
  );
}

/** "Assign and remove roles (core.roleAssignment:manage)", the permission an assignment needs. */
const assignPermission = permissionWithId('core.roleAssignment:manage');

/**
 * Why the API refused the assignment at the place (AS5), as the sentences between "You cannot
 * assign Viewer at Acme AB." and who can act, or undefined for another failure. The grant rule
 * names the role's permissions the assigner lacks there; a refused assignment permission names
 * it, after the role's permissions the assigner lacks there by the client's own check.
 */
function refusalOf(
  error: unknown,
  role: PickRole | undefined,
  at: Place,
  holds: (key: string) => boolean,
): string | undefined {
  const lacking = (keys: readonly string[]) =>
    `It includes ${permissionCount(keys.length)} you do not hold at ${at.name}: ${permissionList(keys)}.`;
  const missing = missingPermissionsOf(error);
  if (missing !== undefined) {
    const also = holds('core.roleAssignment:manage')
      ? ''
      : ` Assigning at ${at.name} also needs ${assignPermission} there.`;
    return `${lacking(missing)}${also}`;
  }
  if (!hasErrorCode(error, 'core.forbidden')) return undefined;
  const unheld = role?.permissions.filter((key) => !holds(key)) ?? [];
  return unheld.length === 0
    ? `Assigning at ${at.name} needs ${assignPermission} there.`
    : `${lacking(unheld)} Assigning at ${at.name} also needs ${assignPermission} there.`;
}

interface AddRoleFormProps {
  readonly user: User;
  readonly roles: readonly PickRole[];
  readonly company: Place;
  readonly plant: Place;
}

/** The Add role form, once the user, the roles and the places have loaded. */
function AddRoleForm({ user, roles, company, plant }: AddRoleFormProps) {
  const { plant: slug } = useShell();
  const navigate = useNavigate();
  const viewer = useViewer();
  const [id] = useState(() => uuidv7());
  const form = useZodForm(addRoleFields, { defaultValues: { where: 'plant', roleId: '' } });
  const where = form.watch('where');
  const roleId = form.watch('roleId');
  const place = where === 'company' ? company : plant;
  const holds = where === 'company' ? viewer.canAtCompany : viewer.can;
  const optionAt = (role: PickRole) => optionOf(role, user, where, place, viewer);
  const chosen = roles.find((role) => role.id === roleId);
  const { isDirty, isSubmitting } = form.formState;
  const [assign] = useMutation(CoreAssignRole, {
    update(cache, { data }) {
      if (!data) return;
      const existing = cache.readQuery({ query: CoreUser, variables: { id: user.id } });
      if (existing?.coreUser) {
        const assignments = [...existing.coreUser.roleAssignments, data.coreAssignRole];
        cache.writeQuery({
          query: CoreUser,
          variables: { id: user.id },
          data: {
            coreUser: {
              ...existing.coreUser,
              // The company's roles first, as the API lists them.
              roleAssignments: assignments.sort(
                (a, b) => Number(a.scope.kind === 'PLANT') - Number(b.scope.kind === 'PLANT'),
              ),
            },
          },
        });
      }
      // What the user can do is computed from the roles, so it is read again.
      cache.modify({
        id: cache.identify({ __typename: 'User', id: user.id }),
        fields: { effectivePermissions: (_value, { DELETE }) => DELETE },
      });
      const roleId = data.coreAssignRole.role?.id;
      if (roleId !== undefined) addHolder(cache, roleId, data.coreAssignRole.id);
    },
  });

  const save = async (values: AddRoleValues) => {
    const at = values.where === 'company' ? company : plant;
    const role = roles.find((each) => each.id === values.roleId);
    const roleName = role?.name ?? 'the role';
    try {
      await assign({
        variables: { input: { id, userId: user.id, roleId: values.roleId, scopeId: at.id } },
      });
      announce(
        `${roleName} at ${at.name} added for ${user.name}. It applies from ${user.name}'s next action.`,
      );
      await navigate({
        to: coreLinks.users.user({ plant: slug, userId: user.id }, { tab: 'access' }).href,
        replace: true,
      });
    } catch (error) {
      const refused = refusalOf(
        error,
        role,
        at,
        values.where === 'company' ? viewer.canAtCompany : viewer.can,
      );
      let message = 'Could not add the role. Your choices are kept. Try again.';
      if (refused !== undefined) {
        message = `You cannot assign ${roleName} at ${at.name}. ${refused} Ask a company admin of ${company.name} to assign it.`;
      } else if (hasErrorCode(error, 'core.role_already_assigned')) {
        message = `${user.name} holds ${roleName} at ${at.name} already. Choose another role or place.`;
      }
      form.setError('roleId', { type: 'server', message });
    }
  };

  // A summary link to Role leads to the chosen role's radio, or the first one the user can choose.
  const roleTarget = chosen?.id ?? roles.find((role) => !optionAt(role).locked)?.id ?? roles[0]?.id;
  const errors = summaryErrors(form.formState.errors).map((entry) =>
    entry.name === 'roleId' && roleTarget !== undefined
      ? { ...entry, fieldId: radioIdOf(roleTarget) }
      : entry,
  );
  const fieldCount = errors.filter(({ name }) => name !== undefined).length;
  return (
    <form noValidate onSubmit={form.handleSubmit(save)} className="flex max-w-190 flex-col gap-4">
      <ErrorSummary
        heading={
          fieldCount === 0
            ? 'Could not add the role'
            : `Fix ${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'} to add the role`
        }
        errors={errors}
        focusKey={form.formState.submitCount}
      />
      <FormSection title="Role and place">
        <Controller
          control={form.control}
          name="where"
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <p id="add-role-where" className="text-xs font-semibold">
                Where
              </p>
              <RadioGroup
                aria-labelledby="add-role-where"
                value={field.value}
                onValueChange={(next) => {
                  field.onChange(next);
                  form.clearErrors('roleId');
                }}
                className="flex flex-col gap-2"
              >
                <div className="flex items-start gap-3 text-sm">
                  <RadioGroupItem
                    id={`${fieldId('where')}-plant`}
                    value="plant"
                    aria-describedby="add-role-where-plant"
                    className="mt-0.5"
                  />
                  <span className="flex flex-col">
                    <Label htmlFor={`${fieldId('where')}-plant`} className="font-normal">
                      {plant.name} only
                    </Label>
                    <span id="add-role-where-plant" className="text-xs text-muted-foreground">
                      Applies at {plant.name}.
                    </span>
                  </span>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <RadioGroupItem
                    id={`${fieldId('where')}-company`}
                    value="company"
                    aria-describedby="add-role-where-company"
                    className="mt-0.5"
                  />
                  <span className="flex flex-col">
                    <Label htmlFor={`${fieldId('where')}-company`} className="font-normal">
                      {company.name}, all plants
                    </Label>
                    <span id="add-role-where-company" className="text-xs text-muted-foreground">
                      Applies to every plant of {company.name}, also plants created later.
                    </span>
                  </span>
                </div>
              </RadioGroup>
            </div>
          )}
        />
        <Controller
          control={form.control}
          name="roleId"
          render={({ field, fieldState }) => (
            <RolePicker
              roles={roles}
              value={field.value}
              onChange={field.onChange}
              optionOf={optionAt}
              error={fieldState.error?.message}
              placeName={place.name}
            />
          )}
        />
      </FormSection>
      {chosen !== undefined && <ChosenRole role={chosen} holds={holds} placeName={place.name} />}
      <FormActions
        saveLabel="Add role"
        saving={isSubmitting}
        cancelHref={coreLinks.users.user({ plant: slug, userId: user.id }, { tab: 'access' }).href}
        dirty={isDirty}
      />
      <UnsavedChangesGuard when={isDirty && !isSubmitting} />
    </form>
  );
}

/**
 * Add role (design core-304, AS3, AS5, AS14, NO21 to NO23): Where (the plant only, or the company
 * and all its plants), then Role, where the roles the assigner cannot give at that place stay with
 * what they need. The API checks the grant rule again; its refusal lands on Role and the error
 * summary takes focus, with the choices kept. An added role opens the user's Access tab in place of
 * the form, and the polite region says "Shift lead at Plant A added for Alex Lund. It applies from
 * Alex Lund's next action."
 */
export function AddRoleScreen() {
  const { plant: slug } = useShell();
  const { user, state: userState } = useUser();
  const places = usePlaces();
  const viewer = useViewer();
  const { data, error, refetch } = useQuery(CoreRoles);
  const roles = data?.coreRoles;
  const plantName = places.plant?.name ?? slug;
  const forbidden =
    viewer.loaded &&
    !(
      viewer.can('core.roleAssignment:manage') || viewer.canAtCompany('core.roleAssignment:manage')
    );
  let state: PageState = userState;
  if (forbidden) {
    state = noAccessState('Add role', 'core.roleAssignment:manage', plantName);
  } else if (userState.status === 'ready' && roles === undefined && error !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load the roles',
      description: 'Check the connection, then try again.',
      onRetry: () => {
        refetch().catch(() => {});
      },
    };
  } else if (
    userState.status === 'ready' &&
    (roles === undefined || !viewer.loaded || places.company === undefined)
  ) {
    state = { status: 'loading' };
  }
  const users = { label: 'Users', href: coreLinks.users({ plant: slug }).href };
  return (
    <PageFrame
      title={
        forbidden
          ? 'No access to Add role'
          : user === undefined
            ? 'Add role'
            : `Add role for ${user.name}`
      }
      crumbs={
        user === undefined
          ? [users]
          : [
              users,
              {
                label: user.name,
                href: coreLinks.users.user({ plant: slug, userId: user.id }, { tab: 'access' })
                  .href,
              },
            ]
      }
      state={state}
    >
      {state.status === 'ready' &&
        user !== undefined &&
        roles !== undefined &&
        places.company !== undefined &&
        places.plant !== undefined && (
          <AddRoleForm user={user} roles={roles} company={places.company} plant={places.plant} />
        )}
    </PageFrame>
  );
}
