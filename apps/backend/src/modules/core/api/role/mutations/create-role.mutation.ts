// SPDX-License-Identifier: AGPL-3.0-or-later
import { createRole } from '@northmes/core-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { createRoleHandler } from '../../../core/commands/create-role.handler.ts';
import { Role } from '../types/role.type.ts';

/**
 * The mutation coreCreateRole, which the SDK generates from the contract of core.createRole and which
 * returns the Role that createRoleHandler creates.
 */
export const CreateRole = defineCommand(createRole, {
  returns: () => Role,
  plantFree: true,
  ...createRoleHandler,
});
