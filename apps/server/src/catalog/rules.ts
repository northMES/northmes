// SPDX-License-Identifier: AGPL-3.0-or-later
import { apiPath } from '@northmes/contracts';
import { type ModuleManifest, type ModuleNames, moduleNames } from '@northmes/sdk';
import { satisfies } from 'semver';
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

/** The names moduleNames derives from an id, each its own namespace. */
const DERIVED_NAMES = [
  'gql',
  'sql',
  'ownerRole',
  'remote',
] as const satisfies readonly (keyof ModuleNames)[];

/**
 * A problem for every two modules that derive the same name of one kind, such as press-2 and
 * press2, which both derive the GraphQL name press2. Each pair is named once.
 */
export function nameClashProblems(entries: readonly CatalogEntry[]): string[] {
  const problems: string[] = [];
  const owners = new Map<string, string>();
  const reported = new Set<string>();
  for (const { manifest } of entries) {
    const names = moduleNames(manifest.id);
    for (const kind of DERIVED_NAMES) {
      const key = `${kind} ${names[kind]}`;
      const owner = owners.get(key);
      if (owner === undefined) {
        owners.set(key, manifest.id);
        continue;
      }
      const pair = `${owner} ${manifest.id}`;
      if (owner === manifest.id || reported.has(pair)) continue;
      reported.add(pair);
      problems.push(
        `Modules ${owner} and ${manifest.id} derive the same name ${names[kind]}; give one of them another id`,
      );
    }
  }
  return problems;
}

/**
 * A problem for every module whose NorthMES range does not hold the image's version (ADR 0038).
 * Prereleases count, so a release candidate of 0.4.0 runs modules built for >=0.3.0 <0.5.0.
 */
export function rangeProblems(entries: readonly CatalogEntry[], imageVersion: string): string[] {
  const problems: string[] = [];
  for (const { manifest } of entries) {
    if (!satisfies(imageVersion, manifest.northmes, { includePrerelease: true })) {
      problems.push(
        `Module ${manifest.id} ${manifest.version} runs on NorthMES ${manifest.northmes}, and this image is ${imageVersion}`,
      );
    }
  }
  return problems;
}

/**
 * The derived name each kind of manifest key starts with (ADR 0003): permissions and commands the
 * GraphQL name, events the SQL name.
 */
const KEY_PREFIXES = [
  { kind: 'permission', field: 'permissions', name: 'gql' },
  { kind: 'command', field: 'commands', name: 'gql' },
  { kind: 'event', field: 'events', name: 'sql' },
] as const satisfies readonly {
  kind: string;
  field: keyof ModuleManifest;
  name: keyof ModuleNames;
}[];

/** A problem for every permission, command or event key without its module's prefix, naming the key. */
export function keyPrefixProblems(entries: readonly CatalogEntry[]): string[] {
  const problems: string[] = [];
  for (const { manifest } of entries) {
    const names = moduleNames(manifest.id);
    for (const { kind, field, name } of KEY_PREFIXES) {
      const prefix = `${names[name]}.`;
      for (const key of Object.keys(manifest[field] ?? {})) {
        if (!key.startsWith(prefix)) {
          problems.push(
            `Module ${manifest.id} declares ${kind} "${key}", which must start with "${prefix}"`,
          );
        }
      }
    }
  }
  return problems;
}

/**
 * A problem for every slot a module declares outside its own id, and for every contribution to a
 * slot whose owner is outside the contributor's dependsOn closure (ADR 0037). A slot id starts with
 * its owner's id (ADR 0068), so each slot has one owner. A module may contribute to its own slots.
 * A contribution to a slot that no installed module owns is not checked here.
 */
export function slotProblems(entries: readonly CatalogEntry[]): string[] {
  const byId = new Map(entries.map(({ manifest }) => [manifest.id, manifest]));
  const owners = new Map<string, string>();
  const problems: string[] = [];
  for (const { manifest } of entries) {
    for (const slot of Object.keys(manifest.web?.slots ?? {})) {
      if (slot.split('/')[0] === manifest.id) {
        owners.set(slot, manifest.id);
      } else {
        problems.push(
          `Module ${manifest.id} declares slot "${slot}", which must start with "${manifest.id}/"`,
        );
      }
    }
  }
  for (const { manifest } of entries) {
    const reach = dependsOnClosure(manifest.id, byId);
    for (const { id, slot } of manifest.web?.contributes ?? []) {
      const owner = owners.get(slot);
      if (owner !== undefined && !reach.has(owner)) {
        problems.push(
          `Module ${manifest.id} contributes "${id}" to slot "${slot}" of ${owner}, which ${manifest.id} does not depend on`,
        );
      }
    }
  }
  return problems;
}

/**
 * The module itself and every installed module it depends on, directly or through others. The walk
 * stops at a module it has reached, so a dependency cycle ends it.
 */
function dependsOnClosure(id: string, byId: ReadonlyMap<string, ModuleManifest>): Set<string> {
  const reached = new Set<string>();
  const pending = [id];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (reached.has(next)) continue;
    reached.add(next);
    pending.push(...(byId.get(next)?.dependsOn ?? []));
  }
  return reached;
}
