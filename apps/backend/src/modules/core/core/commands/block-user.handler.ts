// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import type { blockUser, unblockUser } from '@northmes/core-contracts';
import { DomainError } from '@northmes/sdk/errors';
import type { z } from 'zod';
import { currentPrincipal } from '../../../../principal.ts';
import { userAccounts } from '../access/user-accounts.ts';
import type { UserRecord } from '../user.service.ts';
import { companyOfPlant } from './company-scope.ts';
import type { CoreContext } from './context.ts';
import { userById, userOfCompany } from './user-rules.ts';

/**
 * The handler of core.blockUser (ADR 0012), which the mutation coreBlockUser sends through the
 * command bus after it checked core.user:block at the company of the request's plant. It blocks a
 * user of the company through Better Auth: the user cannot sign in, their sessions end, and their
 * next request is refused. Blocking yourself is refused with core.cannot_block_self.
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
    await userAccounts().block(id, reason);
    return userById(context.tx, id);
  },
};

/**
 * The handler of core.unblockUser (ADR 0012), which the mutation coreUnblockUser sends through the
 * command bus after it checked core.user:block at the company of the request's plant. The user can
 * sign in again.
 */
export const unblockUserHandler = {
  scope: companyOfPlant,
  async handle(
    { id }: z.output<typeof unblockUser.input>,
    context: CoreContext,
  ): Promise<UserRecord> {
    await userOfCompany(context, id);
    await userAccounts().unblock(id);
    return userById(context.tx, id);
  },
};
