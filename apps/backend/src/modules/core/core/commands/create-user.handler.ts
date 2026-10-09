// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import type { createUser } from '@northmes/core-contracts';
import { DomainError } from '@northmes/sdk/errors';
import type { z } from 'zod';
import { EmailTaken } from '../access/auth.service.ts';
import { userAccounts } from '../access/user-accounts.ts';
import type { UserRecord } from '../user.service.ts';
import { companyOfPlant } from './company-scope.ts';
import type { CoreContext } from './context.ts';
import { temporaryPassword, userById } from './user-rules.ts';

/** A user that core.createUser created, with the temporary password the answer shows once. */
export interface CreatedUserRecord {
  readonly user: UserRecord;
  readonly temporaryPassword: string;
}

/** The refusal of a username that a user has, or had (design core-304, US9). */
function usernameTaken(username: string): DomainError {
  const message = `The username ${username} is taken or was used before. Choose another username.`;
  return new DomainError({
    code: 'core.username_taken',
    status: HttpStatus.CONFLICT,
    message,
    fieldErrors: [{ path: ['username'], message, code: 'core.username_taken' }],
  });
}

const EMAIL_TAKEN = 'Another user has this email address. Enter another one, or leave it empty.';

/**
 * The handler of core.createUser (ADR 0012), which the mutation coreCreateUser sends through the
 * command bus after it checked core.user:create at the company of the request's plant. It creates
 * the user with a temporary password through Better Auth's server API, makes the user a member of
 * the company's organization, and returns the user with the password, which is not stored anywhere
 * NorthMES can read it again. Better Auth writes on its own connection, so a user it created stays
 * when a later step fails.
 */
export const createUserHandler = {
  scope: companyOfPlant,
  async handle(
    { username, name, email }: z.output<typeof createUser.input>,
    context: CoreContext,
  ): Promise<CreatedUserRecord> {
    const { tx } = context;
    const companyId = (await companyOfPlant(undefined, context)) ?? '';
    const taken = await tx
      .selectFrom('core.user_directory')
      .select('id')
      .where('username', '=', username)
      .executeTakeFirst();
    if (taken) throw usernameTaken(username);
    const { organization_id } = await tx
      .selectFrom('core.company')
      .select('organization_id')
      .where('id', '=', companyId)
      .executeTakeFirstOrThrow();
    const accounts = userAccounts();
    const password = temporaryPassword();
    const created = await accounts
      .createUser({ username, password, name, ...(email ? { email } : {}) })
      .catch((error: unknown) => {
        if (!(error instanceof EmailTaken)) throw error;
        throw new DomainError({
          code: 'core.email_taken',
          status: HttpStatus.CONFLICT,
          message: EMAIL_TAKEN,
          fieldErrors: [{ path: ['email'], message: EMAIL_TAKEN, code: 'core.email_taken' }],
        });
      });
    await accounts.addToOrganization(created.user.id, organization_id);
    return { user: await userById(tx, created.user.id), temporaryPassword: password };
  },
};
