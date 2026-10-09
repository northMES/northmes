// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineModule, type ModuleManifest } from '@northmes/sdk';
import type { CatalogEntry } from '../../src/catalog/check-catalog.ts';

/** The NorthMES version the catalog tests run as. */
export const imageVersion = '0.0.0';

/** The manifest fields a test sets. Without northmes, the range holds imageVersion. */
export type ManifestOptions = Partial<
  Pick<ModuleManifest, 'northmes' | 'permissions' | 'events' | 'web'>
>;

function manifest(id: string, dependsOn: readonly string[], options: ManifestOptions) {
  return defineModule({
    id,
    version: '0.0.0',
    northmes: '>=0.0.0-0 <0.1.0-0',
    dependsOn,
    ...options,
  });
}

/** A module that ships in the NorthMES repository. */
export function inRepoModule(
  id: string,
  dependsOn: readonly string[] = [],
  options: ManifestOptions = {},
): CatalogEntry {
  return { manifest: manifest(id, dependsOn, options), kind: 'module' };
}

/** A module installed as a plugin. */
export function plugin(
  id: string,
  dependsOn: readonly string[] = [],
  options: ManifestOptions = {},
): CatalogEntry {
  return { manifest: manifest(id, dependsOn, options), kind: 'plugin' };
}

export const core = inRepoModule('core');

type WebPart = NonNullable<ModuleManifest['web']>;
type Contribution = NonNullable<WebPart['contributes']>[number];

/** A contribution to a slot, with a placeholder label, order and permission. */
export function contribution(id: string, slot: string): Contribution {
  return { id, slot, label: id, order: 10, permission: `${id}:read` };
}

/** A web part that owns the given slots, each a region, and makes the given contributions. */
export function webPart(
  slots: readonly string[],
  contributes: readonly Contribution[] = [],
): WebPart {
  return {
    label: 'Module',
    order: 10,
    slots: Object.fromEntries(slots.map((slot) => [slot, { kind: 'region' }])),
    contributes,
  };
}
