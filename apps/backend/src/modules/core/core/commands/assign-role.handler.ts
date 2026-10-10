// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus, NotFoundException } from '@nestjs/common';
import type { assignRole } from '@northmes/core-contracts';
import { DomainError } from '@northmes/sdk/errors';
import type { z } from 'zod';
import type { RoleAssignmentRecord } from '../role-assignment.service.ts';
import { requestCompany } from './company-scope.ts';
import type { CoreContext } from './context.ts';
import { assignableScopes, assignmentRecord, refuseRoleNotHeld } from './role-assignment-rules.ts';

type AssignRoleInput = z.output<typeof assignRole.input>;

/**
 * The handler of core.assignRole (ADR 0012), which the mutation coreAssignRole sends through the
 * command bus. Its scope hook names the scope of the assignment, the request's plant or its
 * company, or in company settings the company the input names or one of its plants (ADR 0066),
 * where the bus checks core.roleAssignment:manage; the handler then applies the grant rule
 * of ADR 0010 there. It writes the assignment under the client's id and returns it, or returns the
 * assignment a first run with that id wrote. It applies from the user's next request.
 */
export const assignRoleHandler = {
  async scope(input: AssignRoleInput, context: Pick<CoreContext, 'tx' | 'plantId'>) {
    const scopes = await assignableScopes(context, input);
    return scopes.includes(input.scopeId) ? input.scopeId : undefined;
  },
  async handle(input: AssignRoleInput, context: CoreContext): Promise<RoleAssignmentRecord> {
    const { id, userId, roleId, scopeId } = input;
    const { tx } = context;
    const companyId = (await requestCompany(input, context)) ?? '';
    // A retry after a timeout or a restart finds the assignment the first run wrote (ADR 0012).
    const first = await tx
      .selectFrom('core.role_assignment')
      .select('company_id')
      .where('id', '=', id)
      .executeTakeFirst();
    if (first) {
      if (first.company_id !== companyId) {
        throw new NotFoundException(`Role assignment ${id} was not found`);
      }
      return assignmentRecord(tx, id);
    }
    const role = await tx
      .selectFrom('core.role')
      .select('name')
      .where('id', '=', roleId)
      .where('company_id', '=', companyId)
      .executeTakeFirst();
    if (!role) throw new NotFoundException(`Role ${roleId} was not found`);
    const user = await tx
      .selectFrom('core.company_user')
      .select('user_id')
      .where('company_id', '=', companyId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (!user) throw new NotFoundException(`User ${userId} was not found`);
    await refuseRoleNotHeld(tx, { roleId, scopeId });
    const held = await tx
      .selectFrom('core.role_assignment')
      .select('id')
      .where('user_id', '=', userId)
      .where('role_id', '=', roleId)
      .where('scope_id', '=', scopeId)
      .executeTakeFirst();
    if (held) {
      throw new DomainError({
        code: 'core.role_already_assigned',
        status: HttpStatus.CONFLICT,
        message: `The user holds ${role.name} there already.`,
        details: { assignmentId: held.id },
      });
    }
    await tx
      .insertInto('core.role_assignment')
      .values({ id, user_id: userId, company_id: companyId, scope_id: scopeId, role_id: roleId })
      .execute();
    return assignmentRecord(tx, id);
  },
};
