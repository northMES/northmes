// SPDX-License-Identifier: MIT
import { defineCommandContract } from '@northmes/contracts';
import { z } from 'zod';
import { reasonTooLong, tooLong } from './messages.ts';

/** A permission key, `<module>.<entity>:<action>`, as core.permission holds it (ADR 0010). */
export const permissionKey = z
  .string()
  .regex(
    /^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+:[a-z][A-Za-z0-9]*$/,
    'A permission is written <module>.<entity>:<action>.',
  );

/**
 * An optional reason for a change to access, which the person who makes the change types (design
 * core-304). It is recorded with the change once the audit trail arrives (ADR 0013).
 */
export const accessReason = z
  .string()
  .trim()
  .max(500, { error: reasonTooLong(500) })
  .optional();

/**
 * The company of a command sent from company settings, whose request names no plant (ADR 0066). A
 * command sent at a plant leaves it out, or names the plant's company.
 */
export const settingsCompanyId = z.uuid().optional();

/**
 * The fields a company admin edits on a custom role: its name, unique within the company, and the
 * permissions it holds, from the catalog of the installed modules.
 */
const roleFields = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a role name.')
    .max(80, { error: tooLong('Role name', 80) }),
  permissions: z.array(permissionKey).max(500, 'A role can hold at most 500 permissions.'),
});

/**
 * Creates a custom role of the company of the request's plant, or of companyId from company
 * settings, under the client-generated id, so a retry returns the first role (ADR 0012). It needs core.role:manage at the company (ADR 0010). A
 * name that a role of the company has is refused with core.role_name_taken, and a permission the
 * catalog does not hold with core.unknown_permission. The reason is recorded once the audit trail
 * arrives (#443).
 */
export const createRole = defineCommandContract({
  name: 'core.createRole',
  target: 'new',
  fields: roleFields.extend({ companyId: settingsCompanyId, reason: accessReason }),
  permission: 'core.role:manage',
  reason: 'optional',
});

/**
 * Changes the name and the permissions of a custom role, which the input names by id with the
 * version the change was made on. It needs core.role:manage at the role's company, and each
 * permission it adds held by the editor at every scope where the role is assigned (ADR 0010),
 * else core.role_not_held. Company admin is refused with core.last_admin, another default role
 * with core.role_not_custom.
 */
export const updateRole = defineCommandContract({
  name: 'core.updateRole',
  target: 'existing',
  fields: roleFields.extend({ reason: accessReason }),
  permission: 'core.role:manage',
  reason: 'optional',
});

/**
 * Deletes a custom role that nobody holds. It needs core.role:manage at the role's company.
 * Company admin is refused with core.last_admin, another default role with core.role_not_custom,
 * and a role someone holds with core.role_in_use.
 */
export const deleteRole = defineCommandContract({
  name: 'core.deleteRole',
  target: 'existing',
  fields: z.object({}),
  permission: 'core.role:manage',
});

/**
 * Gives a user a role of the company at the company or at the request's plant, or from company
 * settings at the company companyId names or one of its plants, under the
 * client-generated id of the assignment, so a retry returns the first one (ADR 0012). It needs
 * core.roleAssignment:manage at that scope, and every permission of the role held by the assigner
 * there (ADR 0010), else core.role_not_held. A user who holds the role there already is refused
 * with core.role_already_assigned. The reason is recorded once the audit trail arrives (#443).
 */
export const assignRole = defineCommandContract({
  name: 'core.assignRole',
  target: 'new',
  fields: z.object({
    userId: z.uuid(),
    roleId: z.uuid(),
    scopeId: z.uuid(),
    companyId: settingsCompanyId,
    reason: accessReason,
  }),
  permission: 'core.roleAssignment:manage',
  reason: 'optional',
});

/**
 * Takes a role assignment away from its user. It needs core.roleAssignment:manage at the
 * assignment's scope, and every permission of the role held by the remover there (ADR 0010), else
 * core.role_not_held. It applies from the user's next request. Removing Company admin at the
 * company from the company's last active Company admin is refused with core.last_admin.
 */
export const removeRoleAssignment = defineCommandContract({
  name: 'core.removeRoleAssignment',
  target: 'none',
  fields: z.object({ id: z.uuid(), reason: accessReason }),
  permission: 'core.roleAssignment:manage',
  reason: 'optional',
});
