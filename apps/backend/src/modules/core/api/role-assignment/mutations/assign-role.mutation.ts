// SPDX-License-Identifier: AGPL-3.0-or-later
import { assignRole } from '@northmes/core-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { assignRoleHandler } from '../../../core/commands/assign-role.handler.ts';
import { RoleAssignment } from '../types/role-assignment.type.ts';

/**
 * The mutation coreAssignRole, which the SDK generates from the contract of core.assignRole and
 * which returns the RoleAssignment that assignRoleHandler writes.
 */
export const AssignRole = defineCommand(assignRole, {
  returns: () => RoleAssignment,
  ...assignRoleHandler,
});
