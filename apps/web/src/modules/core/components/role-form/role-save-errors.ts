// SPDX-License-Identifier: AGPL-3.0-or-later
import { fieldErrorsOf, hasErrorCode } from '../../../../ui/lib/graphql-errors.ts';
import { setServerErrors, type ZodForm } from '../../../../ui/lib/use-zod-form.ts';
import { missingPermissionsOf, permissionCount, permissionList } from '../../access-refusal.ts';
import { permissionPhrase } from '../../no-access.tsx';
import type { RoleFields, RoleValues } from './role-form.tsx';

/** Where the failed save ran: the company of the role. */
export interface RoleSaveContext {
  readonly companyName: string;
  /** The role's name as saved, or the typed name of a new role. */
  readonly roleName: string;
}

/**
 * Places the errors of a failed role save on the role form (design core-304, RO39): a taken name
 * on Role name, the grant rule's refusal and a missing core.role:manage as a summary line without
 * a link that names the permissions and who can act, and any other failure as "Your entries are
 * kept. Try again." The ticks, the name and the reason stay (WCAG 3.3.7). Returns the permissions
 * the refusal named, which the checklist marks invalid.
 */
export function showRoleSaveError(
  form: ZodForm<RoleFields>,
  error: unknown,
  values: RoleValues,
  { companyName, roleName }: RoleSaveContext,
): readonly string[] {
  const missing = missingPermissionsOf(error);
  if (missing !== undefined) {
    form.setError('root.server', {
      type: 'core.role_not_held',
      message: `You do not hold ${permissionCount(missing.length)} of ${roleName} where it applies: ${permissionList(missing)}. A role can only get permissions you hold. Ask a company admin of ${companyName} to change it.`,
    });
    return missing;
  }
  if (hasErrorCode(error, 'core.forbidden')) {
    form.setError('root.server', {
      type: 'core.forbidden',
      message: `Changing roles needs ${permissionPhrase('core.role:manage')} at ${companyName}. Ask a company admin of ${companyName} to change it.`,
    });
    return [];
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
    return [];
  }
  form.setError('root.server', { type: 'server', message: 'Your entries are kept. Try again.' });
  return [];
}
