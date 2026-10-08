// SPDX-License-Identifier: MIT
import { type AnyRoute, trimPathLeft } from '@tanstack/react-router';
import { createMountRoutes, type PlantRoute } from './routes.ts';

/** The default export of a remote's ./module entry (ADR 0019). It has no nav list (ADR 0062). */
export interface WebModule {
  /** Equals the module's manifest id and its path segment under /$plant. */
  readonly id: string;
  /** Equals the module's manifest version. */
  readonly version: string;
  /** Returns the module's route subtree, whose top route has the module id as its path. */
  routes(plantRoute: PlantRoute): AnyRoute;
}

/** The server's entry for one module in the web module list. */
export interface WebModuleEntry {
  readonly id: string;
  readonly version: string;
}

export function defineWebModule(module: WebModule): WebModule {
  return module;
}

/** Returns one problem for each way the value a remote exported differs from its server entry. */
export function validateWebModule(value: unknown, entry: WebModuleEntry): string[] {
  const module = value as Partial<Record<keyof WebModule, unknown>>;
  const problems: string[] = [];
  if (module.id !== entry.id) {
    problems.push(`id is ${shown(module.id)}, expected ${entry.id} from the server entry`);
  }
  if (module.version !== entry.version) {
    problems.push(
      `version is ${shown(module.version)}, expected ${entry.version} from the server entry`,
    );
  }
  if (typeof module.routes !== 'function') {
    problems.push(`routes is ${shown(module.routes)}, expected a function`);
    return problems;
  }
  const path = routePath(module.routes(createMountRoutes().plantRoute));
  if (path !== entry.id) {
    problems.push(`the top route path is ${shown(path)}, expected the module id ${entry.id}`);
  }
  return problems;
}

// The path the router gives a route: its path option without leading slashes. A pathless route
// has an id option instead, and no path.
function routePath(route: AnyRoute): string | undefined {
  const { options } = route;
  return 'path' in options && typeof options.path === 'string'
    ? trimPathLeft(options.path)
    : undefined;
}

function shown(field: unknown): string {
  return field === undefined ? 'missing' : String(field);
}
