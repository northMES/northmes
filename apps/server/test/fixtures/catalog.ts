// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineModule } from '@northmes/sdk';
import type { CatalogEntry } from '../../src/catalog/check-catalog.ts';

/** The NorthMES version the catalog tests run as. */
export const imageVersion = '0.0.0';

function manifest(id: string, dependsOn: readonly string[]) {
  return defineModule({ id, version: '0.0.0', northmes: '>=0.0.0-0 <0.1.0-0', dependsOn });
}

/** A module that ships in the NorthMES repository. */
export function inRepoModule(id: string, dependsOn: readonly string[] = []): CatalogEntry {
  return { manifest: manifest(id, dependsOn), kind: 'module' };
}

/** A module installed as a plugin. */
export function plugin(id: string, dependsOn: readonly string[] = []): CatalogEntry {
  return { manifest: manifest(id, dependsOn), kind: 'plugin' };
}

export const core = inRepoModule('core');
