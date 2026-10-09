// SPDX-License-Identifier: AGPL-3.0-or-later
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Type } from '@nestjs/common';
import { CoreModule } from './modules/core/core.module.ts';
import { PlanningModule } from './modules/planning/planning.module.ts';

/**
 * A module that ships in the backend: a plain Nest module in src/modules/<id>, with no manifest. It
 * has the backend's version (ADR 0070).
 */
export interface InRepoModule {
  /** The module's id, which names its folder, its schema and its GraphQL prefix (ADR 0003). */
  readonly id: string;
  /** The module's Nest module, src/modules/<id>/<id>.module.ts. */
  readonly module: Type;
  /** The ids of the modules it depends on, which boot before it. */
  readonly dependsOn?: readonly string[];
  /** The folder of its migration files. Without it, src/modules/<id>/migrations. */
  readonly migrationsDir?: string;
}

/**
 * The modules that ship in the backend, in dependency order. AppModule imports their Nest modules
 * in this order, and migrate applies their migrations in it, before any plugin (ADR 0002).
 */
export const inRepoModules: readonly InRepoModule[] = [
  { id: 'core', module: CoreModule },
  { id: 'planning', module: PlanningModule, dependsOn: ['core'] },
];

/** src/modules/ of the backend. The build copies no .sql file, so dist/ holds no migrations. */
const sourceModulesDir = fileURLToPath(new URL('../src/modules/', import.meta.url));

/**
 * The migrations folder of an in-repo module: src/modules/<id>/migrations, also when the backend
 * runs from dist/ (ADR 0006).
 */
export function inRepoMigrationsDir(id: string): string {
  return join(sourceModulesDir, id, 'migrations');
}
