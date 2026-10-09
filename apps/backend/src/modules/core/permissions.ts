// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The permissions of the core module, resource to actions (ADR 0010). northmes migrate writes each
 * as `<resource>:<action>` into core.permission.
 */
export const corePermissions = {
  'core.article': ['read', 'create', 'update', 'archive'],
  'core.role': ['manage'],
  'core.roleAssignment': ['manage'],
  'core.user': ['manage'],
} as const satisfies Readonly<Record<string, readonly string[]>>;
