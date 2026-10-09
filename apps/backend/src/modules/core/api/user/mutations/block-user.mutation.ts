// SPDX-License-Identifier: AGPL-3.0-or-later
import { blockUser } from '@northmes/core-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { blockUserHandler } from '../../../core/commands/block-user.handler.ts';
import { User } from '../types/user.type.ts';

/**
 * The mutation coreBlockUser, which the SDK generates from the contract of core.blockUser and which
 * returns the User that blockUserHandler blocks.
 */
export const BlockUser = defineCommand(blockUser, {
  returns: () => User,
  plantFree: true,
  ...blockUserHandler,
});
