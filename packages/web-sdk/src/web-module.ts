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

/**
 * Returns one problem for each way the value a remote's ./module exported differs from the
 * module's entry in the server's web module list, or an empty list. To read the top route's path,
 * it calls the module's routes function with a $plant route of its own, which the shell's route
 * tree never sees.
 */
export function validateWebModule(value: unknown, entry: WebModuleEntry): string[] {
  if (typeof value !== 'object' || value === null) {
    return [`the module is ${shown(value)}, expected an object`];
  }
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
  const route: unknown = module.routes(createMountRoutes().plantRoute);
  if (!isRoute(route)) {
    problems.push('routes did not return a route');
    return problems;
  }
  const path = routePath(route);
  if (path !== entry.id) {
    problems.push(`the top route path is ${shown(path)}, expected the module id ${entry.id}`);
  }
  return problems;
}

// Whether a value has the options object that every route the router builds has.
function isRoute(value: unknown): value is AnyRoute {
  return (
    typeof value === 'object' &&
    value !== null &&
    'options' in value &&
    typeof value.options === 'object' &&
    value.options !== null
  );
}

// The path the router gives a route: its path option without leading slashes. A pathless route
// has an id option instead, and no path.
function routePath(route: AnyRoute): string | undefined {
  const { options } = route;
  return 'path' in options && typeof options.path === 'string'
    ? trimPathLeft(options.path)
    : undefined;
}

// How a problem shows a value: undefined reads as missing.
function shown(field: unknown): string {
  return field === undefined ? 'missing' : String(field);
}
