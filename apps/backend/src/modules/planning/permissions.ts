// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The permissions of the planning module, resource to actions (ADR 0010). northmes migrate writes
 * each as `<resource>:<action>` into core.permission.
 */
export const planningPermissions = {
  'planning.productionOrder': ['read', 'release'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/**
 * The default roles of the planning module, role key to permission keys (ADR 0010). northmes
 * migrate gives every company each of them as a role of origin module. Both read the articles the
 * orders make.
 */
export const planningRoles = {
  planner: [
    'core.article:read',
    'planning.productionOrder:read',
    'planning.productionOrder:release',
  ],
  viewer: ['core.article:read', 'planning.productionOrder:read'],
} as const satisfies Readonly<Record<string, readonly string[]>>;
