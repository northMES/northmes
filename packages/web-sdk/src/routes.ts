// SPDX-License-Identifier: MIT
import { createRootRoute, createRoute, type RouteComponent } from '@tanstack/react-router';
import type { WebModule } from './web-module.ts';

/** The components of the root route and the $plant route. Without one, a route renders its child. */
interface MountComponents {
  readonly rootComponent?: RouteComponent;
  readonly plantComponent?: RouteComponent;
}

/**
 * Creates a root route and, under it, the $plant route that every module mounts under. Internal:
 * createShellRoutes and validateWebModule each call it for routes of their own.
 */
export function createMountRoutes({ rootComponent, plantComponent }: MountComponents = {}) {
  const rootRoute = createRootRoute({ component: rootComponent });
  const plantRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '$plant',
    component: plantComponent,
  });
  return { rootRoute, plantRoute };
}

/** The /$plant route, the parent that a module's routes(plantRoute) builds its subtree under. */
export type PlantRoute = ReturnType<typeof createMountRoutes>['plantRoute'];

export interface ShellRoutesOptions extends MountComponents {
  /** The loaded modules, each checked with validateWebModule. */
  readonly modules: readonly WebModule[];
}

/**
 * Builds the shell's route tree: the root route, the $plant route under it, and each module's
 * routes(plantRoute) under the $plant route, so a module's screens live at /$plant/<id>. The root
 * and $plant components render their child route through Outlet; the shell's $plant component
 * renders ShellProvider for the plant in the URL.
 */
export function createShellRoutes({ modules, ...components }: ShellRoutesOptions) {
  const { rootRoute, plantRoute } = createMountRoutes(components);
  return rootRoute.addChildren([
    plantRoute.addChildren(modules.map((module) => module.routes(plantRoute))),
  ]);
}
