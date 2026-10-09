// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The permissions of the planning module, resource to actions (ADR 0010). northmes migrate writes
 * each as `<resource>:<action>` into core.permission.
 */
export const planningPermissions = {
  'planning.productionOrder': ['read', 'release'],
} as const satisfies Readonly<Record<string, readonly string[]>>;
