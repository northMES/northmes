// SPDX-License-Identifier: MIT
import { defineCommandContract } from '@northmes/contracts';
import { z } from 'zod';
import { tooLong } from './messages.ts';
import { accessReason } from './role.ts';

/**
 * A username, which a user signs in with (ADR 0010): 3 to 30 letters, digits, dots and
 * underscores, stored in lower case. It never changes and is never given to anyone else.
 */
export const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'A username can be 3 to 30 characters.')
  .max(30, 'A username can be 3 to 30 characters.')
  .regex(/^[a-z0-9._]+$/, 'Use letters, digits, dots and underscores.');

/**
 * Creates a user of the company of the request's plant, with a temporary password that the answer
 * shows once (ADR 0010). It needs core.user:create at the company. Without an email the user gets
 * a placeholder address that no mail reaches. A username that is taken, or was used before, is
 * refused with core.username_taken, and an email another user has with core.email_taken.
 */
export const createUser = defineCommandContract({
  name: 'core.createUser',
  target: 'none',
  fields: z.object({
    username,
    name: z
      .string()
      .trim()
      .min(1, 'Enter a name.')
      .max(120, { error: tooLong('Name', 120) }),
    email: z.email('Enter an email address, such as name@example.com.').optional(),
  }),
  permission: 'core.user:create',
});

/**
 * Blocks a user of the company: they cannot sign in, and their next request is refused. It needs
 * core.user:block at the company and at every other company the user belongs to, since a block
 * holds everywhere. Blocking yourself is refused with core.cannot_block_self.
 */
export const blockUser = defineCommandContract({
  name: 'core.blockUser',
  target: 'none',
  fields: z.object({ id: z.uuid(), reason: accessReason }),
  permission: 'core.user:block',
  reason: 'optional',
});

/**
 * Unblocks a blocked user of the company, who can sign in again. It needs core.user:block at every
 * company the user belongs to.
 */
export const unblockUser = defineCommandContract({
  name: 'core.unblockUser',
  target: 'none',
  fields: z.object({ id: z.uuid(), reason: accessReason }),
  permission: 'core.user:block',
  reason: 'optional',
});
