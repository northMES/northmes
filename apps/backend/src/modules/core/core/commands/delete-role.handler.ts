// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { HttpStatus } from '@nestjs/common';
import type { deleteRole } from '@northmes/core-contracts';
import { DomainError } from '@northmes/sdk/errors';
import { sql } from 'kysely';
import type { z } from 'zod';
import { type RoleRecord, roleColumns } from '../role.service.ts';
import type { CoreContext } from './context.ts';
import { refuseCompanyAdminRoleChange } from './last-admin.ts';
import { type RoleRow, refuseDefaultRole, roleTarget } from './role-target.ts';

/**
 * The handler of core.deleteRole (ADR 0012), which the mutation coreDeleteRole sends through the
 * command bus after it checked core.role:manage at the role's company. It deletes a custom role
 * that nobody holds and returns it as it was. A role that a user or an integration token that is
 * not revoked holds is refused with core.role_in_use: its holders lose its permissions only when
 * their assignments are removed or the token is revoked.
 * Company admin is refused with core.last_admin, another default role with core.role_not_custom.
 */
export const deleteRoleHandler = {
  target: roleTarget,
  async handle(
    { id }: z.output<typeof deleteRole.input>,
    { tx, target }: CoreContext<RoleRow>,
  ): Promise<RoleRecord> {
    refuseCompanyAdminRoleChange(target);
    refuseDefaultRole(target);
    const held = await tx
      .selectFrom('core.role_assignment')
      .select('id')
      .where('role_id', '=', id)
      .executeTakeFirst();
    // An integration token that is not revoked holds its roles too (ADR 0073).
    const heldByToken = await tx
      .selectFrom('core.credential')
      .select('id')
      .where(sql<boolean>`${id}::uuid = any (role_ids)`)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    if (held || heldByToken) {
      throw new DomainError({
        code: 'core.role_in_use',
        status: HttpStatus.PRECONDITION_FAILED,
        message: held
          ? `${target.name} is held by someone, so it cannot be deleted. Remove it from everyone who holds it first.`
          : `${target.name} is held by an integration token, so it cannot be deleted. Revoke the tokens that hold it first.`,
      });
    }
    return tx
      .deleteFrom('core.role')
      .where('id', '=', id)
      .returning(roleColumns)
      .executeTakeFirstOrThrow();
  },
};
