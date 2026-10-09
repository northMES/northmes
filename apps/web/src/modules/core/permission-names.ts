// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The plain line of each permission the design names (design core-304, Permission ids shown on
 * the page; question 4: the catalog declares no label yet). A permission without one reads as its
 * action and resource, such as "Release production order".
 */
const lines: Readonly<Record<string, string>> = {
  'core.article:read': 'Read articles',
  'core.article:create': 'Create articles',
  'core.article:update': 'Change articles',
  'core.article:archive': 'Archive and restore articles',
  'core.user:read': 'Read users and their roles',
  'core.user:create': 'Create users',
  'core.user:block': 'Block users',
  'core.user:resetPassword': 'Reset passwords',
  'core.role:read': 'Read roles',
  'core.role:manage': 'Create and edit roles',
  'core.roleAssignment:manage': 'Assign and remove roles',
  'core.audit:read': 'Read the audit log',
  'core.settings:manage': 'Change core settings',
  'core.plant:create': 'Create plants',
  'core.onboarding:manage': 'Run onboarding',
  'core.company:update': 'Rename the company',
  'planning.productionOrder:read': 'Read production orders and the planning board',
  'planning.productionOrder:create': 'Create production orders',
  'planning.productionOrder:update': 'Change production orders',
  'planning.productionOrder:release': 'Release production orders to the floor',
  'planning.productionOrder:cancel': 'Cancel production orders',
  'planning.jobOrder:read': 'Read job orders',
  'planning.jobOrder:schedule': 'Move and schedule job orders and save the plan',
  'planning.jobOrder:lock': 'Lock job orders',
  'planning.jobOrder:breakLock': "Break another planner's lock",
  'planning.autoplan:run': 'Run autoplan',
  'planning.settings:manage': 'Change planning settings',
};

/** camelCase as lower-case words: productionOrder is "production order". */
function words(camel: string): string {
  return camel.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
}

/** The plain line of a permission key, `<module>.<entity>:<action>`. */
export function permissionLine(key: string): string {
  const known = lines[key];
  if (known !== undefined) return known;
  const [resource = '', action = ''] = key.split(':');
  const entity = resource.split('.').slice(1).join(' ');
  const text = `${words(action)} ${words(entity)}`.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A module's name from its id, as the sidebar names it: productionStart is "Production start". */
export function moduleName(moduleId: string): string {
  const text = words(moduleId);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The module id of a permission key: planning for planning.jobOrder:lock. */
export function moduleOf(key: string): string {
  return key.split('.')[0] ?? key;
}

/** "Read roles (core.role:read)": the plain line with the id, as refusals name a permission. */
export function permissionWithId(key: string): string {
  return `${permissionLine(key)} (${key})`;
}
