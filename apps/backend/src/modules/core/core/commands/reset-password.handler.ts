// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import type { resetPassword } from '@northmes/core-contracts';
import { DomainError } from '@northmes/sdk/errors';
import type { z } from 'zod';
import { currentPrincipal } from '../../../../principal.ts';
import { userAccounts } from '../access/user-accounts.ts';
import type { UserRecord } from '../user.service.ts';
import { requestCompany } from './company-scope.ts';
import type { CoreContext } from './context.ts';
import {
  refuseOtherCompanies,
  refuseUserHoldingMore,
  temporaryPassword,
  userById,
  userOfCompany,
} from './user-rules.ts';

/** A user whose password core.resetPassword reset, with the temporary password shown once. */
export interface PasswordResetRecord {
  readonly user: UserRecord;
  readonly temporaryPassword: string;
}

/**
 * The handler of core.resetPassword (ADR 0012), which the mutation coreResetPassword sends through
 * the command bus after it checked core.user:resetPassword at the request's company. The user's
 * other companies need it too, since a password holds everywhere. It sets a fresh temporary
 * password through Better Auth, which marks the user as needing a new password and ends their
 * sessions, and returns the password once; NorthMES keeps no copy it can read (design core-304,
 * US15 to US18). Resetting your own password is refused with core.cannot_reset_own_password, as
 * blocking yourself is, and a blocked user's with core.user_blocked. Since the temporary password
 * lets the resetter sign in as the user, a user who holds a permission the resetter does not hold
 * at some scope is refused with core.role_not_held. The reason is accepted and
 * recorded once the audit trail arrives (#443).
 *
 * Better Auth writes on its own pool, outside the command's transaction. A retry sets another
 * temporary password, which replaces the first one, so only the last answer's password works.
 */
export const resetPasswordHandler = {
  scope: requestCompany,
  async handle(
    input: z.output<typeof resetPassword.input>,
    context: CoreContext,
  ): Promise<PasswordResetRecord> {
    const { id } = input;
    const user = await userOfCompany(context, input);
    if (currentPrincipal()?.userId === id) {
      throw new DomainError({
        code: 'core.cannot_reset_own_password',
        status: HttpStatus.PRECONDITION_FAILED,
        message: 'You cannot reset your own password here. Ask another admin of the company.',
      });
    }
    if (user.blocked) {
      throw new DomainError({
        code: 'core.user_blocked',
        status: HttpStatus.PRECONDITION_FAILED,
        message: `${user.name} is blocked. Unblock the user before you reset the password.`,
      });
    }
    await refuseOtherCompanies(context, id, 'core.user:resetPassword');
    await refuseUserHoldingMore(context, user);
    const password = temporaryPassword();
    await userAccounts().setPassword(id, password, { temporary: true });
    return {
      user: await userById(context.tx, id, user.companyId ?? ''),
      temporaryPassword: password,
    };
  },
};
