// SPDX-License-Identifier: MIT
import { createRootRoute, createRoute } from '@tanstack/react-router';
import type { WebModule } from './web-module.ts';

/** Creates the shell's root route and, under it, the $plant route that every module mounts under. */
export function createMountRoutes() {
  const rootRoute = createRootRoute();
  const plantRoute = createRoute({ getParentRoute: () => rootRoute, path: '$plant' });
  return { rootRoute, plantRoute };
}

/** The /$plant route, the parent that a module's routes(plantRoute) builds its subtree under. */
export type PlantRoute = ReturnType<typeof createMountRoutes>['plantRoute'];

export interface ShellRoutesOptions {
  /** The loaded modules, each checked with validateWebModule. */
  readonly modules: readonly WebModule[];
}

/**
 * Builds the shell's route tree: the root route, the $plant route under it, and each module's
 * routes(plantRoute) under the $plant route, so a module's screens live at /$plant/<id>.
 */
export function createShellRoutes({ modules }: ShellRoutesOptions) {
  const { rootRoute, plantRoute } = createMountRoutes();
  return rootRoute.addChildren([
    plantRoute.addChildren(modules.map((module) => module.routes(plantRoute))),
  ]);
}
