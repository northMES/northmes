// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApolloCache } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { accessReason } from '@northmes/core-contracts';
import { CircleCheck, CircleX, Info } from 'lucide-react';
import { useState } from 'react';
import { Controller, useController } from 'react-hook-form';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import { ErrorSummary } from '../../../../ui/components/error-summary/index.ts';
import { FormActions } from '../../../../ui/components/form-actions/index.ts';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
import { UnsavedChangesGuard } from '../../../../ui/components/unsaved-changes-guard/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { hasErrorCode } from '../../../../ui/lib/graphql-errors.ts';
import { fieldProps, summaryErrors, useZodForm } from '../../../../ui/lib/use-zod-form.ts';
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
import { AssignRoleFormPerson, type PersonSearch } from './assign-role-form-person.tsx';

/** The assignment the API returned. */
export type AssignedRole = CoreAssignRoleMutation['coreAssignRole'];

/** The fields of Add role: the person, where the role applies, and the role. */
const addRoleFields = z.object({
  userId: z.string().min(1, 'Choose a person.'),
  where: z.string().min(1, 'Choose where the role applies.'),
  roleId: z.string().min(1, 'Choose a role.'),
  reason: accessReason,
});

type AddRoleValues = z.output<typeof addRoleFields>;

/**
 * The person card of Add role (AS3): the person's name, username and the roles they hold already,
 * each with its place.
 */
function PersonCard({
  person,
  held,
  roles,
  places,
}: {
  readonly person: AssignPerson;
  readonly held: readonly HeldRole[];
  readonly roles: readonly PickRole[];
  readonly places: readonly AssignPlace[];
}) {
  const here = held.flatMap(({ roleId, scopeId }) => {
    const role = roles.find(({ id }) => id === roleId);
    const place = places.find(({ id }) => id === scopeId);
    return role === undefined || place === undefined ? [] : [`${role.name} at ${place.name}`];
  });
  return (
    <FormSection title={person.name}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {person.username !== undefined && (
          <>
            <dt className="text-muted-foreground">Username</dt>
            <dd className="font-mono">{person.username}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Roles here</dt>
        <dd className="flex flex-col">
          {here.length === 0 ? 'None' : here.map((line) => <span key={line}>{line}</span>)}
        </dd>
      </dl>
    </FormSection>
  );
}

/**
 * The highlighted role at the place (AS3, AS5): each permission it includes, with its id, and
 * whether the assigner holds it there. It follows the listbox highlight, else the chosen role.
 */
function HighlightedRole({
  role,
  holds,
  place,
}: {
  readonly role: PickRole;
  readonly holds: (key: string) => boolean;
  readonly place: AssignPlace;
}) {
  return (
    <FormSection
      title={`${role.name} at ${place.name}`}
      description={`The highlighted role. Each permission it includes, and whether you hold it at ${place.name}.`}
    >
      <ul className="flex flex-col gap-2 text-sm">
        {role.permissions.map((key) => (
          <li key={key} className="flex items-start gap-2">
            {holds(key) ? (
              <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
            ) : (
              <CircleX aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
            )}
            <span className="flex min-w-0 flex-col">
              <span>{permissionLine(key)}</span>
              <span className="font-mono text-xs break-all text-muted-foreground">{key}</span>
              <span className="text-xs text-muted-foreground">
                {holds(key)
                  ? `You hold it at ${place.name}`
                  : `You do not hold it at ${place.name}`}
              </span>
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
  /** Person searches the API with these, in place of choosing from `people` (People's Add role). */
  readonly personSearch?: PersonSearch;
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
  personSearch,
}: AssignRoleFormProps) {
  const company = useCompanyVariables();
  const [id] = useState(() => uuidv7());
  const [onlyPerson] = people.length === 1 ? people : [];
  const [onlyPlace] = places.length === 1 ? places : [];
  const form = useZodForm(addRoleFields, {
    defaultValues: {
      userId: onlyPerson?.id ?? '',
      where: onlyPlace?.id ?? '',
      roleId: '',
      reason: '',
    },
  });
  const userId = form.watch('userId');
  const whereField = useController({ control: form.control, name: 'where' });
  const roleField = useController({ control: form.control, name: 'roleId' });
  const where = whereField.field.value;
  const roleId = roleField.field.value;
  // The person picked by a search, which the next search's results may leave out.
  const [picked, setPicked] = useState<AssignPerson | undefined>(undefined);
  const personOf = (personId: string) =>
    people.find((each) => each.id === personId) ?? (picked?.id === personId ? picked : undefined);
  const person = personOf(userId);
  const place = places.find((each) => each.id === where);
  const [highlighted, setHighlighted] = useState<string | undefined>(undefined);
  // The side card follows the listbox highlight, else the chosen role (AS3).
  const shown = roles.find((role) => role.id === (highlighted ?? roleId));
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
    const to = personOf(values.userId);
    if (at === undefined || to === undefined) return;
    const role = roles.find((each) => each.id === values.roleId);
    const roleName = role?.name ?? 'the role';
    try {
      await assign({
        variables: {
          input: {
            id,
            userId: to.id,
            roleId: values.roleId,
            scopeId: at.id,
            ...company,
            ...(values.reason !== undefined && values.reason !== '' && { reason: values.reason }),
          },
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
  const personField =
    personSearch !== undefined ? (
      <Controller
        control={form.control}
        name="userId"
        render={({ field, fieldState }) => (
          <AssignRoleFormPerson
            {...personSearch}
            value={person}
            onChange={(next) => {
              setPicked(next);
              field.onChange(next?.id ?? '');
              form.clearErrors('roleId');
            }}
            error={fieldState.error?.message}
          />
        )}
      />
    ) : onlyPerson === undefined ? (
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
    ) : undefined;
  // The note names the chosen place, or the first plant before one is chosen.
  const notePlace = place ?? places.find(({ kind }) => kind === 'PLANT') ?? places[0];
  return (
    // Two columns from 1280 px (AS3): the form, then a 340 px side column with the person, the
    // highlighted role and the note.
    <form
      noValidate
      onSubmit={form.handleSubmit(save)}
      className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start"
    >
      <div className="flex min-w-0 flex-col gap-4">
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
          {personField}
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
            onHighlight={setHighlighted}
          />
        </FormSection>
        <TextareaField
          label="Reason"
          optional
          placeholder={`Why ${person?.name ?? 'this person'} gets this role`}
          hint="Shown in the user's history. Do not enter personal data. Up to 500 characters."
          maxLength={500}
          {...fieldProps(form, 'reason')}
        />
        <FormActions
          saveLabel="Add role"
          saving={isSubmitting}
          cancelHref={cancelHref}
          dirty={isDirty}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        {person !== undefined && (
          <PersonCard person={person} held={heldBy(person.id)} roles={roles} places={places} />
        )}
        {shown !== undefined && place !== undefined && (
          <HighlightedRole role={shown} holds={(key) => holds(key, place)} place={place} />
        )}
        {notePlace !== undefined && (
          <p className="flex items-start gap-2 rounded-lg bg-info-subtle px-4 py-3 text-sm">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
            You can assign a role at {notePlace.name} when you hold every permission it includes
            there. A company admin of {companyName} can assign the others.
          </p>
        )}
      </div>
      <UnsavedChangesGuard when={isDirty && !isSubmitting} />
    </form>
  );
}
