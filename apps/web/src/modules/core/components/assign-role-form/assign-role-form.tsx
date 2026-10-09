// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApolloCache } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useId, useState } from 'react';
import { Controller } from 'react-hook-form';
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
import { Label } from '../../../../ui/primitives/label.tsx';
import { NativeSelect, NativeSelectOption } from '../../../../ui/primitives/native-select.tsx';
import { RadioGroup, RadioGroupItem } from '../../../../ui/primitives/radio-group.tsx';
import {
  listOf,
  missingPermissionsOf,
  permissionCount,
  permissionList,
} from '../../access-refusal.ts';
import { permissionLine, permissionWithId } from '../../permission-names.ts';
import { addHolder } from '../../role-cache.ts';
import { roleKind } from '../../role-kind.ts';
import type { CoreRolesQuery } from '../../roles.graphql.ts';
import { useCompanyVariables } from '../../use-places.ts';
import { CoreAssignRole, type CoreAssignRoleMutation } from './assign-role.graphql.ts';

/** A role of the company, as the picker lists it. */
export type PickRole = CoreRolesQuery['coreRoles'][number];

/** A person a role is given to. */
export interface AssignPerson {
  readonly id: string;
  readonly name: string;
}

/** A place where a role is given: the company, for all its plants, or one plant. */
export interface AssignPlace {
  readonly id: string;
  readonly name: string;
  readonly kind: 'COMPANY' | 'PLANT';
}

/** A role a person holds at a place already. */
export interface HeldRole {
  readonly roleId: string;
  readonly scopeId: string;
}

/** The assignment the API returned. */
export type AssignedRole = CoreAssignRoleMutation['coreAssignRole'];

/** The fields of Add role: the person, where the role applies, and the role. */
const addRoleFields = z.object({
  userId: z.string().min(1, 'Choose a person.'),
  where: z.string().min(1, 'Choose where the role applies.'),
  roleId: z.string().min(1, 'Choose a role.'),
});

type AddRoleValues = z.output<typeof addRoleFields>;

/** The id of a role's radio, which a summary link to Role may lead to. */
function radioIdOf(roleId: string): string {
  return `add-role-${roleId}`;
}

/** What the form reads to tell whether a role can be given at a place. */
interface LockContext {
  readonly person: AssignPerson | undefined;
  readonly place: AssignPlace | undefined;
  readonly held: readonly HeldRole[];
  readonly holds: (permission: string, place: AssignPlace) => boolean;
}

/** How a role of the picker reads at the place: its line, and whether it can be added there. */
interface RoleOption {
  /**
   * The line under the role's name (AS3): "Custom role. 9 permissions.", or what keeps it from
   * being added, such as "Custom role. Needs 3 permissions you do not hold at Plant A: ...".
   */
  readonly line: string;
  /** The role cannot be added at the place: the person holds it there, or it needs permissions. */
  readonly locked: boolean;
  /** The role needs permissions the assigner does not hold at the place. */
  readonly needsPermissions: boolean;
}

/**
 * The role as the picker lists it at the place, for the person and the assigner. Before a place
 * is chosen, no role is locked and the line names the role's kind and permission count.
 */
function optionOf(role: PickRole, { person, place, held, holds }: LockContext): RoleOption {
  const kind = `${roleKind(role)}.`;
  const count = `${permissionCount(role.permissions.length)}.`;
  if (place === undefined) {
    return { line: `${kind} ${count}`, locked: false, needsPermissions: false };
  }
  const holdsIt =
    person !== undefined &&
    held.some(({ roleId, scopeId }) => roleId === role.id && scopeId === place.id);
  const missing = role.permissions.filter((key) => !holds(key, place));
  const parts = [kind];
  if (holdsIt) parts.push(`${person.name} already holds it at ${place.name}.`);
  if (missing.length > 0) {
    const named = missing.slice(0, 3).map(permissionWithId);
    const more = missing.length > 3 ? `, and ${missing.length - 3} more` : '';
    parts.push(
      `Needs ${permissionCount(missing.length)} you do not hold at ${place.name}: ${listOf(named)}${more}.`,
    );
  }
  if (!holdsIt && missing.length === 0) parts.push(count);
  return {
    line: parts.join(' '),
    locked: holdsIt || missing.length > 0,
    needsPermissions: missing.length > 0,
  };
}

interface RolePickerProps {
  readonly roles: readonly PickRole[];
  readonly value: string;
  readonly onChange: (roleId: string) => void;
  readonly optionOf: (role: PickRole) => RoleOption;
  readonly error?: string;
  /** The chosen place, which names the two groups; undefined until Where is chosen. */
  readonly placeName: string | undefined;
}

/**
 * Role (design core-304, AS3): one radio group in two groups, the roles the assigner can give at
 * the place and the roles that need permissions the assigner does not hold there, each with the
 * custom roles first and then the default roles, by name, and a line under each role. A role that
 * cannot be added stays in the list, disabled, with what keeps it. Until a place is chosen, the
 * groups are the custom roles and the default roles. One Tab stop; the arrow keys choose.
 */
function RolePicker({ roles, value, onChange, optionOf, error, placeName }: RolePickerProps) {
  const labelId = useId();
  const hintId = useId();
  const errorId = useId();
  const options = roles.map((role) => ({ role, option: optionOf(role) }));
  const group = (title: string, listed: typeof options) => {
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
        Roles that need permissions you do not hold at {placeName ?? 'the place you choose'} stay in
        the list, with what they need.
      </p>
      <RadioGroup
        aria-labelledby={labelId}
        aria-describedby={[error === undefined ? '' : errorId, hintId].join(' ').trim()}
        value={value}
        onValueChange={(next) => onChange(String(next))}
        className="flex flex-col gap-3"
      >
        {placeName === undefined ? (
          <>
            {group(
              'Custom roles',
              options.filter(({ role }) => role.origin === 'CUSTOM'),
            )}
            {group(
              'Default roles',
              options.filter(({ role }) => role.origin === 'MODULE'),
            )}
          </>
        ) : (
          <>
            {group(
              `You can assign these at ${placeName}`,
              options.filter(({ option }) => !option.needsPermissions),
            )}
            {group(
              `Needs permissions you do not hold at ${placeName}`,
              options.filter(({ option }) => option.needsPermissions),
            )}
          </>
        )}
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

/** "Plant A only" or "Acme AB, all plants", and its hint (AS3). */
function placeLabel({ kind, name }: AssignPlace) {
  return kind === 'COMPANY'
    ? {
        label: `${name}, all plants`,
        hint: `Applies to every plant of ${name}, also plants created later.`,
      }
    : { label: `${name} only`, hint: `Applies at ${name}.` };
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
  const where = form.watch('where');
  const roleId = form.watch('roleId');
  const person = people.find((each) => each.id === userId);
  const place = places.find((each) => each.id === where);
  const lock: LockContext = {
    person,
    place,
    held: person === undefined ? [] : heldBy(person.id),
    holds,
  };
  const optionAt = (role: PickRole) => optionOf(role, lock);
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

  // A summary link to Role leads to the chosen role's radio, or the first one the user can choose.
  const roleTarget = chosen?.id ?? roles.find((role) => !optionAt(role).locked)?.id ?? roles[0]?.id;
  const errors = summaryErrors(form.formState.errors).map((entry) => {
    if (entry.name === 'roleId' && roleTarget !== undefined) {
      return { ...entry, fieldId: radioIdOf(roleTarget) };
    }
    if (entry.name === 'where' && places[0] !== undefined) {
      return { ...entry, fieldId: `${fieldId('where')}-${places[0].id}` };
    }
    return entry;
  });
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
        {onlyPlace === undefined ? (
          <Controller
            control={form.control}
            name="where"
            render={({ field, fieldState }) => (
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
                  {places.map((each) => {
                    const { label, hint } = placeLabel(each);
                    const radioId = `${fieldId('where')}-${each.id}`;
                    return (
                      <div key={each.id} className="flex items-start gap-3 text-sm">
                        <RadioGroupItem
                          id={radioId}
                          value={each.id}
                          aria-describedby={`${radioId}-hint`}
                          aria-invalid={fieldState.error !== undefined || undefined}
                          className="mt-0.5"
                        />
                        <span className="flex flex-col">
                          <Label htmlFor={radioId} className="font-normal">
                            {label}
                          </Label>
                          <span id={`${radioId}-hint`} className="text-xs text-muted-foreground">
                            {hint}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </RadioGroup>
                {fieldState.error !== undefined && (
                  <p className="text-xs text-destructive">{fieldState.error.message}</p>
                )}
              </div>
            )}
          />
        ) : (
          <p className="text-sm">The role applies at {onlyPlace.name}.</p>
        )}
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
              placeName={place?.name}
            />
          )}
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
