// SPDX-License-Identifier: AGPL-3.0-or-later
import { detailsOf, fieldErrorsOf, hasErrorCode } from '../../../../ui/lib/graphql-errors.ts';
import { setServerErrors, type ZodForm } from '../../../../ui/lib/use-zod-form.ts';
import { missingPermissionsOf } from '../../access-refusal.ts';
import { permissionPhrase } from '../../no-access.tsx';
import type { RoleFields, RoleValues } from './role-form.tsx';

/** Where the failed save ran: the company of the role. */
export interface RoleSaveContext {
  readonly companyName: string;
  /** The role's name as saved, or the typed name of a new role. */
  readonly roleName: string;
  /** The name of a place by its scope id, the company or one of its plants. */
  readonly placeName?: (scopeId: string) => string | undefined;
}

/** The permissions a save was refused for, and the line each row and summary link says. */
export interface RoleRefusal {
  readonly keys: readonly string[];
  readonly reason: string;
}

/**
 * Places the errors of a failed role save on the role form (design core-304, RO39): a taken name
 * on Role name; the grant rule's refusal on each refused permission, whose row says "Refused: you
 * do not hold it at Plant B, where Shift lead is assigned." and whose summary link leads to it; a
 * missing core.role:manage as a summary line without a link that names who can act; and any other
 * failure as "Your entries are kept. Try again." The ticks, the name and the reason stay (WCAG
 * 3.3.7). Returns the refusal of the grant rule, if that was the failure.
 */
export function showRoleSaveError(
  form: ZodForm<RoleFields>,
  error: unknown,
  values: RoleValues,
  { companyName, roleName, placeName }: RoleSaveContext,
): RoleRefusal | undefined {
  const missing = missingPermissionsOf(error);
  if (missing !== undefined) {
    const scopeId = detailsOf(error, 'core.role_not_held')?.scopeId;
    const place = typeof scopeId === 'string' ? placeName?.(scopeId) : undefined;
    return {
      keys: missing,
      reason:
        place === undefined
          ? `Refused: you do not hold it where ${roleName} is assigned.`
          : `Refused: you do not hold it at ${place}, where ${roleName} is assigned.`,
    };
  }
  if (hasErrorCode(error, 'core.forbidden')) {
    form.setError('root.server', {
      type: 'core.forbidden',
      message: `Changing a role of ${companyName} needs ${permissionPhrase('core.role:manage')} at ${companyName}. A company admin of ${companyName} has it and can make the change.`,
    });
    return undefined;
  }
  const fieldErrors = fieldErrorsOf(error).map((entry) =>
    entry.code === 'core.role_name_taken'
      ? {
          ...entry,
          path: ['name'],
          message: `${companyName} has a role named ${values.name}. Choose another name.`,
        }
      : entry,
  );
  if (fieldErrors.length > 0) {
    setServerErrors(form, fieldErrors);
    return undefined;
  }
  form.setError('root.server', { type: 'server', message: 'Your entries are kept. Try again.' });
  return undefined;
}
