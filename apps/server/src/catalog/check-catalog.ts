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
  const byId = new Map(entries.map((entry) => [entry.manifest.id, entry]));
  for (const { manifest, kind } of entries) {
    for (const dependency of manifest.dependsOn ?? []) {
      const target = byId.get(dependency);
      if (!target) {
        problems.push(`Module ${manifest.id} depends on "${dependency}", which is not installed`);
      } else if (kind === 'module' && target.kind === 'plugin') {
        problems.push(`Core module ${manifest.id} must not depend on plugin ${dependency}`);
      }
    }
  }
  const ordered = dependencyOrder(entries, byId, problems);
  if (problems.length > 0) throw new BootError(problems);
  return ordered;
}

/**
 * Orders the catalog so that every module comes after the modules it depends on: core first, then
 * a depth-first walk over in-repo modules before plugins, each by id, so the order is stable. Adds
 * a problem for every dependency cycle the walk finds.
 */
function dependencyOrder(
  entries: readonly CatalogEntry[],
  byId: ReadonlyMap<string, CatalogEntry>,
  problems: string[],
): CatalogEntry[] {
  const ordered: CatalogEntry[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (entry: CatalogEntry, path: readonly string[]): void => {
    const id = entry.manifest.id;
    const seen = state.get(id);
    if (seen === 'done') return;
    if (seen === 'visiting') {
      problems.push(`Module dependency cycle: ${[...path, id].join(' -> ')}`);
      return;
    }
    state.set(id, 'visiting');
    for (const dependency of [...(entry.manifest.dependsOn ?? [])].sort()) {
      const target = byId.get(dependency);
      if (target) visit(target, [...path, id]);
    }
    state.set(id, 'done');
    ordered.push(entry);
  };
  const sorted = [...entries].sort((a, b) =>
    a.kind === b.kind ? a.manifest.id.localeCompare(b.manifest.id) : a.kind === 'module' ? -1 : 1,
  );
  const core = byId.get('core');
  if (core) visit(core, []);
  for (const entry of sorted) visit(entry, []);
  return ordered;
}
