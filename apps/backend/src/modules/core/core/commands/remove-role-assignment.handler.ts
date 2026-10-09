// SPDX-License-Identifier: AGPL-3.0-or-later
import { NotFoundException } from '@nestjs/common';
import type { removeRoleAssignment } from '@northmes/core-contracts';
import type { z } from 'zod';
import type { RoleAssignmentRecord } from '../role-assignment.service.ts';
import type { CoreContext } from './context.ts';
import { assignableScopes, assignmentRecord, refuseRoleNotHeld } from './role-assignment-rules.ts';

type RemoveRoleAssignmentInput = z.output<typeof removeRoleAssignment.input>;

/**
 * The handler of core.removeRoleAssignment (ADR 0012), which the mutation
 * coreRemoveRoleAssignment sends through the command bus. Its scope hook names the assignment's
 * scope, where the bus checks core.roleAssignment:manage; an assignment that does not exist, or is
 * at neither the request's plant nor its company, is not found. The handler applies the grant rule
 * of ADR 0010 there, deletes the assignment and returns it as it was. The user loses its
 * permissions from their next request. The reason is not recorded until the audit trail arrives
 * (ADR 0013).
 */
export const removeRoleAssignmentHandler = {
  async scope(
    { id }: RemoveRoleAssignmentInput,
    context: Pick<CoreContext, 'tx' | 'plantId'>,
  ): Promise<string> {
    const assignment = await context.tx
      .selectFrom('core.role_assignment')
      .select('scope_id')
      .where('id', '=', id)
      .executeTakeFirst();
    const scopes = await assignableScopes(context);
    if (!assignment || !scopes.includes(assignment.scope_id)) {
      throw new NotFoundException(`Role assignment ${id} was not found`);
    }
    return assignment.scope_id;
  },
  async handle(
    { id }: RemoveRoleAssignmentInput,
    { tx }: CoreContext,
  ): Promise<RoleAssignmentRecord> {
    const assignment = await tx
      .selectFrom('core.role_assignment')
      .select(['role_id', 'scope_id'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!assignment) throw new NotFoundException(`Role assignment ${id} was not found`);
    await refuseRoleNotHeld(tx, { roleId: assignment.role_id, scopeId: assignment.scope_id });
    const record = await assignmentRecord(tx, id);
    // nm_app may not update assignments, so it cannot lock the row first; a second removal that
    // ran in between deleted it, and this one finds nothing to delete.
    const deleted = await tx
      .deleteFrom('core.role_assignment')
      .where('id', '=', id)
      .executeTakeFirst();
    if (deleted.numDeletedRows === 0n) {
      throw new NotFoundException(`Role assignment ${id} was not found`);
    }
    return record;
  },
};
