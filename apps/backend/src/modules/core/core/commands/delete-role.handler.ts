// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import type { deleteRole } from '@northmes/core-contracts';
import { DomainError } from '@northmes/sdk/errors';
import type { z } from 'zod';
import { type RoleRecord, roleColumns } from '../role.service.ts';
import type { CoreContext } from './context.ts';
import { type RoleRow, refuseDefaultRole, roleTarget } from './role-target.ts';

/**
 * The handler of core.deleteRole (ADR 0012), which the mutation coreDeleteRole sends through the
 * command bus after it checked core.role:manage at the role's company. It deletes a custom role
 * that nobody holds and returns it as it was. A role someone holds is refused with
 * core.role_in_use: its holders lose its permissions only when their assignments are removed.
 */
export const deleteRoleHandler = {
  target: roleTarget,
  async handle(
    { id }: z.output<typeof deleteRole.input>,
    { tx, target }: CoreContext<RoleRow>,
  ): Promise<RoleRecord> {
    refuseDefaultRole(target);
    const held = await tx
      .selectFrom('core.role_assignment')
      .select('id')
      .where('role_id', '=', id)
      .executeTakeFirst();
    if (held) {
      throw new DomainError({
        code: 'core.role_in_use',
        status: HttpStatus.PRECONDITION_FAILED,
        message: `${target.name} is held by someone, so it cannot be deleted. Remove it from everyone who holds it first.`,
      });
    }
    return tx
      .deleteFrom('core.role')
      .where('id', '=', id)
      .returning(roleColumns)
      .executeTakeFirstOrThrow();
  },
};
