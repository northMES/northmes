// SPDX-License-Identifier: AGPL-3.0-or-later
import { updateRole } from '@northmes/core-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { updateRoleHandler } from '../../../core/commands/update-role.handler.ts';
import { Role } from '../types/role.type.ts';

/**
 * The mutation coreUpdateRole, which the SDK generates from the contract of core.updateRole and which
 * returns the Role that updateRoleHandler changes.
 */
export const UpdateRole = defineCommand(updateRole, {
  returns: () => Role,
  ...updateRoleHandler,
});
