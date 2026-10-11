// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import type { blockUser, unblockUser } from '@northmes/core-contracts';
import { DomainError } from '@northmes/sdk/errors';
import type { z } from 'zod';
import { currentPrincipal } from '../../../../principal.ts';
import { userAccounts } from '../access/user-accounts.ts';
import type { UserRecord } from '../user.service.ts';
import { requestCompany } from './company-scope.ts';
import type { CoreContext } from './context.ts';
import { refuseBlockingLastAdmin } from './last-admin.ts';
import { refuseOtherCompanies, userById, userOfCompany } from './user-rules.ts';

/**
 * The handler of core.blockUser (ADR 0012), which the mutation coreBlockUser sends through the
 * command bus after it checked core.user:block at the request's company. The user's
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
  scope: requestCompany,
  async handle(input: z.output<typeof blockUser.input>, context: CoreContext): Promise<UserRecord> {
    const { id, reason } = input;
    const user = await userOfCompany(context, input);
    if (currentPrincipal()?.userId === id) {
      throw new DomainError({
        code: 'core.cannot_block_self',
        status: HttpStatus.PRECONDITION_FAILED,
        message: 'You cannot block yourself. Ask another admin of the company.',
      });
    }
    await refuseOtherCompanies(context, id, 'core.user:block');
    await refuseBlockingLastAdmin(context.tx, id);
    await userAccounts().block(id, reason);
    return userById(context.tx, id, user.companyId ?? '');
  },
};

/**
 * The handler of core.unblockUser (ADR 0012), which the mutation coreUnblockUser sends through the
 * command bus after it checked core.user:block at the request's company. The user's
 * other companies need it too. The user can sign in again. Like a block, an unblock may run again.
 */
export const unblockUserHandler = {
  scope: requestCompany,
  async handle(
    input: z.output<typeof unblockUser.input>,
    context: CoreContext,
  ): Promise<UserRecord> {
    const { id } = input;
    const user = await userOfCompany(context, input);
    await refuseOtherCompanies(context, id, 'core.user:block');
    await userAccounts().unblock(id);
    return userById(context.tx, id, user.companyId ?? '');
  },
};
