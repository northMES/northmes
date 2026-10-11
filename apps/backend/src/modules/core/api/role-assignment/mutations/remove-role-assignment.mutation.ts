// SPDX-License-Identifier: AGPL-3.0-or-later
import { removeRoleAssignment } from '@northmes/core-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { removeRoleAssignmentHandler } from '../../../core/commands/remove-role-assignment.handler.ts';
import { RoleAssignment } from '../types/role-assignment.type.ts';

/**
 * The mutation coreRemoveRoleAssignment, which the SDK generates from the contract of
 * core.removeRoleAssignment and which returns the RoleAssignment that removeRoleAssignmentHandler
 * deletes, as it was.
 */
export const RemoveRoleAssignment = defineCommand(removeRoleAssignment, {
  returns: () => RoleAssignment,
  plantFree: true,
  ...removeRoleAssignmentHandler,
});
