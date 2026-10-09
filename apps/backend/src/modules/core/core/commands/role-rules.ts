// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@northmes/sdk/errors';
import { sql, type Transaction } from 'kysely';
import type { Principal } from '../../../../principal.ts';
import type { CoreDatabase } from '../../infrastructure/database.ts';
import { can } from '../access/access.ts';

/** The permission keys of a role as it stores them: each once, sorted by character code. */
export function normalizedPermissions(permissions: readonly string[]): string[] {
  return [...new Set(permissions)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

const NAME_TAKEN = 'A role of this company has that name. Choose another name.';

/**
 * Refuses a role name that another role of the company has, a default role's too, ignoring case,
 * with core.role_name_taken on the name field.
 */
export async function refuseTakenName(
  tx: Transaction<CoreDatabase>,
  { companyId, name, exceptId }: { companyId: string; name: string; exceptId?: string },
): Promise<void> {
  let query = tx
    .selectFrom('core.role')
    .select('id')
    .where('company_id', '=', companyId)
    .where(sql<string>`lower(name)`, '=', name.toLowerCase());
  if (exceptId) query = query.where('id', '<>', exceptId);
  if (!(await query.executeTakeFirst())) return;
  throw new DomainError({
    code: 'core.role_name_taken',
    status: HttpStatus.CONFLICT,
    message: NAME_TAKEN,
    fieldErrors: [{ path: ['name'], message: NAME_TAKEN, code: 'core.role_name_taken' }],
  });
}

/**
 * Refuses a permission that is not in the catalog of the installed modules with
 * core.unknown_permission on the permissions field. A permission the role holds already passes even
 * when its module is no longer installed, so a role keeps it through an edit (ADR 0010).
 */
export async function refuseUnknownPermissions(
  tx: Transaction<CoreDatabase>,
  permissions: readonly string[],
  held: readonly string[] = [],
): Promise<void> {
  const asked = permissions.filter((key) => !held.includes(key));
  if (asked.length === 0) return;
  const installed = await tx
    .selectFrom('core.permission')
    .select('key')
    .where('key', 'in', asked)
    .where('installed', '=', true)
    .execute();
  const known = new Set(installed.map(({ key }) => key));
  const unknown = asked.filter((key) => !known.has(key));
  if (unknown.length === 0) return;
  const message = `${unknown.join(', ')} ${unknown.length === 1 ? 'is not a permission' : 'are not permissions'} of an installed module.`;
  throw new DomainError({
    code: 'core.unknown_permission',
    status: HttpStatus.BAD_REQUEST,
    message,
    details: { permissions: unknown },
    fieldErrors: [{ path: ['permissions'], message, code: 'core.unknown_permission' }],
  });
}

/**
 * The grant rule of ADR 0010: refuses with core.role_not_held, whose details name the scope and the
 * permissions, when the principal does not hold each of these permissions at the scope or at a
 * scope above it. A principal hands out, takes back or adds to a role only what it holds there.
 */
export function refuseUnheldPermissions(
  principal: Pick<Principal, 'scopes'>,
  permissions: readonly string[],
  scopeId: string,
): void {
  const missing = permissions.filter((permission) => !can(principal, permission, scopeId));
  if (missing.length === 0) return;
  throw new DomainError({
    code: 'core.role_not_held',
    status: HttpStatus.FORBIDDEN,
    message: `You do not hold ${missing.join(', ')} at scope ${scopeId}, so you cannot give or take them there.`,
    details: { scopeId, missingPermissions: missing },
  });
}
