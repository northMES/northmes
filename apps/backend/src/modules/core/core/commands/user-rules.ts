// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomInt } from 'node:crypto';
import { HttpStatus, NotFoundException } from '@nestjs/common';
import { DomainError } from '@northmes/sdk/errors';
import { sql, type Transaction } from 'kysely';
import { currentPrincipal } from '../../../../principal.ts';
import type { CoreDatabase } from '../../infrastructure/database.ts';
import { can } from '../access/access.ts';
import { forbidden } from '../access/request-scope.ts';
import { companyUsers, type UserRecord } from '../user.service.ts';
import { requestCompany } from './company-scope.ts';
import type { CoreContext } from './context.ts';

/** The characters of a temporary password: letters and digits that are not mistaken for others. */
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** How many characters a temporary password has: about 117 bits from the alphabet. */
const PASSWORD_LENGTH = 20;

/** A temporary password from a cryptographic random source, which the admin passes on once. */
export function temporaryPassword(): string {
  return Array.from(
    { length: PASSWORD_LENGTH },
    () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)],
  ).join('');
}

/**
 * The user with this id among the users of the request's company, the plant's or the one the
 * input names in company settings, or NotFoundException: a user of another company reads as one
 * that does not exist.
 */
export async function userOfCompany(
  context: Pick<CoreContext, 'tx' | 'plantId'>,
  input: { readonly id: string; readonly companyId?: string },
): Promise<UserRecord> {
  const { id } = input;
  const companyId = (await requestCompany(input, context)) ?? '';
  const user = await companyUsers(context.tx, companyId).where('id', '=', id).executeTakeFirst();
  if (!user) throw new NotFoundException(`User ${id} was not found`);
  return user;
}

/** The user with this id of the company as core.user_directory reads it now. */
export function userById(
  tx: Transaction<CoreDatabase>,
  id: string,
  companyId: string,
): Promise<UserRecord> {
  return companyUsers(tx, companyId).where('id', '=', id).executeTakeFirstOrThrow();
}

/**
 * Refuses with core.forbidden unless the principal holds `permission` at every company the user
 * belongs to (ADR 0011): a block or a new password holds in every company, so an admin of one
 * company cannot lock the user out of another, lift a block that another company's admin set, or
 * take over the account of a user of another company.
 */
export async function refuseOtherCompanies(
  context: Pick<CoreContext, 'tx'>,
  id: string,
  permission: 'core.user:block' | 'core.user:resetPassword',
): Promise<void> {
  const principal = currentPrincipal();
  if (!principal) throw forbidden('Users are changed only by a signed-in user');
  const companies = await context.tx
    .selectFrom('core.company_user')
    .select('company_id')
    .distinct()
    .where('user_id', '=', id)
    .execute();
  if (companies.every(({ company_id }) => can(principal, permission, company_id))) return;
  throw forbidden(
    permission === 'core.user:block'
      ? 'The user also belongs to a company where you cannot block users. Ask an admin of each of their companies.'
      : 'The user also belongs to a company where you cannot reset passwords. Ask an admin of each of their companies.',
  );
}

/**
 * Refuses with core.role_not_held, whose details name the scope and the permissions, when the user
 * holds an installed permission at a scope where the principal does not hold it, there or above
 * (ADR 0010). A new password lets the resetter sign in as the user, so a reset must not hand the
 * resetter more than they hold: a custom role with core.user:resetPassword does not reach a
 * Company admin. The user's grants are read through core.principal_grants, which sees the roles of
 * every company of the user, as the user's own principal does.
 */
export async function refuseUserHoldingMore(
  context: Pick<CoreContext, 'tx'>,
  user: Pick<UserRecord, 'id' | 'name'>,
): Promise<void> {
  const principal = currentPrincipal();
  if (!principal) throw forbidden('Users are changed only by a signed-in user');
  const { rows } = await sql<{ id: string; permissions: string[] }>`
    select id, permissions from core.principal_grants(${user.id}) order by id`.execute(context.tx);
  for (const { id: scopeId, permissions } of rows) {
    const missing = permissions.filter((key) => !can(principal, key, scopeId));
    if (missing.length === 0) continue;
    const place = await context.tx
      .selectFrom('core.scope as s')
      .leftJoin('core.company as c', 'c.id', 's.id')
      .leftJoin('core.plant as p', 'p.id', 's.id')
      .select(['c.name as companyName', 'p.name as plantName'])
      .where('s.id', '=', scopeId)
      .executeTakeFirst();
    const at = place?.companyName ?? place?.plantName ?? 'another company';
    throw new DomainError({
      code: 'core.role_not_held',
      status: HttpStatus.FORBIDDEN,
      message: `${user.name} holds ${missing.join(', ')} at ${at}, which you do not hold there. Ask an admin who holds them to reset the password.`,
      details: { scopeId, missingPermissions: missing },
    });
  }
}
