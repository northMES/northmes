// SPDX-License-Identifier: AGPL-3.0-or-later
import { apiPath } from '@northmes/contracts';
import type { CatalogEntry } from './check-catalog.ts';

/**
 * The path segments under /api/v1 that the host and its libraries own, so no module may use them
 * as its id (ADR 0064): web and station hold the host's first-party routes, auth holds Better
 * Auth's.
 */
const RESERVED_IDS: ReadonlyMap<string, 'first-party' | 'library'> = new Map([
  ['web', 'first-party'],
  ['station', 'first-party'],
  ['auth', 'library'],
]);

/** A problem for every module or plugin whose id is a reserved path segment. */
export function reservedIdProblems(entries: readonly CatalogEntry[]): string[] {
  const problems: string[] = [];
  for (const { manifest } of entries) {
    const family = RESERVED_IDS.get(manifest.id);
    if (family) {
      problems.push(
        `Module id "${manifest.id}" is reserved: ${apiPath(manifest.id)} is a ${family} path segment`,
      );
    }
  }
  return problems;
}
