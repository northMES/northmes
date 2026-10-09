// SPDX-License-Identifier: AGPL-3.0-or-later
import { NotFoundException } from '@nestjs/common';
import type { Transaction } from 'kysely';
import { currentPrincipal } from '../../../../principal.ts';
import type { CoreDatabase } from '../../infrastructure/database.ts';
import { forbidden } from '../access/request-scope.ts';
import type { RoleAssignmentRecord } from '../role-assignment.service.ts';
import { companyOfPlant } from './company-scope.ts';
import type { CoreContext } from './context.ts';
import { refuseUnheldPermissions } from './role-rules.ts';

/**
 * The scopes where a request changes role assignments: its plant and the plant's company, never
 * another plant, as it reads them (ADR 0008). Empty for a request without a plant.
 */
export async function assignableScopes(
  context: Pick<CoreContext, 'tx' | 'plantId'>,
): Promise<string[]> {
  const companyId = await companyOfPlant(undefined, context);
  return context.plantId && companyId ? [companyId, context.plantId] : [];
}

/**
 * The grant rule of ADR 0010 for an assignment of `roleId` at `scopeId`: the principal must hold
 * every installed permission of the role there, or at a scope above it, else core.role_not_held. A
 * permission whose module is not installed grants nothing, so it is not handed out either.
 */
export async function refuseRoleNotHeld(
  tx: Transaction<CoreDatabase>,
  { roleId, scopeId }: { roleId: string; scopeId: string },
): Promise<void> {
  const principal = currentPrincipal();
  if (!principal) throw forbidden('Role assignments change only for a signed-in user');
  const role = await tx
    .selectFrom('core.role')
    .select('permissions')
    .where('id', '=', roleId)
    .executeTakeFirstOrThrow();
  const installed =
    role.permissions.length === 0
      ? []
      : await tx
          .selectFrom('core.permission')
          .select('key')
          .where('key', 'in', role.permissions)
          .where('installed', '=', true)
          .orderBy('key')
          .execute();
  refuseUnheldPermissions(
    principal,
    installed.map(({ key }) => key),
    scopeId,
  );
}

/** The record of the assignment with this id, with its scope's name and its user, or throws. */
export async function assignmentRecord(
  tx: Transaction<CoreDatabase>,
  id: string,
): Promise<RoleAssignmentRecord> {
  const row = await tx
    .selectFrom('core.role_assignment as a')
    .innerJoin('core.scope as s', 's.id', 'a.scope_id')
    .leftJoin('core.company as c', 'c.id', 'a.scope_id')
    .leftJoin('core.plant as p', 'p.id', 'a.scope_id')
    .innerJoin('core.user_directory as u', 'u.id', 'a.user_id')
    .select([
      'a.id',
      'a.role_id as roleId',
      'a.scope_id as scopeId',
      's.kind',
      'c.name as companyName',
      'p.name as plantName',
      'u.id as userId',
      'u.name',
      'u.username',
      'u.banned',
    ])
    .where('a.id', '=', id)
    .executeTakeFirst();
  if (!row) throw new NotFoundException(`Role assignment ${id} was not found`);
  return {
    id: row.id,
    roleId: row.roleId,
    scope: { id: row.scopeId, kind: row.kind, name: row.companyName ?? row.plantName ?? '' },
    user: { id: row.userId, name: row.name, username: row.username, blocked: row.banned },
  };
}
