// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomInt } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import type { Transaction } from 'kysely';
import type { CoreDatabase } from '../../infrastructure/database.ts';
import { companyUsers, type UserRecord } from '../user.service.ts';
import { companyOfPlant } from './company-scope.ts';
import type { CoreContext } from './context.ts';

/** The characters of a temporary password: letters and digits that are not mistaken for others. */
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** How many characters a temporary password has: about 117 bits from the alphabet. */
const PASSWORD_LENGTH = 20;

/** A temporary password from a cryptographic random source, which the admin passes on once. */
export function temporaryPassword(): string {
  return Array.from(
    { length: PASSWORD_LENGTH },
    () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)],
  ).join('');
}

/**
 * The user with this id among the users of the company of the request's plant, or
 * NotFoundException: a user of another company reads as one that does not exist.
 */
export async function userOfCompany(
  context: Pick<CoreContext, 'tx' | 'plantId'>,
  id: string,
): Promise<UserRecord> {
  const companyId = (await companyOfPlant(undefined, context)) ?? '';
  const user = await companyUsers(context.tx, companyId).where('id', '=', id).executeTakeFirst();
  if (!user) throw new NotFoundException(`User ${id} was not found`);
  return user;
}

/** The user with this id as core.user_directory reads it now. */
export function userById(tx: Transaction<CoreDatabase>, id: string): Promise<UserRecord> {
  return tx
    .selectFrom('core.user_directory')
    .select(['id', 'name', 'username', 'banned as blocked'])
    .where('id', '=', id)
    .executeTakeFirstOrThrow();
}
