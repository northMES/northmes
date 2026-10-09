// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto';
import { HttpStatus, NotFoundException } from '@nestjs/common';
import type { createUser } from '@northmes/core-contracts';
import { DomainError } from '@northmes/sdk/errors';
import { sql } from 'kysely';
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

/**
 * The refusal of a retry whose first run created the user: the first answer carried the temporary
 * password, which NorthMES cannot show again. Its details name the user, so the client can open
 * the user's page.
 */
function createdPasswordHidden(username: string, userId: string): DomainError {
  return new DomainError({
    code: 'core.user_created_password_hidden',
    status: HttpStatus.CONFLICT,
    message: `The user ${username} was created by an earlier try. NorthMES cannot show the temporary password again.`,
    details: { userId },
  });
}

const EMAIL_TAKEN = 'Another user has this email address. Enter another one.';

/** The namespace of userIdOf, a fixed random uuid. */
const USER_ID_NAMESPACE = Buffer.from('6b1f0c2e9d4a4f53a1c7e8b25d3f9a60', 'hex');

/**
 * The id of the user that the command with this client id creates: the first 16 bytes of the
 * SHA-256 of a fixed namespace and the command id, in the version 4 uuid layout. Better Auth keeps
 * an id it is given only for uuid versions 1 to 5 and makes a new one for the uuidv7 that clients
 * send (ADR 0012), so the user's id is derived from the command's id instead of being it, and every
 * run of the command derives the same one. Version 5 would hash with SHA-1, which code scanning
 * refuses, so the id takes the version 4 layout with 122 bits of SHA-256.
 */
export function userIdOf(commandId: string): string {
  const name = Buffer.from(commandId.toLowerCase(), 'utf8');
  const bytes = createHash('sha256')
    .update(USER_ID_NAMESPACE)
    .update(name)
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The user with this id, which a first run of the command created, or undefined. */
async function firstRunUser(tx: CoreContext['tx'], id: string) {
  const user = await tx
    .selectFrom('core.user_directory')
    .select('username')
    .where('id', '=', id)
    .executeTakeFirst();
  if (!user) return undefined;
  const companies = await tx
    .selectFrom('core.company_user')
    .select('company_id')
    .distinct()
    .where('user_id', '=', id)
    .execute();
  return { username: user.username, companyIds: companies.map(({ company_id }) => company_id) };
}

/**
 * The handler of core.createUser (ADR 0012), which the mutation coreCreateUser sends through the
 * command bus after it checked core.user:create at the company of the request's plant. It creates
 * the user under the id that userIdOf derives from the command's id, with a temporary password,
 * through Better Auth's server API, makes the user a member of the company's organization, and
 * returns the user with the password, which is not stored anywhere NorthMES can read it again.
 *
 * Better Auth writes on its own pool as nm_auth, which the command's transaction cannot join, so
 * the creation is made safe to retry instead (ADR 0012). A retry finds the user of the first run
 * by the derived id. A first run that failed after Better Auth's write left a user who belongs to
 * no company, and nobody saw its password: the retry gives that user a new temporary password, makes them a
 * member and answers as a first run would. A first run that finished made the user a member, and
 * its answer may have shown the password: a retry is refused with core.user_created_password_hidden
 * and the user's id and changes nothing, so no retry resets the password of a user who may have
 * signed in. A retry with another username, or of a user who belongs to another company, is
 * NOT_FOUND.
 */
export const createUserHandler = {
  scope: companyOfPlant,
  async handle(
    { id: commandId, username, name, email }: z.output<typeof createUser.input>,
    context: CoreContext,
  ): Promise<CreatedUserRecord> {
    const { tx } = context;
    const id = userIdOf(commandId);
    const companyId = (await companyOfPlant(undefined, context)) ?? '';
    // Two runs with one id wait for each other, so only one of them writes the user.
    await sql`select pg_advisory_xact_lock(hashtextextended(${`core.create-user:${id}`}, 0))`.execute(
      tx,
    );
    const { organization_id } = await tx
      .selectFrom('core.company')
      .select('organization_id')
      .where('id', '=', companyId)
      .executeTakeFirstOrThrow();
    const accounts = userAccounts();
    const password = temporaryPassword();
    const first = await firstRunUser(tx, id);
    if (first) {
      const ours = first.companyIds.every((company) => company === companyId);
      if (first.username !== username || !ours) {
        throw new NotFoundException(`User ${id} was not found`);
      }
      if (first.companyIds.length > 0) throw createdPasswordHidden(username, id);
      await accounts.setPassword(id, password);
      await accounts.addToOrganization(id, organization_id);
      return { user: await userById(tx, id), temporaryPassword: password };
    }
    const taken = await tx
      .selectFrom('core.user_directory')
      .select('id')
      .where('username', '=', username)
      .executeTakeFirst();
    if (taken) throw usernameTaken(username);
    await accounts
      .createUser({ id, username, password, name, email })
      .catch((error: unknown) => {
        if (!(error instanceof EmailTaken)) throw error;
        throw new DomainError({
          code: 'core.email_taken',
          status: HttpStatus.CONFLICT,
          message: EMAIL_TAKEN,
          fieldErrors: [{ path: ['email'], message: EMAIL_TAKEN, code: 'core.email_taken' }],
        });
      });
    await accounts.addToOrganization(id, organization_id);
    return { user: await userById(tx, id), temporaryPassword: password };
  },
};
