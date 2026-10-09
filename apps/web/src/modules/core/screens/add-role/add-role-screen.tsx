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
import { missingPermissionsOf, permissionCount, permissionList } from '../../access-refusal.ts';
import { noAccessState, permissionPhrase } from '../../no-access.tsx';
import { permissionLine } from '../../permission-names.ts';
import { addHolder } from '../../role-cache.ts';
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

/** Why a role cannot be added at the place, or undefined when it can. */
function lockedReason(
  role: PickRole,
  user: User,
  where: AddRoleValues['where'],
  place: Place,
  viewer: Viewer,
): string | undefined {
  const kind = where === 'company' ? 'COMPANY' : 'PLANT';
  if (user.roleAssignments.some((each) => each.role?.id === role.id && each.scope.kind === kind)) {
    return `${user.name} holds it at ${place.name} already.`;
  }
  const holds = where === 'company' ? viewer.canAtCompany : viewer.can;
  const missing = role.permissions.filter((key) => !holds(key));
  if (missing.length === 0) return undefined;
  const named = missing.slice(0, 3).map((key) => `${permissionLine(key)} (${key})`);
  const more = missing.length > 3 ? `, and ${missing.length - 3} more` : '';
  return `You do not hold ${permissionCount(missing.length)} of it at ${place.name}: ${named.join(', ')}${more}.`;
}

interface RolePickerProps {
  readonly roles: readonly PickRole[];
  readonly value: string;
  readonly onChange: (roleId: string) => void;
  readonly reasonOf: (role: PickRole) => string | undefined;
  readonly error?: string;
  readonly placeName: string;
}

/**
 * Role (design core-304, AS3): one radio group, the custom roles and then the default roles, each
 * by name. A role that needs permissions the assigner does not hold at the place stays in the list,
 * disabled, with what it needs. One Tab stop; the arrow keys choose.
 */
function RolePicker({ roles, value, onChange, reasonOf, error, placeName }: RolePickerProps) {
  const labelId = useId();
  const hintId = useId();
  const errorId = useId();
  const group = (title: string, origin: PickRole['origin']) => {
    const listed = roles.filter((role) => role.origin === origin);
    if (listed.length === 0) return null;
    return (
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs font-semibold text-muted-foreground">{title}</legend>
        {listed.map((role) => {
          const reason = reasonOf(role);
          const reasonId = `${radioIdOf(role.id)}-reason`;
          return (
            <div key={role.id} className="flex min-h-9 items-start gap-3 py-1 text-sm">
              <RadioGroupItem
                id={radioIdOf(role.id)}
                value={role.id}
                disabled={reason !== undefined}
                aria-describedby={reason === undefined ? undefined : reasonId}
                aria-invalid={error !== undefined || undefined}
                className="mt-0.5"
              />
              <span className="flex flex-col">
                <Label htmlFor={radioIdOf(role.id)} className="font-normal">
                  {role.name}
                </Label>
                {reason !== undefined && (
                  <span id={reasonId} className="text-xs text-muted-foreground">
                    {reason}
                  </span>
                )}
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
        {group('Custom roles', 'CUSTOM')}
        {group('Default roles', 'MODULE')}
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
  const reasonOf = (role: PickRole) => lockedReason(role, user, where, place, viewer);
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
      const missing = missingPermissionsOf(error);
      let message = 'Could not add the role. Your choices are kept. Try again.';
      if (missing !== undefined) {
        message = `You cannot assign ${roleName} at ${at.name}. It includes ${permissionCount(missing.length)} you do not hold at ${at.name}: ${permissionList(missing)}. Ask a company admin of ${company.name} to assign it.`;
      } else if (hasErrorCode(error, 'core.forbidden')) {
        message = `You cannot assign ${roleName} at ${at.name}. Assigning there needs ${permissionPhrase('core.roleAssignment:manage')}. Ask a company admin of ${company.name} to assign it.`;
      } else if (hasErrorCode(error, 'core.role_already_assigned')) {
        message = `${user.name} holds ${roleName} at ${at.name} already. Choose another role or place.`;
      }
      form.setError('roleId', { type: 'server', message });
    }
  };

  // A summary link to Role leads to the chosen role's radio, or the first one the user can choose.
  const roleTarget =
    chosen?.id ?? roles.find((role) => reasonOf(role) === undefined)?.id ?? roles[0]?.id;
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
                      The role applies at {plant.name}.
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
                      The role applies at every plant of {company.name}.
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
              reasonOf={reasonOf}
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
