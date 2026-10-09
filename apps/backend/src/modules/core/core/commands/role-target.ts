// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@northmes/sdk/errors';
import { type Selectable, sql, type Transaction } from 'kysely';
import type { CoreDatabase, RoleTable } from '../../infrastructure/database.ts';
import type { CoreContext } from './context.ts';

/**
 * The role row that a core command on an existing role acts on, with its company as the scope the
 * bus checks the command's permission at: a role belongs to its company (ADR 0010).
 */
export type RoleRow = Selectable<RoleTable> & { readonly scope_id: string };

/**
 * Takes the role's lock until the transaction ends. A change to a role and an assignment or removal
 * of it take it before they read the role, so the grant rule of ADR 0010 never reads permissions
 * that a change in flight is replacing, and a change never misses an assignment in flight. It is a
 * transaction-level advisory lock on the role's id: a row lock would need the UPDATE policy of
 * core.role, which a plant admin who assigns the role does not pass.
 */
export async function lockRole(tx: Transaction<CoreDatabase>, id: string): Promise<void> {
  await sql`select pg_advisory_xact_lock(hashtextextended(${`core.role:${id}`}, 0))`.execute(tx);
}

/**
 * The target of a core command on an existing role (ADR 0012). The bus reads the role's company and
 * checks the permission there, so core.role:manage at a plant does not reach a role of the company,
 * then takes the role's lock, locks the row and checks its version.
 */
export const roleTarget = {
  entity: 'Role',
  scopeOf: async (id: string, { tx }: Pick<CoreContext, 'tx'>) =>
    (await tx.selectFrom('core.role').select('company_id').where('id', '=', id).executeTakeFirst())
      ?.company_id,
  load: async (id: string, { tx }: Pick<CoreContext, 'tx'>): Promise<RoleRow | undefined> => {
    await lockRole(tx, id);
    return tx
      .selectFrom('core.role')
      .selectAll()
      .select('company_id as scope_id')
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
  },
};

/**
 * Refuses a change to a module's default role with core.role_not_custom: northmes migrate keeps
 * default roles as their modules declare them.
 */
export function refuseDefaultRole(role: RoleRow): void {
  if (role.origin === 'custom') return;
  throw new DomainError({
    code: 'core.role_not_custom',
    status: HttpStatus.PRECONDITION_FAILED,
    message: `${role.name} is a default role of module ${role.module_id}, and a default role cannot be changed. Make a new role from it instead.`,
  });
}
