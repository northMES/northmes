// SPDX-License-Identifier: AGPL-3.0-or-later
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The ids of the modules that ship in the backend, each in src/modules/<id>/. */
const inRepoIds = ['core', 'planning'];

/** The extension of this file: .ts when the backend runs from its sources, .js from dist/. */
const extension = import.meta.url.endsWith('.ts') ? '.ts' : '.js';

/**
 * The manifests of the modules that ship in the repository, by import specifier: the file URL of
 * each src/modules/<id>/northmes.module file, or of its build in dist/. Boot imports them after the
 * configuration check and orders them by their dependencies (ADR 0002, ADR 0003).
 */
export const inRepoManifests: readonly string[] = inRepoIds.map(
  (id) => new URL(`./modules/${id}/northmes.module${extension}`, import.meta.url).href,
);

/** src/modules/ of the backend. The build copies no .sql file, so dist/ holds no migrations. */
const sourceModulesDir = fileURLToPath(new URL('../src/modules/', import.meta.url));

/**
 * The migrations folder of the in-repo module whose manifest a specifier of inRepoManifests names:
 * src/modules/<id>/migrations, also when the backend runs from dist/ (ADR 0006).
 */
export function inRepoMigrationsDir(specifier: string): string {
  return join(sourceModulesDir, basename(dirname(fileURLToPath(specifier))), 'migrations');
}
