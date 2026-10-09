// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The permissions of the core module, resource to actions (ADR 0010). northmes migrate writes each
 * as `<resource>:<action>` into core.permission.
 */
export const corePermissions = {
  'core.article': ['read', 'create', 'update', 'archive'],
  'core.role': ['read', 'manage'],
  'core.roleAssignment': ['manage'],
  'core.user': ['read', 'create', 'block', 'resetPassword'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/**
 * The permissions that the API checks only at the company: editing roles, creating users, blocking
 * them and resetting their passwords. Plant admin holds every installed permission but these.
 */
export const companyPermissions: readonly string[] = [
  'core.role:manage',
  'core.user:block',
  'core.user:create',
  'core.user:resetPassword',
];

/** The key of core's Company admin role in core.role, `<module>-<role>`. */
export const companyAdminRoleKey = 'core-company-admin';

/**
 * The default roles of the core module, role key to permission keys, from the permissions of every
 * installed module (ADR 0010). northmes migrate gives every company each of them as a role of
 * origin module, and a new company gets them when it is created, so a permission of a module or a
 * plugin installed later reaches them at the next migrate. Company admin holds every installed
 * permission, so its holder can assign any role (ADR 0066, M-61). Plant admin holds every installed
 * permission except the company-level ones, so at its plant it can assign any role but Company
 * admin.
 */
export function coreRoles(
  installed: readonly string[],
): Readonly<Record<string, readonly string[]>> {
  return {
    'company-admin': [...installed],
    'plant-admin': installed.filter((key) => !companyPermissions.includes(key)),
  };
}
