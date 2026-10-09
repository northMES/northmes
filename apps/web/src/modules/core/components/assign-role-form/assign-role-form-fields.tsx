// SPDX-License-Identifier: AGPL-3.0-or-later
import { useId } from 'react';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { Label } from '../../../../ui/primitives/label.tsx';
import { RadioGroup, RadioGroupItem } from '../../../../ui/primitives/radio-group.tsx';
import { listOf, permissionCount } from '../../access-refusal.ts';
import { permissionWithId } from '../../permission-names.ts';
import { roleKind } from '../../role-kind.ts';
import type { CoreRolesQuery } from '../../roles.graphql.ts';

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

/** What the fields read to tell whether a role can be given at a place. */
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
  /** The id of the radio a summary link to Role leads to. */
  readonly targetId: string;
}

/**
 * Role (design core-304, AS3): one radio group in two groups, the roles the assigner can give at
 * the place and the roles that need permissions the assigner does not hold there, each with the
 * custom roles first and then the default roles, by name, and a line under each role. A role that
 * cannot be added stays in the list, disabled, with what keeps it. Until a place is chosen, the
 * groups are the custom roles and the default roles. One Tab stop; the arrow keys choose.
 */
function RolePicker({
  roles,
  value,
  onChange,
  optionOf,
  error,
  placeName,
  targetId,
}: RolePickerProps) {
  const labelId = useId();
  const hintId = useId();
  const errorId = useId();
  const options = roles.map((role) => ({ role, option: optionOf(role) }));
  const idOf = (roleId: string) => `${targetId}-${roleId}`;
  // A summary link to Role leads to the chosen role's radio, else the first one the user can
  // choose.
  const target =
    roles.find((role) => role.id === value)?.id ??
    options.find(({ option }) => !option.locked)?.role.id ??
    roles[0]?.id;
  const group = (title: string, listed: typeof options) => {
    if (listed.length === 0) return null;
    return (
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs font-semibold text-muted-foreground">{title}</legend>
        {listed.map(({ role, option }) => {
          const id = idOf(role.id);
          return (
            <div key={role.id} className="flex min-h-9 items-start gap-3 py-1 text-sm">
              <RadioGroupItem
                id={id}
                value={role.id}
                disabled={option.locked}
                aria-describedby={`${id}-line`}
                aria-invalid={error !== undefined || undefined}
                className="mt-0.5"
              />
              <span className="flex flex-col">
                <Label htmlFor={id} className="font-normal">
                  {role.name}
                </Label>
                <span id={`${id}-line`} className="text-xs text-muted-foreground">
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
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the error summary's link focuses the field's id, and the wrapper hands focus to the chosen radio, which takes keyboard input. */}
      <div
        id={targetId}
        tabIndex={-1}
        onFocus={(event) => {
          if (event.target === event.currentTarget && target !== undefined) {
            document.getElementById(idOf(target))?.focus();
          }
        }}
      >
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
      </div>
      {error !== undefined && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
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
}: AssignRoleFormFieldsProps) {
  const whereLabelId = useId();
  const [onlyPlace] = places.length === 1 ? places : [];
  const place = places.find((each) => each.id === where);
  const lock: LockContext = { person, place, held, holds };
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
        placeName={place?.name}
        targetId={fieldId(names.role)}
      />
    </>
  );
}
