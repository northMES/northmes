// SPDX-License-Identifier: AGPL-3.0-or-later
import { detailsOf } from '../../ui/lib/graphql-errors.ts';
import { permissionWithId } from './permission-names.ts';

/** "A, B and C": a list in running text. */
export function listOf(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** "1 permission" or "3 permissions". */
export function permissionCount(count: number): string {
  return `${count} ${count === 1 ? 'permission' : 'permissions'}`;
}

/**
 * The permissions a refusal with core.role_not_held names (ADR 0010, the grant rule), or
 * undefined for any other failure.
 */
export function missingPermissionsOf(error: unknown): readonly string[] | undefined {
  const details = detailsOf(error, 'core.role_not_held');
  if (details === undefined) return undefined;
  const missing = details.missingPermissions;
  return Array.isArray(missing) ? missing.filter((key) => typeof key === 'string') : [];
}

/** The permissions as running text with their ids: "Run autoplan (planning.autoplan:run) and ...". */
export function permissionList(keys: readonly string[]): string {
  return listOf(keys.map(permissionWithId));
}
