// SPDX-License-Identifier: AGPL-3.0-or-later
import { unblockUser } from '@northmes/core-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { unblockUserHandler } from '../../../core/commands/block-user.handler.ts';
import { User } from '../types/user.type.ts';

/**
 * The mutation coreUnblockUser, which the SDK generates from the contract of core.unblockUser and
 * which returns the User that unblockUserHandler unblocks.
 */
export const UnblockUser = defineCommand(unblockUser, {
  returns: () => User,
  ...unblockUserHandler,
});
