// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { updateRole } from '@northmes/core-contracts';
import { sql } from 'kysely';
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
 * be held by the editor at every scope where the role is assigned, to a user or to an integration
 * token that is not revoked (ADR 0010, ADR 0073). Company admin is
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
      const assigned = await tx
        .selectFrom('core.role_assignment')
        .select('scope_id')
        .distinct()
        .where('role_id', '=', id)
        .execute();
      // An integration token that is not revoked holds the role at its binding (ADR 0073).
      const bound = await tx
        .selectFrom('core.credential')
        .select('binding_scope_id as scope_id')
        .distinct()
        .where(sql<boolean>`${id}::uuid = any (role_ids)`)
        .where('revoked_at', 'is', null)
        .execute();
      const scopes = [...new Set([...assigned, ...bound].map(({ scope_id }) => scope_id))].sort();
      for (const scopeId of scopes) refuseUnheldPermissions(principal, added, scopeId);
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
