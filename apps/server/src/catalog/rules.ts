// SPDX-License-Identifier: AGPL-3.0-or-later
import { apiPath } from '@northmes/contracts';
import { type ModuleNames, moduleNames } from '@northmes/sdk';
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
 * A problem for every permission or command key that does not start with its module's GraphQL
 * name, and every event key that does not start with its SQL name (ADR 0003).
 */
export function keyPrefixProblems(entries: readonly CatalogEntry[]): string[] {
  const problems: string[] = [];
  for (const { manifest } of entries) {
    const names = moduleNames(manifest.id);
    const prefix = `${names.gql}.`;
    for (const key of Object.keys(manifest.permissions ?? {})) {
      if (!key.startsWith(prefix)) {
        problems.push(
          `Module ${manifest.id} declares permission "${key}", which must start with "${prefix}"`,
        );
      }
    }
    for (const key of Object.keys(manifest.commands ?? {})) {
      if (!key.startsWith(prefix)) {
        problems.push(
          `Module ${manifest.id} declares command "${key}", which must start with "${prefix}"`,
        );
      }
    }
    const eventPrefix = `${names.sql}.`;
    for (const key of Object.keys(manifest.events ?? {})) {
      if (!key.startsWith(eventPrefix)) {
        problems.push(
          `Module ${manifest.id} declares event "${key}", which must start with "${eventPrefix}"`,
        );
      }
    }
  }
  return problems;
}
