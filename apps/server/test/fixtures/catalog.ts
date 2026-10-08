// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineModule } from '@northmes/sdk';
import type { CatalogEntry } from '../../src/catalog/check-catalog.ts';

/** The NorthMES version the catalog tests run as. */
export const imageVersion = '0.0.0';

export interface ManifestOptions {
  /** The NorthMES range the module accepts. Without it, the range holds imageVersion. */
  readonly northmes?: string;
}

function manifest(id: string, dependsOn: readonly string[], options: ManifestOptions) {
  const { northmes = '>=0.0.0-0 <0.1.0-0' } = options;
  return defineModule({ id, version: '0.0.0', northmes, dependsOn });
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
