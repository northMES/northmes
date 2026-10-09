// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApolloCache } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useState } from 'react';
import { Controller, useController } from 'react-hook-form';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import { ErrorSummary } from '../../../../ui/components/error-summary/index.ts';
import { FormActions } from '../../../../ui/components/form-actions/index.ts';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { UnsavedChangesGuard } from '../../../../ui/components/unsaved-changes-guard/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { hasErrorCode } from '../../../../ui/lib/graphql-errors.ts';
import { summaryErrors, useZodForm } from '../../../../ui/lib/use-zod-form.ts';
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import { NativeSelect, NativeSelectOption } from '../../../../ui/primitives/native-select.tsx';
import { missingPermissionsOf, permissionCount, permissionList } from '../../access-refusal.ts';
import { permissionLine, permissionWithId } from '../../permission-names.ts';
import { addHolder } from '../../role-cache.ts';
import { useCompanyVariables } from '../../use-places.ts';
import { CoreAssignRole, type CoreAssignRoleMutation } from './assign-role.graphql.ts';
import {
  type AssignPerson,
  type AssignPlace,
  AssignRoleFormFields,
  type HeldRole,
  type PickRole,
} from './assign-role-form-fields.tsx';

/** The assignment the API returned. */
export type AssignedRole = CoreAssignRoleMutation['coreAssignRole'];

/** The fields of Add role: the person, where the role applies, and the role. */
const addRoleFields = z.object({
  userId: z.string().min(1, 'Choose a person.'),
  where: z.string().min(1, 'Choose where the role applies.'),
  roleId: z.string().min(1, 'Choose a role.'),
});

type AddRoleValues = z.output<typeof addRoleFields>;

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
  at: AssignPlace,
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

export interface AssignRoleFormProps {
  /** The people to choose from, as Person; one person, from their page, shows no Person field. */
  readonly people: readonly AssignPerson[];
  /** The places Where offers; one place, as in plant settings, shows no Where field. */
  readonly places: readonly AssignPlace[];
  readonly companyName: string;
  readonly roles: readonly PickRole[];
  /** The roles a person holds already, which the picker locks at their place. */
  readonly heldBy: (personId: string) => readonly HeldRole[];
  /** Whether the assigner holds a permission at a place, as the grant rule asks (ADR 0010). */
  readonly holds: (permission: string, place: AssignPlace) => boolean;
  readonly cancelHref: string;
  /** Moves on once the role is given, such as to the person's Access tab, in place of the form. */
  readonly onAssigned: (person: AssignPerson) => Promise<void>;
  /** Writes the new assignment where the page that follows reads it. */
  readonly writeAssignment?: (cache: ApolloCache, assignment: AssignedRole) => void;
}

/**
 * The Add role form (design core-304, AS3, AS5 and AS14): Person when the page offers several,
 * Where when it offers several places, then Role, where the roles the assigner cannot give at that
 * place stay with what they need. The API checks the grant rule again; its refusal lands on Role
 * and the error summary takes focus, with the choices kept. An added role announces "Shift lead at
 * Plant A added for Alex Lund. It applies from Alex Lund's next action."
 */
export function AssignRoleForm({
  people,
  places,
  companyName,
  roles,
  heldBy,
  holds,
  cancelHref,
  onAssigned,
  writeAssignment,
}: AssignRoleFormProps) {
  const company = useCompanyVariables();
  const [id] = useState(() => uuidv7());
  const [onlyPerson] = people.length === 1 ? people : [];
  const [onlyPlace] = places.length === 1 ? places : [];
  const form = useZodForm(addRoleFields, {
    defaultValues: { userId: onlyPerson?.id ?? '', where: onlyPlace?.id ?? '', roleId: '' },
  });
  const userId = form.watch('userId');
  const whereField = useController({ control: form.control, name: 'where' });
  const roleField = useController({ control: form.control, name: 'roleId' });
  const where = whereField.field.value;
  const roleId = roleField.field.value;
  const person = people.find((each) => each.id === userId);
  const place = places.find((each) => each.id === where);
  const chosen = roles.find((role) => role.id === roleId);
  const { isDirty, isSubmitting } = form.formState;
  const [assign] = useMutation(CoreAssignRole, {
    update(cache, { data }) {
      if (!data) return;
      writeAssignment?.(cache, data.coreAssignRole);
      // What the person can do is computed from the roles, so it is read again.
      cache.modify({
        id: cache.identify({ __typename: 'User', id: data.coreAssignRole.user.id }),
        fields: { effectivePermissions: (_value, { DELETE }) => DELETE },
      });
      const assigned = data.coreAssignRole.role?.id;
      if (assigned !== undefined) addHolder(cache, assigned, data.coreAssignRole.id);
    },
  });

  const save = async (values: AddRoleValues) => {
    const at = places.find((each) => each.id === values.where);
    const to = people.find((each) => each.id === values.userId);
    if (at === undefined || to === undefined) return;
    const role = roles.find((each) => each.id === values.roleId);
    const roleName = role?.name ?? 'the role';
    try {
      await assign({
        variables: {
          input: { id, userId: to.id, roleId: values.roleId, scopeId: at.id, ...company },
        },
      });
      announce(
        `${roleName} at ${at.name} added for ${to.name}. It applies from ${to.name}'s next action.`,
      );
      await onAssigned(to);
    } catch (error) {
      const refused = refusalOf(error, role, at, (key) => holds(key, at));
      let message = 'Could not add the role. Your choices are kept. Try again.';
      if (refused !== undefined) {
        message = `You cannot assign ${roleName} at ${at.name}. ${refused} Ask a company admin of ${companyName} to assign it.`;
      } else if (hasErrorCode(error, 'core.role_already_assigned')) {
        message = `${to.name} holds ${roleName} at ${at.name} already. Choose another role or place.`;
      }
      form.setError('roleId', { type: 'server', message });
    }
  };

  const errors = summaryErrors(form.formState.errors);
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
      <FormSection title={onlyPerson === undefined ? 'Person, role and place' : 'Role and place'}>
        {onlyPerson === undefined && (
          <Controller
            control={form.control}
            name="userId"
            render={({ field, fieldState }) => (
              <Field className="max-w-120">
                <FieldLabel
                  htmlFor={fieldId('userId')}
                  className="block text-xs font-semibold text-foreground"
                >
                  Person
                </FieldLabel>
                <NativeSelect
                  id={fieldId('userId')}
                  className="w-full"
                  value={field.value}
                  onChange={(event) => {
                    field.onChange(event.target.value);
                    form.clearErrors('roleId');
                  }}
                  aria-invalid={fieldState.error !== undefined || undefined}
                  aria-describedby={
                    fieldState.error === undefined ? undefined : `${fieldId('userId')}-error`
                  }
                >
                  <NativeSelectOption value="">Choose a person</NativeSelectOption>
                  {people.map((each) => (
                    <NativeSelectOption key={each.id} value={each.id}>
                      {each.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {fieldState.error !== undefined && (
                  <p id={`${fieldId('userId')}-error`} className="text-xs text-destructive">
                    {fieldState.error.message}
                  </p>
                )}
              </Field>
            )}
          />
        )}
        <AssignRoleFormFields
          places={places}
          roles={roles}
          holds={holds}
          person={person}
          held={person === undefined ? [] : heldBy(person.id)}
          where={where}
          onWhereChange={(next) => {
            whereField.field.onChange(next);
            form.clearErrors('roleId');
          }}
          roleId={roleId}
          onRoleChange={roleField.field.onChange}
          whereError={whereField.fieldState.error?.message}
          roleError={roleField.fieldState.error?.message}
        />
      </FormSection>
      {chosen !== undefined && place !== undefined && (
        <ChosenRole role={chosen} holds={(key) => holds(key, place)} placeName={place.name} />
      )}
      <FormActions
        saveLabel="Add role"
        saving={isSubmitting}
        cancelHref={cancelHref}
        dirty={isDirty}
      />
      <UnsavedChangesGuard when={isDirty && !isSubmitting} />
    </form>
  );
}
