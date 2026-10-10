// SPDX-License-Identifier: AGPL-3.0-or-later
import { deleteRole } from '@northmes/core-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { deleteRoleHandler } from '../../../core/commands/delete-role.handler.ts';
import { Role } from '../types/role.type.ts';

/**
 * The mutation coreDeleteRole, which the SDK generates from the contract of core.deleteRole and which
 * returns the Role that deleteRoleHandler deletes, as it was.
 */
export const DeleteRole = defineCommand(deleteRole, {
  returns: () => Role,
  plantFree: true,
  ...deleteRoleHandler,
});
