// SPDX-License-Identifier: MIT
import { createRootRoute, createRoute } from '@tanstack/react-router';

/** Creates the shell's root route and, under it, the $plant route that every module mounts under. */
export function createMountRoutes() {
  const rootRoute = createRootRoute();
  const plantRoute = createRoute({ getParentRoute: () => rootRoute, path: '$plant' });
  return { rootRoute, plantRoute };
}

/** The /$plant route, the parent that a module's routes(plantRoute) builds its subtree under. */
export type PlantRoute = ReturnType<typeof createMountRoutes>['plantRoute'];
