// SPDX-License-Identifier: AGPL-3.0-or-later
import { moduleName, moduleOf } from './permission-names.ts';

/** The permissions of one module, in the catalog's order. */
export interface PermissionGroup {
  readonly moduleId: string;
  readonly name: string;
  readonly keys: readonly string[];
}

/** Permission keys grouped by their module, for a list without the catalog, in first-seen order. */
export function groupsOfKeys(keys: readonly string[]): PermissionGroup[] {
  const groups = new Map<string, string[]>();
  for (const key of keys) {
    const moduleId = moduleOf(key);
    groups.set(moduleId, [...(groups.get(moduleId) ?? []), key]);
  }
  return [...groups].map(([moduleId, grouped]) => ({
    moduleId,
    name: moduleName(moduleId),
    keys: grouped,
  }));
}
