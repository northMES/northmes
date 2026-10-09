// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@northmes/sdk/errors';
import { sql, type Transaction } from 'kysely';
import type { CoreDatabase } from '../../infrastructure/database.ts';
import { companyAdminRoleKey } from '../../permissions.ts';
import type { RoleRow } from './role-target.ts';

// Every company keeps at least one active Company admin: a user who is not blocked and holds core's
// Company admin role through an assignment at the company node. Company admin assigned at a plant
// does not count. Removing such an assignment and blocking such a user take the company's lock
// first, so two admins who remove or block each other at once leave one.

function lastAdmin(message: string): DomainError {
  return new DomainError({
    code: 'core.last_admin',
    status: HttpStatus.PRECONDITION_FAILED,
    message,
  });
}

/** True for core's Company admin role, which northmes migrate keeps as core declares it. */
function isCompanyAdminRole(role: { readonly key: string; readonly origin: string }): boolean {
  return role.origin === 'module' && role.key === companyAdminRoleKey;
}

/**
 * Takes the lock of the company's Company admins until the transaction ends. Read committed lets
 * each statement after it see what the transaction that held the lock before committed.
 */
async function lockCompanyAdmins(tx: Transaction<CoreDatabase>, companyId: string): Promise<void> {
  await sql`select pg_advisory_xact_lock(hashtextextended(${`core.company-admins:${companyId}`}, 0))`.execute(
    tx,
  );
}

/** The number of active Company admins of the company other than the user. */
async function otherActiveAdmins(
  tx: Transaction<CoreDatabase>,
  { companyId, userId }: { companyId: string; userId: string },
): Promise<number> {
  const row = await tx
    .selectFrom('core.role_assignment as a')
    .innerJoin('core.role as r', 'r.id', 'a.role_id')
    .innerJoin('core.user_directory as u', 'u.id', 'a.user_id')
    .select((eb) => eb.fn.count<string>('a.user_id').distinct().as('count'))
    .where('r.company_id', '=', companyId)
    .where('r.origin', '=', 'module')
    .where('r.key', '=', companyAdminRoleKey)
    .whereRef('a.scope_id', '=', 'r.company_id')
    .where('u.banned', '=', false)
    .where('a.user_id', '<>', userId)
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

/** The user's name and whether they are blocked. */
async function userOf(tx: Transaction<CoreDatabase>, userId: string) {
  return tx
    .selectFrom('core.user_directory')
    .select(['name', 'banned'])
    .where('id', '=', userId)
    .executeTakeFirstOrThrow();
}

/** The company's name. */
async function companyName(tx: Transaction<CoreDatabase>, companyId: string): Promise<string> {
  const company = await tx
    .selectFrom('core.company')
    .select('name')
    .where('id', '=', companyId)
    .executeTakeFirst();
  return company?.name ?? 'the company';
}

/**
 * Refuses with core.last_admin to remove the assignment when it is the Company admin assignment at
 * the company node of the company's last active Company admin, also when the admin removes their
 * own.
 */
export async function refuseRemovingLastAdmin(
  tx: Transaction<CoreDatabase>,
  assignment: { readonly userId: string; readonly roleId: string; readonly scopeId: string },
): Promise<void> {
  const role = await tx
    .selectFrom('core.role')
    .select(['key', 'origin', 'company_id'])
    .where('id', '=', assignment.roleId)
    .executeTakeFirstOrThrow();
  if (!isCompanyAdminRole(role) || assignment.scopeId !== role.company_id) return;
  await lockCompanyAdmins(tx, role.company_id);
  const user = await userOf(tx, assignment.userId);
  if (user.banned) return;
  const others = await otherActiveAdmins(tx, {
    companyId: role.company_id,
    userId: assignment.userId,
  });
  if (others > 0) return;
  const company = await companyName(tx, role.company_id);
  throw lastAdmin(
    `${user.name} is the last active Company admin of ${company}, so Company admin cannot be removed from them. Give Company admin at ${company} to someone else first.`,
  );
}

/**
 * Refuses with core.last_admin to block a user who is the last active Company admin of any of
 * their companies. A block holds in every company, so each company where the user holds Company
 * admin at the company node is checked, its lock taken in the order of the company ids.
 */
export async function refuseBlockingLastAdmin(
  tx: Transaction<CoreDatabase>,
  userId: string,
): Promise<void> {
  const user = await userOf(tx, userId);
  if (user.banned) return;
  const companies = await tx
    .selectFrom('core.role_assignment as a')
    .innerJoin('core.role as r', 'r.id', 'a.role_id')
    .select('r.company_id')
    .distinct()
    .where('a.user_id', '=', userId)
    .where('r.origin', '=', 'module')
    .where('r.key', '=', companyAdminRoleKey)
    .whereRef('a.scope_id', '=', 'r.company_id')
    .orderBy('r.company_id')
    .execute();
  for (const { company_id } of companies) await lockCompanyAdmins(tx, company_id);
  for (const { company_id } of companies) {
    if ((await otherActiveAdmins(tx, { companyId: company_id, userId })) > 0) continue;
    const company = await companyName(tx, company_id);
    throw lastAdmin(
      `${user.name} is the last active Company admin of ${company}, so they cannot be blocked. Give Company admin at ${company} to someone else first.`,
    );
  }
}

/**
 * Refuses with core.last_admin a change to or the deletion of core's Company admin role: it holds
 * every installed permission, which northmes migrate keeps, so every company has someone who can
 * administer it.
 */
export function refuseCompanyAdminRoleChange(role: RoleRow): void {
  if (!isCompanyAdminRole(role)) return;
  throw lastAdmin(
    'Company admin holds every installed permission so that someone can always administer the company. It cannot be changed or deleted. Make a new role from it instead.',
  );
}
