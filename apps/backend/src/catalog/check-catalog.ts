// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Type } from '@nestjs/common';
import type { ModuleManifest } from '@northmes/sdk';
import { BootError } from '../boot/boot-error.ts';
import {
  keyPrefixProblems,
  nameClashProblems,
  rangeProblems,
  reservedIdProblems,
  slotProblems,
} from './rules.ts';

/**
 * An installed module: what the catalog checks read of it, and whether it ships in the repository
 * or as a plugin.
 */
export interface CatalogEntry {
  /**
   * A plugin's manifest. An in-repo module has none of its own, so boot gives it one with its id,
   * its dependsOn and the backend's version, which the checks read like a plugin's.
   */
  readonly manifest: ModuleManifest;
  readonly kind: 'module' | 'plugin';
  /** The folder that holds the module's migration files. Without one, the module has none. */
  readonly migrationsDir?: string;
  /** The Nest module of an in-repo module. A plugin's comes from its manifest's server entry. */
  readonly module?: Type;
  /**
   * Further schemas that an in-repo module's owner role owns besides its own, such as core's auth
   * schema for Better Auth's tables (ADR 0010). migrate creates them in the transaction of the
   * module's first pending migration file, so a schema added here arrives with the module's next
   * new file, which is the file that creates its tables; their grants are in the module's
   * migration files too. A plugin has none.
   */
  readonly schemas?: readonly string[];
}

export interface CatalogOptions {
  /** The NorthMES version of the running image. */
  readonly imageVersion: string;
}

/**
 * The catalog checks of boot step 4 (ADR 0002). Returns the catalog in boot order, or throws one
 * BootError that lists every problem found.
 */
export function checkCatalog(
  entries: readonly CatalogEntry[],
  { imageVersion }: CatalogOptions,
): CatalogEntry[] {
  const problems: string[] = [
    ...reservedIdProblems(entries),
    ...nameClashProblems(entries),
    ...rangeProblems(entries, imageVersion),
    ...keyPrefixProblems(entries),
    ...slotProblems(entries),
  ];
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
      problems.push(cycleProblem(path.slice(path.indexOf(id))));
      return;
    }
    state.set(id, 'visiting');
    for (const dependency of [...(entry.manifest.dependsOn ?? [])].sort(compareIds)) {
      const target = byId.get(dependency);
      if (target) visit(target, [...path, id]);
    }
    state.set(id, 'done');
    ordered.push(entry);
  };
  const core = byId.get('core');
  if (core) visit(core, []);
  for (const entry of [...entries].sort(compareEntries)) visit(entry, []);
  return ordered;
}

/** In-repo modules before plugins, then by id. */
function compareEntries(a: CatalogEntry, b: CatalogEntry): number {
  if (a.kind !== b.kind) return a.kind === 'module' ? -1 : 1;
  return compareIds(a.manifest.id, b.manifest.id);
}

/**
 * Compares ids by character code. localeCompare would follow the machine's locale, where for
 * example Czech sorts "ch" after "h", and the boot order must be the same on every machine.
 */
function compareIds(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Names the modules of a cycle in cycle order, starting from the smallest id, so the same cycle
 * reads the same whichever module the walk entered it at.
 */
function cycleProblem(cycle: readonly string[]): string {
  const smallest = cycle.reduce((least, id) => (compareIds(id, least) < 0 ? id : least));
  const start = cycle.indexOf(smallest);
  const rotated = [...cycle.slice(start), ...cycle.slice(0, start), smallest];
  return `Module dependency cycle: ${rotated.join(' -> ')}`;
}
