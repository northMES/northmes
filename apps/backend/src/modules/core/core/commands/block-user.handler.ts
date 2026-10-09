// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import type { blockUser, unblockUser } from '@northmes/core-contracts';
import { DomainError } from '@northmes/sdk/errors';
import type { z } from 'zod';
import { currentPrincipal } from '../../../../principal.ts';
import { can } from '../access/access.ts';
import { forbidden } from '../access/request-scope.ts';
import { userAccounts } from '../access/user-accounts.ts';
import type { UserRecord } from '../user.service.ts';
import { companyOfPlant } from './company-scope.ts';
import type { CoreContext } from './context.ts';
import { refuseBlockingLastAdmin } from './last-admin.ts';
import { userById, userOfCompany } from './user-rules.ts';

/**
 * Refuses with core.forbidden unless the principal holds core.user:block at every company the user
 * belongs to (ADR 0011): a block holds in every company, so an admin of one company cannot lock
 * the user out of another, or lift a block that another company's admin set.
 */
async function refuseOtherCompanies(context: CoreContext, id: string): Promise<void> {
  const principal = currentPrincipal();
  if (!principal) throw forbidden('Users are blocked only by a signed-in user');
  const companies = await context.tx
    .selectFrom('core.company_user')
    .select('company_id')
    .distinct()
    .where('user_id', '=', id)
    .execute();
  if (companies.every(({ company_id }) => can(principal, 'core.user:block', company_id))) return;
  throw forbidden(
    'The user also belongs to a company where you cannot block users. Ask an admin of each of their companies.',
  );
}

/**
 * The handler of core.blockUser (ADR 0012), which the mutation coreBlockUser sends through the
 * command bus after it checked core.user:block at the company of the request's plant. The user's
 * other companies need it too. It blocks the user through Better Auth: the user cannot sign in,
 * their sessions end, and their next request is refused. Blocking yourself is refused with
 * core.cannot_block_self, and blocking the last active Company admin of a company with
 * core.last_admin.
 *
 * Better Auth writes the block on its own pool, outside the command's transaction, which it cannot
 * join. Both of its writes may run again, and a blocked user passes the last-admin check, so a
 * retry after a run that failed past Better Auth's write finishes the block and answers the same
 * user.
 */
export const blockUserHandler = {
  scope: companyOfPlant,
  async handle(
    { id, reason }: z.output<typeof blockUser.input>,
    context: CoreContext,
  ): Promise<UserRecord> {
    await userOfCompany(context, id);
    if (currentPrincipal()?.userId === id) {
      throw new DomainError({
        code: 'core.cannot_block_self',
        status: HttpStatus.PRECONDITION_FAILED,
        message: 'You cannot block yourself. Ask another admin of the company.',
      });
    }
    await refuseOtherCompanies(context, id);
    await refuseBlockingLastAdmin(context.tx, id);
    await userAccounts().block(id, reason);
    return userById(context.tx, id);
  },
};

/**
 * The handler of core.unblockUser (ADR 0012), which the mutation coreUnblockUser sends through the
 * command bus after it checked core.user:block at the company of the request's plant. The user's
 * other companies need it too. The user can sign in again. Like a block, an unblock may run again.
 */
export const unblockUserHandler = {
  scope: companyOfPlant,
  async handle(
    { id }: z.output<typeof unblockUser.input>,
    context: CoreContext,
  ): Promise<UserRecord> {
    await userOfCompany(context, id);
    await refuseOtherCompanies(context, id);
    await userAccounts().unblock(id);
    return userById(context.tx, id);
  },
};
