// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { Lock, ShieldCheck } from 'lucide-react';
import { useId, useMemo } from 'react';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from '../../../../ui/primitives/combobox.tsx';
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import { Label } from '../../../../ui/primitives/label.tsx';
import { RadioGroup, RadioGroupItem } from '../../../../ui/primitives/radio-group.tsx';
import { listOf, permissionCount } from '../../access-refusal.ts';
import { permissionWithId } from '../../permission-names.ts';
import { roleKind } from '../../role-kind.ts';
import type { CoreRolesQuery } from '../../roles.graphql.ts';
import { useCompanyVariables } from '../../use-places.ts';
import { CorePermissionCatalog } from '../permission-checklist/permission-catalog.graphql.ts';

/** A role of the company, as the picker lists it. */
export type PickRole = CoreRolesQuery['coreRoles'][number];

/** A person a role is given to. */
export interface AssignPerson {
  readonly id: string;
  readonly name: string;
  /** Shown on the person card of Add role. */
  readonly username?: string;
  /** A blocked person carries a marker in the person picker. */
  readonly blocked?: boolean;
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

/** What the fields read to tell whether a role can be given at a place. */
interface LockContext {
  readonly person: AssignPerson | undefined;
  readonly place: AssignPlace | undefined;
  readonly held: readonly HeldRole[];
  readonly holds: (permission: string, place: AssignPlace) => boolean;
  /**
   * Whether the permission's module is installed; the API grants and checks only installed
   * permissions (ADR 0010), so the others lock no role.
   */
  readonly installed: (permission: string) => boolean;
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
function optionOf(
  role: PickRole,
  { person, place, held, holds, installed }: LockContext,
): RoleOption {
  const kind = `${roleKind(role)}.`;
  const count = `${permissionCount(role.permissions.length)}.`;
  if (place === undefined) {
    return { line: `${kind} ${count}`, locked: false, needsPermissions: false };
  }
  const holdsIt =
    person !== undefined &&
    held.some(({ roleId, scopeId }) => roleId === role.id && scopeId === place.id);
  const missing = role.permissions.filter((key) => installed(key) && !holds(key, place));
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
  readonly place: AssignPlace | undefined;
  /** The id of the combobox's input, which the label and a summary link lead to. */
  readonly inputId: string;
  readonly onHighlight?: (roleId: string | undefined) => void;
}

/** One group of the listbox: its heading and the ids of its roles. */
interface RoleGroup {
  readonly value: string;
  readonly items: readonly string[];
}

/**
 * Role (design core-304, AS3 and AS5): a combobox, "Choose a role", whose listbox holds two
 * groups, the roles the assigner can give at the place and the roles that need permissions the
 * assigner does not hold there, each with the custom roles first and then the default roles, by
 * name, and a line under each role. A role that cannot be added stays in the list, disabled, with
 * what keeps it. Until a place is chosen, the groups are the custom roles and the default roles.
 * The highlight is the input's active descendant; typing filters the roles by name. After a
 * refusal the input is invalid.
 */
function RolePicker({
  roles,
  value,
  onChange,
  optionOf,
  error,
  place,
  inputId,
  onHighlight,
}: RolePickerProps) {
  const hintId = useId();
  const errorId = useId();
  const byId = new Map(roles.map((role) => [role.id, role] as const));
  const options = new Map(roles.map((role) => [role.id, optionOf(role)] as const));
  const ids = (filter: (role: PickRole, option: RoleOption) => boolean) =>
    roles.filter((role) => filter(role, options.get(role.id) as RoleOption)).map(({ id }) => id);
  const groups: RoleGroup[] = (
    place === undefined
      ? [
          { value: 'Custom roles', items: ids((role) => role.origin === 'CUSTOM') },
          { value: 'Default roles', items: ids((role) => role.origin === 'MODULE') },
        ]
      : [
          {
            value: `You can assign these at ${place.name}`,
            items: ids((_, option) => !option.needsPermissions),
          },
          {
            value: `Needs permissions you do not hold at ${place.name}`,
            items: ids((_, option) => option.needsPermissions),
          },
        ]
  ).filter(({ items }) => items.length > 0);
  const hint =
    place?.kind === 'COMPANY'
      ? `Checked when you add it: you need every permission of the role at ${place.name}.`
      : `Roles that need permissions you do not hold at ${place?.name ?? 'the place you choose'} stay in the list, with what they need.`;
  return (
    <Field className="flex flex-col gap-2" data-invalid={error !== undefined || undefined}>
      <FieldLabel htmlFor={inputId} className="block text-xs font-semibold text-foreground">
        Role
      </FieldLabel>
      <Combobox
        items={groups}
        value={value === '' ? null : value}
        onValueChange={(next) => onChange(typeof next === 'string' ? next : '')}
        itemToStringLabel={(id: string) => byId.get(id)?.name ?? ''}
        onItemHighlighted={(id) => onHighlight?.(typeof id === 'string' ? id : undefined)}
      >
        <ComboboxInput
          id={inputId}
          placeholder="Choose a role"
          className="w-full"
          aria-invalid={error !== undefined || undefined}
          aria-describedby={[error === undefined ? '' : errorId, hintId].join(' ').trim()}
        />
        <ComboboxContent>
          <ComboboxEmpty>No role has that name.</ComboboxEmpty>
          <ComboboxList>
            {(group: RoleGroup) => (
              <ComboboxGroup key={group.value} items={[...group.items]}>
                <ComboboxLabel>{group.value}</ComboboxLabel>
                <ComboboxCollection>
                  {(id: string) => {
                    const role = byId.get(id);
                    const option = options.get(id);
                    if (role === undefined || option === undefined) return null;
                    return (
                      <ComboboxItem
                        key={id}
                        value={id}
                        disabled={option.locked}
                        className="items-start py-2"
                      >
                        {option.locked ? (
                          <Lock aria-hidden className="mt-0.5 text-muted-foreground" />
                        ) : (
                          <ShieldCheck aria-hidden className="mt-0.5 text-muted-foreground" />
                        )}
                        <span className="flex min-w-0 flex-col">
                          <span data-role-name>{role.name}</span>
                          <span className="text-xs whitespace-normal text-muted-foreground">
                            {option.line}
                          </span>
                        </span>
                      </ComboboxItem>
                    );
                  }}
                </ComboboxCollection>
              </ComboboxGroup>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {error !== undefined && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
      <p id={hintId} className="text-xs text-muted-foreground">
        {hint}
      </p>
    </Field>
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

/** Where and the Role picker of a form, by the names of its fields. */
export interface AssignRoleFormFieldsProps {
  /** The places Where offers; one place shows no Where field, only the line that names it. */
  readonly places: readonly AssignPlace[];
  /** The roles of the company, custom roles first, then default roles, each by name. */
  readonly roles: readonly PickRole[];
  /** Whether the assigner holds a permission at a place, as the grant rule asks (ADR 0010). */
  readonly holds: (permission: string, place: AssignPlace) => boolean;
  /** The person the role is for; a new user has none yet. */
  readonly person?: AssignPerson;
  /** The roles the person holds already, which the picker locks at their place. */
  readonly held?: readonly HeldRole[];
  /** The chosen place's id, or '' before one is chosen. */
  readonly where: string;
  readonly onWhereChange: (placeId: string) => void;
  /** The chosen role's id, or '' before one is chosen. */
  readonly roleId: string;
  readonly onRoleChange: (roleId: string) => void;
  readonly whereError?: string;
  readonly roleError?: string;
  /**
   * The form's names of the two fields, 'where' and 'roleId' unless given: Where's first choice
   * and Role take their fieldId, so the error summary's links lead to them.
   */
  readonly names?: { readonly where: string; readonly role: string };
  /** Called with the role the listbox highlights, as the keyboard or the pointer moves. */
  readonly onHighlight?: (roleId: string | undefined) => void;
}

/**
 * Where and Role of Add role and of New user (design core-304, AS3 and US5): Where offers one
 * plant or the company and all its plants, and Role lists the company's roles at the chosen place,
 * where the roles the assigner cannot give there stay, disabled, with what they need. The form
 * that renders them holds the values and runs the command; the API checks the grant rule again.
 */
export function AssignRoleFormFields({
  places,
  roles,
  holds,
  person,
  held = [],
  where,
  onWhereChange,
  roleId,
  onRoleChange,
  whereError,
  roleError,
  names = { where: 'where', role: 'roleId' },
  onHighlight,
}: AssignRoleFormFieldsProps) {
  const whereLabelId = useId();
  const [onlyPlace] = places.length === 1 ? places : [];
  const place = places.find((each) => each.id === where);
  // Until the catalog loads, every permission counts as installed, which locks more, not less.
  const catalog = useQuery(CorePermissionCatalog, { variables: useCompanyVariables() }).data
    ?.corePermissionCatalog;
  const installedKeys = useMemo(
    () =>
      catalog === undefined
        ? undefined
        : new Set(
            catalog.flatMap(({ resources }) =>
              resources.flatMap(({ permissions }) =>
                permissions.filter((each) => each.installed).map(({ key }) => key),
              ),
            ),
          ),
    [catalog],
  );
  const lock: LockContext = {
    person,
    place,
    held,
    holds,
    installed: (key) => installedKeys === undefined || installedKeys.has(key),
  };
  return (
    <>
      {onlyPlace === undefined ? (
        <div className="flex flex-col gap-2">
          <p id={whereLabelId} className="text-xs font-semibold">
            Where
          </p>
          <RadioGroup
            aria-labelledby={whereLabelId}
            value={where}
            onValueChange={(next) => onWhereChange(String(next))}
            className="flex flex-col gap-2"
          >
            {places.map((each, index) => {
              const { label, hint } = placeLabel(each);
              const radioId =
                index === 0 ? fieldId(names.where) : `${fieldId(names.where)}-${each.id}`;
              return (
                <div key={each.id} className="flex items-start gap-3 text-sm">
                  <RadioGroupItem
                    id={radioId}
                    value={each.id}
                    aria-describedby={`${radioId}-hint`}
                    aria-invalid={whereError !== undefined || undefined}
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
          {whereError !== undefined && <p className="text-xs text-destructive">{whereError}</p>}
        </div>
      ) : (
        <p className="text-sm">The role applies at {onlyPlace.name}.</p>
      )}
      <RolePicker
        roles={roles}
        value={roleId}
        onChange={onRoleChange}
        optionOf={(role) => optionOf(role, lock)}
        error={roleError}
        place={place}
        inputId={fieldId(names.role)}
        onHighlight={onHighlight}
      />
    </>
  );
}
