// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ModuleManifest } from '@northmes/sdk';
import { BootError } from '../boot/boot-error.ts';

/** An installed module: its manifest, and whether it ships in the repository or as a plugin. */
export interface CatalogEntry {
  readonly manifest: ModuleManifest;
  readonly kind: 'module' | 'plugin';
}

export interface CatalogOptions {
  /** The NorthMES version of the running image. */
  readonly imageVersion: string;
}

/**
 * The catalog checks of boot step 4 (ADR 0002). Throws one BootError that lists every problem
 * found.
 */
export function checkCatalog(
  entries: readonly CatalogEntry[],
  _options: CatalogOptions,
): CatalogEntry[] {
  const problems: string[] = [];
  const ids = new Set(entries.map((entry) => entry.manifest.id));
  for (const { manifest } of entries) {
    for (const dependency of manifest.dependsOn ?? []) {
      if (!ids.has(dependency)) {
        problems.push(`Module ${manifest.id} depends on "${dependency}", which is not installed`);
      }
    }
  }
  if (problems.length > 0) throw new BootError(problems);
  return [...entries];
}
