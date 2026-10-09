// SPDX-License-Identifier: AGPL-3.0-or-later
import { globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { inRepoCatalog } from '../src/boot/boot.ts';
import { CoreModule } from '../src/modules/core/core.module.ts';
import { corePermissions } from '../src/modules/core/permissions.ts';
import { planningPermissions } from '../src/modules/planning/permissions.ts';
import { PlanningModule } from '../src/modules/planning/planning.module.ts';
import { inRepoModules } from '../src/modules.ts';
import { imageVersion } from '../src/version.ts';

const modulesDir = fileURLToPath(new URL('../src/modules/', import.meta.url));

describe('the in-repo modules', () => {
  it('E02-S01 core and planning are plain Nest modules, listed in dependency order', () => {
    expect(inRepoModules).toEqual([
      { id: 'core', module: CoreModule, permissions: corePermissions, schemas: ['auth'] },
      {
        id: 'planning',
        module: PlanningModule,
        dependsOn: ['core'],
        permissions: planningPermissions,
      },
    ]);
  });

  it('E02-S01 no in-repo module has a manifest', () => {
    expect(globSync('*/northmes.module.*', { cwd: modulesDir })).toEqual([]);
  });

  it("E02-S01 the catalog reads each module's migrations from src/modules/<id>/migrations and gives it the backend's version", () => {
    const catalog = inRepoCatalog();

    expect(
      catalog.map(({ manifest, kind, migrationsDir }) => ({
        id: manifest.id,
        version: manifest.version,
        kind,
        migrationsDir,
      })),
    ).toEqual([
      {
        id: 'core',
        version: imageVersion(),
        kind: 'module',
        migrationsDir: `${modulesDir}core/migrations`,
      },
      {
        id: 'planning',
        version: imageVersion(),
        kind: 'module',
        migrationsDir: `${modulesDir}planning/migrations`,
      },
    ]);
  });
});
