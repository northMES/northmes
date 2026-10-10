// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomInt } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import type { Transaction } from 'kysely';
import type { CoreDatabase } from '../../infrastructure/database.ts';
import { companyUsers, type UserRecord } from '../user.service.ts';
import { requestCompany } from './company-scope.ts';
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
 * The user with this id among the users of the request's company, the plant's or the one the
 * input names in company settings, or NotFoundException: a user of another company reads as one
 * that does not exist.
 */
export async function userOfCompany(
  context: Pick<CoreContext, 'tx' | 'plantId'>,
  input: { readonly id: string; readonly companyId?: string },
): Promise<UserRecord> {
  const { id } = input;
  const companyId = (await requestCompany(input, context)) ?? '';
  const user = await companyUsers(context.tx, companyId).where('id', '=', id).executeTakeFirst();
  if (!user) throw new NotFoundException(`User ${id} was not found`);
  return user;
}

/** The user with this id of the company as core.user_directory reads it now. */
export function userById(
  tx: Transaction<CoreDatabase>,
  id: string,
  companyId: string,
): Promise<UserRecord> {
  return companyUsers(tx, companyId).where('id', '=', id).executeTakeFirstOrThrow();
}
