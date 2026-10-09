// SPDX-License-Identifier: AGPL-3.0-or-later
import type { updateRole } from '@northmes/core-contracts';
import type { z } from 'zod';
import { currentPrincipal } from '../../../../principal.ts';
import { forbidden } from '../access/request-scope.ts';
import { type RoleRecord, roleColumns } from '../role.service.ts';
import type { CoreContext } from './context.ts';
import { refuseCompanyAdminRoleChange } from './last-admin.ts';
import {
  normalizedPermissions,
  refuseTakenName,
  refuseUnheldPermissions,
  refuseUnknownPermissions,
} from './role-rules.ts';
import { type RoleRow, refuseDefaultRole, roleTarget } from './role-target.ts';

/**
 * The handler of core.updateRole (ADR 0012), which the mutation coreUpdateRole sends through the
 * command bus after it checked core.role:manage at the role's company. It changes the name and the
 * permissions of a custom role and returns it with its new version. Each permission it adds must
 * be held by the editor at every scope where the role is assigned (ADR 0010). Company admin is
 * refused with core.last_admin, another default role with core.role_not_custom.
 */
export const updateRoleHandler = {
  target: roleTarget,
  async handle(
    { id, name, permissions }: z.output<typeof updateRole.input>,
    { tx, target }: CoreContext<RoleRow>,
  ): Promise<RoleRecord> {
    refuseCompanyAdminRoleChange(target);
    refuseDefaultRole(target);
    const principal = currentPrincipal();
    if (!principal) throw forbidden('core.updateRole runs only for a signed-in user');
    const keys = normalizedPermissions(permissions);
    await refuseTakenName(tx, { companyId: target.company_id, name, exceptId: id });
    await refuseUnknownPermissions(tx, keys, target.permissions);
    const added = keys.filter((key) => !target.permissions.includes(key));
    if (added.length > 0) {
      const scopes = await tx
        .selectFrom('core.role_assignment')
        .select('scope_id')
        .distinct()
        .where('role_id', '=', id)
        .orderBy('scope_id')
        .execute();
      for (const { scope_id } of scopes) refuseUnheldPermissions(principal, added, scope_id);
    }
    // The version trigger of core.role bumps version with the update.
    return tx
      .updateTable('core.role')
      .set({ name, permissions: keys })
      .where('id', '=', id)
      .returning(roleColumns)
      .executeTakeFirstOrThrow();
  },
};
