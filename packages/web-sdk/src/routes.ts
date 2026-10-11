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

/** The href of a company's settings landing, /settings/<company id> (ADR 0066). */
export function companySettingsHref(companyId: string): string {
  return `/${settingsPath.replace('$companyId', encodeURIComponent(companyId))}`;
}

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
  /** The shell's own routes in every plant, such as All pages, built under the $plant route. */
  readonly plantShellRoutes?: (plantRoute: PlantRoute) => readonly AnyRoute[];
}

/**
 * The id of core, the platform's own module. Its routes and its company settings routes are
 * pathless, so its pages sit at the plant root and at the company settings root (ADR 0074).
 */
export const coreModuleId = 'core';

/** The path a route was created with, or undefined for a pathless route. */
function pathOf(route: AnyRoute): string | undefined {
  const { path } = route.options as { readonly path?: unknown };
  return typeof path === 'string' ? path : undefined;
}

/**
 * A module's top route, which must be pathless for core and have the module id as its path for
 * every other module. `kind` names the routes in the error: routes or settings routes.
 */
function placed(module: WebModule, route: AnyRoute, kind: string): AnyRoute {
  const path = pathOf(route);
  if (module.id === coreModuleId) {
    if (path !== undefined) {
      throw new Error(
        `Module core returned its ${kind} at ${path}; core's ${kind} have no path (ADR 0074)`,
      );
    }
  } else if (path !== module.id) {
    throw new Error(
      `Module ${module.id} returned its ${kind} at ${String(path)}; they go at ${module.id}`,
    );
  }
  return route;
}

/** A module's settings routes, placed as `placed` checks, or none. */
function settingsRoutesOf(module: WebModule, settingsRoute: SettingsRoute): AnyRoute[] {
  const route = module.settingsRoutes?.(settingsRoute);
  return route === undefined ? [] : [placed(module, route, 'settings routes')];
}

/** The child routes of a route, which addChildren gives as an array or as an object. */
function childrenOf(route: AnyRoute): AnyRoute[] {
  const children = route.children as readonly AnyRoute[] | Record<string, AnyRoute> | undefined;
  if (children === undefined) return [];
  return Array.isArray(children) ? [...children] : Object.values(children);
}

/** The first path segment of each route, looking through pathless routes to their children. */
function topSegments(routes: readonly AnyRoute[]): string[] {
  return routes.flatMap((route) => {
    const path = pathOf(route);
    if (path === undefined) return topSegments(childrenOf(route));
    const [segment = ''] = path.replace(/^\//, '').split('/');
    return segment === '' ? [] : [segment];
  });
}

/** Who owns a reserved path segment, and the path it stands at. */
interface ReservedSegment {
  readonly owner: 'core' | 'shell';
  readonly path: string;
}

/**
 * The path segments no other module may take as its id (ADR 0074): the top-level segments of core's
 * routes at the plant root and at the company settings root, the shell's own routes in every plant
 * such as All pages, and settings.
 */
function reservedSegments(
  coreRoutes: readonly AnyRoute[],
  coreSettingsRoutes: readonly AnyRoute[],
  shellRoutes: readonly AnyRoute[],
): Map<string, ReservedSegment> {
  const reserved = new Map<string, ReservedSegment>();
  const settings = settingsPath.split('/')[0] ?? 'settings';
  reserved.set(settings, { owner: 'shell', path: `/${settings}` });
  for (const segment of topSegments(shellRoutes)) {
    reserved.set(segment, { owner: 'shell', path: `/$plant/${segment}` });
  }
  for (const segment of topSegments(coreSettingsRoutes)) {
    reserved.set(segment, { owner: 'core', path: `/${settingsPath}/${segment}` });
  }
  for (const segment of topSegments(coreRoutes)) {
    reserved.set(segment, { owner: 'core', path: `/$plant/${segment}` });
  }
  return reserved;
}

/**
 * Builds the shell's route tree: the root route, the $plant route under it, each module's
 * routes(plantRoute) under the $plant route, so a module's screens live at /$plant/<id>, the
 * company settings route /settings/$companyId with the shell's landing and each module's
 * settingsRoutes(settingsRoute) at /settings/$companyId/<id> (ADR 0066), and the shell's own routes
 * outside any plant beside them. Core's routes are pathless, so its screens live at
 * /$plant/<page> and /settings/$companyId/<page> (ADR 0074). A module whose routes or settings
 * routes sit at another path than its id throws, so does core with a path, and so does a module
 * whose id is a top-level path segment of core's routes or of the shell's. plantBeforeLoad guards
 * every path under /$plant, and settingsBeforeLoad every path under /settings/$companyId. The
 * shell's own plant routes go beside the modules'. The root, $plant and settings components render
 * their child route through Outlet; the shell's $plant component renders ShellProvider for the
 * plant in the URL.
 */
export function createShellRoutes({
  modules,
  outsidePlantRoutes,
  plantShellRoutes,
  settingsIndexComponent,
  ...components
}: ShellRoutesOptions) {
  const { rootRoute, plantRoute, settingsRoute } = createMountRoutes(components);
  const landing = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/',
    component: settingsIndexComponent,
  });
  const plantRoutes = modules.map((module) => ({
    module,
    route: placed(module, module.routes(plantRoute), 'routes'),
  }));
  const settingsRoutes = modules.map((module) => ({
    module,
    routes: settingsRoutesOf(module, settingsRoute),
  }));
  const shellRoutes = plantShellRoutes?.(plantRoute) ?? [];
  const ofCore = ({ module }: { readonly module: WebModule }) => module.id === coreModuleId;
  const reserved = reservedSegments(
    plantRoutes.filter(ofCore).map(({ route }) => route),
    settingsRoutes.filter(ofCore).flatMap(({ routes }) => routes),
    shellRoutes,
  );
  for (const { id } of modules) {
    const segment = id === coreModuleId ? undefined : reserved.get(id);
    if (segment !== undefined) {
      throw new Error(
        `Module id "${id}" is reserved: ${segment.path} is a ${segment.owner} web path segment`,
      );
    }
  }
  return rootRoute.addChildren([
    plantRoute.addChildren([...plantRoutes.map(({ route }) => route), ...shellRoutes]),
    settingsRoute.addChildren([landing, ...settingsRoutes.flatMap(({ routes }) => routes)]),
    ...(outsidePlantRoutes?.(rootRoute) ?? []),
  ]);
}
