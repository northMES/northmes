// SPDX-License-Identifier: AGPL-3.0-or-later
import { NotFoundException } from '@nestjs/common';
import type { createRole } from '@northmes/core-contracts';
import type { z } from 'zod';
import { type RoleRecord, roleColumns } from '../role.service.ts';
import { companyOfPlant } from './company-scope.ts';
import type { CoreContext } from './context.ts';
import { normalizedPermissions, refuseTakenName, refuseUnknownPermissions } from './role-rules.ts';

/**
 * The handler of core.createRole (ADR 0012), which the mutation coreCreateRole sends through the
 * command bus after it checked core.role:manage at the company of the request's plant. It writes
 * a custom role of that company under the client's id and returns it with version 1, or returns
 * the role a first run with that id created.
 */
export const createRoleHandler = {
  scope: companyOfPlant,
  async handle(
    { id, name, permissions }: z.output<typeof createRole.input>,
    context: CoreContext,
  ): Promise<RoleRecord> {
    const { tx } = context;
    // The bus ran the scope hook and refused a request without a company before the handler ran.
    const companyId = (await companyOfPlant(undefined, context)) ?? '';
    // A retry after a timeout or a restart finds the role the first run created (ADR 0012).
    const first = await tx
      .selectFrom('core.role')
      .select([...roleColumns, 'company_id'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (first) {
      if (first.company_id !== companyId) throw new NotFoundException(`Role ${id} was not found`);
      const { company_id: _company, ...role } = first;
      return role;
    }
    const keys = normalizedPermissions(permissions);
    await refuseTakenName(tx, { companyId, name });
    await refuseUnknownPermissions(tx, keys);
    return tx
      .insertInto('core.role')
      .values({
        id,
        company_id: companyId,
        key: `custom-${id}`,
        name,
        permissions: keys,
        origin: 'custom',
      })
      .returning(roleColumns)
      .executeTakeFirstOrThrow();
  },
};
