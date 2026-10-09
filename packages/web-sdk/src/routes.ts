// SPDX-License-Identifier: MIT
import {
  type AnyRoute,
  createRootRoute,
  createRoute,
  type ParsedLocation,
  type RouteComponent,
} from '@tanstack/react-router';
import type { WebModule } from './web-module.ts';

/**
 * Runs before a path under /$plant loads, with the location asked for. It may throw TanStack
 * Router's redirect, such as to the sign-in page when nobody is signed in.
 */
export type PlantBeforeLoad = (context: { readonly location: ParsedLocation }) => void;

/** The components of the root route and the $plant route. Without one, a route renders its child. */
interface MountComponents {
  readonly rootComponent?: RouteComponent;
  readonly plantComponent?: RouteComponent;
  readonly plantBeforeLoad?: PlantBeforeLoad;
}

/** Creates a root route and, under it, the $plant route that every module mounts under. */
function createMountRoutes({
  rootComponent,
  plantComponent,
  plantBeforeLoad,
}: MountComponents = {}) {
  const rootRoute = createRootRoute({ component: rootComponent });
  const plantRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '$plant',
    component: plantComponent,
    beforeLoad: plantBeforeLoad,
  });
  return { rootRoute, plantRoute };
}

/** The root route, the parent of the shell's routes outside any plant. */
export type RootRoute = ReturnType<typeof createMountRoutes>['rootRoute'];

/** The /$plant route, the parent that a module's routes(plantRoute) builds its subtree under. */
export type PlantRoute = ReturnType<typeof createMountRoutes>['plantRoute'];

export interface ShellRoutesOptions extends MountComponents {
  /** The modules whose routes go under the $plant route. */
  readonly modules: readonly WebModule[];
  /** The shell's routes outside any plant, such as the sign-in page, built under the root route. */
  readonly outsidePlantRoutes?: (rootRoute: RootRoute) => readonly AnyRoute[];
}

/**
 * Builds the shell's route tree: the root route, the $plant route under it, each module's
 * routes(plantRoute) under the $plant route, so a module's screens live at /$plant/<id>, and the
 * shell's own routes outside any plant beside the $plant route. plantBeforeLoad guards every path
 * under /$plant. The root
 * and $plant components render their child route through Outlet; the shell's $plant component
 * renders ShellProvider for the plant in the URL.
 */
export function createShellRoutes({
  modules,
  outsidePlantRoutes,
  ...components
}: ShellRoutesOptions) {
  const { rootRoute, plantRoute } = createMountRoutes(components);
  return rootRoute.addChildren([
    plantRoute.addChildren(modules.map((module) => module.routes(plantRoute))),
    ...(outsidePlantRoutes?.(rootRoute) ?? []),
  ]);
}
