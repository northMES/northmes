// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@northmes/sdk/errors';
import type { Selectable } from 'kysely';
import type { RoleTable } from '../../infrastructure/database.ts';
import type { CoreContext } from './context.ts';

/**
 * The role row that a core command on an existing role acts on, with its company as the scope the
 * bus checks the command's permission at: a role belongs to its company (ADR 0010).
 */
export type RoleRow = Selectable<RoleTable> & { readonly scope_id: string };

/**
 * The target of a core command on an existing role (ADR 0012). The bus reads the role's company and
 * checks the permission there, so core.role:manage at a plant does not reach a role of the company,
 * then locks the row and checks its version.
 */
export const roleTarget = {
  entity: 'Role',
  scopeOf: async (id: string, { tx }: Pick<CoreContext, 'tx'>) =>
    (await tx.selectFrom('core.role').select('company_id').where('id', '=', id).executeTakeFirst())
      ?.company_id,
  load: (id: string, { tx }: Pick<CoreContext, 'tx'>): Promise<RoleRow | undefined> =>
    tx
      .selectFrom('core.role')
      .selectAll()
      .select('company_id as scope_id')
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst(),
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
