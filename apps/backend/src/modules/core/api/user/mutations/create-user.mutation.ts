// SPDX-License-Identifier: AGPL-3.0-or-later
import { createUser } from '@northmes/core-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { createUserHandler } from '../../../core/commands/create-user.handler.ts';
import { CreatedUser } from '../types/created-user.type.ts';

/**
 * The mutation coreCreateUser, which the SDK generates from the contract of core.createUser and
 * which returns the user that createUserHandler creates, with the temporary password.
 */
export const CreateUser = defineCommand(createUser, {
  returns: () => CreatedUser,
  plantFree: true,
  ...createUserHandler,
});
