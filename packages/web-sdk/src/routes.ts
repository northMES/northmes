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
 * Runs before a path under /$plant or /settings/$companyId loads, with the location asked for. It
 * may throw TanStack Router's redirect, such as to the sign-in page when nobody is signed in.
 */
export type PlantBeforeLoad = (context: { readonly location: ParsedLocation }) => void;

/** The path of the company settings mount, beside /$plant (ADR 0066). */
export const settingsPath = 'settings/$companyId';

/**
 * The components of the root route, the $plant route and the company settings route, and its
 * landing. Without one, a route renders its child.
 */
interface MountComponents {
  readonly rootComponent?: RouteComponent;
  readonly plantComponent?: RouteComponent;
  readonly plantBeforeLoad?: PlantBeforeLoad;
  /** The layout of company settings, a page without a plant (ADR 0066). */
  readonly settingsComponent?: RouteComponent;
  /** The company landing at /settings/$companyId, which lists the settings of the company. */
  readonly settingsIndexComponent?: RouteComponent;
  readonly settingsBeforeLoad?: PlantBeforeLoad;
}

/**
 * Creates a root route and, under it, the $plant route that every module mounts under and the
 * /settings/$companyId route of company settings.
 */
function createMountRoutes({
  rootComponent,
  plantComponent,
  plantBeforeLoad,
  settingsComponent,
  settingsBeforeLoad,
}: MountComponents = {}) {
  const rootRoute = createRootRoute({ component: rootComponent });
  const plantRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '$plant',
    component: plantComponent,
    beforeLoad: plantBeforeLoad,
  });
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: settingsPath,
    component: settingsComponent,
    beforeLoad: settingsBeforeLoad,
  });
  return { rootRoute, plantRoute, settingsRoute };
}

/** The root route, the parent of the shell's routes outside any plant. */
export type RootRoute = ReturnType<typeof createMountRoutes>['rootRoute'];

/** The /$plant route, the parent that a module's routes(plantRoute) builds its subtree under. */
export type PlantRoute = ReturnType<typeof createMountRoutes>['plantRoute'];

/**
 * The /settings/$companyId route, the parent that a module's settingsRoutes(settingsRoute) builds
 * its company settings subtree under (ADR 0066).
 */
export type SettingsRoute = ReturnType<typeof createMountRoutes>['settingsRoute'];

export interface ShellRoutesOptions extends MountComponents {
  /** The modules whose routes go under the $plant route, and their settings routes under settings. */
  readonly modules: readonly WebModule[];
  /** The shell's routes outside any plant, such as the sign-in page, built under the root route. */
  readonly outsidePlantRoutes?: (rootRoute: RootRoute) => readonly AnyRoute[];
}

/** A module's settings routes, whose top route must have the module id as its path. */
function settingsRoutesOf(module: WebModule, settingsRoute: SettingsRoute): AnyRoute[] {
  const route = module.settingsRoutes?.(settingsRoute);
  if (route === undefined) return [];
  const { path } = route.options as { readonly path?: unknown };
  if (path !== module.id) {
    throw new Error(
      `Module ${module.id} returned its settings routes at ${String(path)}; they go at ${module.id}`,
    );
  }
  return [route];
}

/**
 * Builds the shell's route tree: the root route, the $plant route under it, each module's
 * routes(plantRoute) under the $plant route, so a module's screens live at /$plant/<id>, the
 * company settings route /settings/$companyId with the shell's landing and each module's
 * settingsRoutes(settingsRoute) at /settings/$companyId/<id> (ADR 0066), and the shell's own routes
 * outside any plant beside them. A module whose settings routes sit at another path than its id
 * throws. plantBeforeLoad guards every path under /$plant, and settingsBeforeLoad every path under
 * /settings/$companyId. The root, $plant and settings components render their child route through
 * Outlet; the shell's $plant component renders ShellProvider for the plant in the URL.
 */
export function createShellRoutes({
  modules,
  outsidePlantRoutes,
  settingsIndexComponent,
  ...components
}: ShellRoutesOptions) {
  const { rootRoute, plantRoute, settingsRoute } = createMountRoutes(components);
  const landing = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/',
    component: settingsIndexComponent,
  });
  return rootRoute.addChildren([
    plantRoute.addChildren(modules.map((module) => module.routes(plantRoute))),
    settingsRoute.addChildren([
      landing,
      ...modules.flatMap((module) => settingsRoutesOf(module, settingsRoute)),
    ]),
    ...(outsidePlantRoutes?.(rootRoute) ?? []),
  ]);
}
