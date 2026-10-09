// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The permissions of the core module, resource to actions (ADR 0010). northmes migrate writes each
 * as `<resource>:<action>` into core.permission.
 */
export const corePermissions = {
  'core.article': ['read', 'create', 'update', 'archive'],
  'core.role': ['read', 'manage'],
  'core.roleAssignment': ['manage'],
  'core.user': ['read', 'create', 'block'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/**
 * The default roles of the core module, role key to permission keys (ADR 0010). northmes migrate
 * gives every company each of them as a role of origin module, and a new company gets them when it
 * is created. A company admin holds every permission of core.
 */
export const coreRoles = {
  'company-admin': Object.entries(corePermissions).flatMap(([resource, actions]) =>
    actions.map((action) => `${resource}:${action}`),
  ),
} as const satisfies Readonly<Record<string, readonly string[]>>;
