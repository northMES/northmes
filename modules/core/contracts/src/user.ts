// SPDX-License-Identifier: MIT
import { defineCommandContract } from '@northmes/contracts';
import { z } from 'zod';
import { tooLong } from './messages.ts';
import { accessReason, settingsCompanyId } from './role.ts';

/**
 * A username, the handle that lists show for a user (ADR 0010): 3 to 30 letters, digits, dots and
 * underscores, stored in lower case. It never changes and is never given to anyone else. A user
 * signs in with their email, not with it.
 */
export const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter a username.')
  // An empty username gets only the message above: the pipe stops at its first failure.
  .pipe(
    z
      .string()
      .min(3, 'A username can be 3 to 30 characters.')
      .max(30, 'A username can be 3 to 30 characters.')
      .regex(/^[a-z0-9._]+$/, 'Use letters, digits, dots and underscores.'),
  );

/**
 * Creates a user of the company of the request's plant, or of companyId from company settings,
 * under the client's id, with a temporary password that the answer shows once and that the user
 * must replace at the first sign-in (ADR 0010, ADR 0051 rule 13). It needs core.user:create at the
 * company. With roleId and scopeId, given together, the user gets that role there in the same
 * command, which needs core.roleAssignment:manage there and every permission of the role, as
 * core.assignRole does, else core.forbidden or core.role_not_held and no user is created. Every
 * user has an email, which they sign in with on the web. A person without one signs in with a badge
 * at the operator station instead, as the maintainer decided. A username that is taken, or
 * was used before, is refused with core.username_taken, and an email another user has with
 * core.email_taken. A retry with the id of a first run that failed finishes the creation; a retry
 * after the first run finished is refused with core.user_created_password_hidden and the user's id
 * in details.userId, since the password is shown once only.
 */
export const createUser = defineCommandContract({
  name: 'core.createUser',
  target: 'new',
  fields: z.object({
    username,
    name: z
      .string()
      .trim()
      .min(1, 'Enter a name.')
      .max(120, { error: tooLong('Name', 120) }),
    email: z.email('Enter an email address, such as name@example.com.'),
    roleId: z.uuid().optional(),
    scopeId: z.uuid().optional(),
    reason: accessReason,
    companyId: settingsCompanyId,
  }),
  permission: 'core.user:create',
  reason: 'optional',
});

/**
 * Blocks a user of the company, the request plant's or companyId's from company settings: they
 * cannot sign in, and their next request is refused. It needs core.user:block at the company and
 * at every other company the user belongs to, since a block holds everywhere. Blocking yourself
 * is refused with core.cannot_block_self, and blocking the last active Company admin of a company
 * with core.last_admin.
 */
export const blockUser = defineCommandContract({
  name: 'core.blockUser',
  target: 'none',
  fields: z.object({ id: z.uuid(), reason: accessReason, companyId: settingsCompanyId }),
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
  fields: z.object({ id: z.uuid(), reason: accessReason, companyId: settingsCompanyId }),
  permission: 'core.user:block',
  reason: 'optional',
});

/**
 * Gives a user of the company a new temporary password, which the answer shows once (design
 * core-304, US15 to US18). The old password stops working and every session of the user ends, and
 * the user must choose a new password at the next sign-in (ADR 0051 rule 13). It needs
 * core.user:resetPassword at the company and at every other company the user belongs to, which
 * only Company admin holds of the default roles. Resetting your own password is refused with
 * core.cannot_reset_own_password, and a blocked user's with core.user_blocked.
 */
export const resetPassword = defineCommandContract({
  name: 'core.resetPassword',
  target: 'none',
  fields: z.object({ id: z.uuid(), reason: accessReason, companyId: settingsCompanyId }),
  permission: 'core.user:resetPassword',
  reason: 'optional',
});
