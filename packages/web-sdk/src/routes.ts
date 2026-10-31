// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import {
  type AnyRoute,
  createRootRoute,
  createRoute,
  type ParsedLocation,
  type RouteComponent,
} from '@tanstack/react-router';
import type { WebModule } from './web-module.ts';

/**
 * Runs before a path under /$plant loads, settings pages included, with the location asked for. It
 * may throw TanStack Router's redirect, such as to the sign-in page when nobody is signed in.
 */
export type PlantBeforeLoad = (context: { readonly location: ParsedLocation }) => void;

/** The path segment of a plant's settings, /$plant/settings, where every settings page sits (#876). */
export const settingsPath = 'settings';

/** The href of a plant's settings landing, /<plant>/settings (ADR 0066, #876). */
export function settingsHref(plant: string): string {
  return `/${encodeURIComponent(plant)}/${settingsPath}`;
}

/**
 * The components of the root route and the $plant route, and the settings landing. Without one, a
 * route renders its child.
 */
interface MountComponents {
  readonly rootComponent?: RouteComponent;
  readonly plantComponent?: RouteComponent;
  readonly plantBeforeLoad?: PlantBeforeLoad;
  /** The settings landing at /$plant/settings, which leads on to the first settings page. */
  readonly settingsIndexComponent?: RouteComponent;
}

/**
 * Creates a root route, under it the $plant route that every module mounts under, and under that
 * the /$plant/settings route of the plant's settings, the company's pages included (#876).
 */
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
  const settingsRoute = createRoute({ getParentRoute: () => plantRoute, path: settingsPath });
  return { rootRoute, plantRoute, settingsRoute };
}

/** The root route, the parent of the shell's routes outside any plant. */
export type RootRoute = ReturnType<typeof createMountRoutes>['rootRoute'];

/** The /$plant route, the parent that a module's routes(plantRoute) builds its subtree under. */
export type PlantRoute = ReturnType<typeof createMountRoutes>['plantRoute'];

/**
 * The /$plant/settings route, the parent that a module's settingsRoutes(settingsRoute) builds its
 * settings subtree under (ADR 0066, #876).
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
 * The id of core, the platform's own module. Its routes and its settings routes are pathless, so
 * its pages sit at the plant root and at the settings root (ADR 0074).
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
 * routes at the plant root and at the settings root, the shell's own routes in every plant such as
 * All pages, and settings.
 */
function reservedSegments(
  coreRoutes: readonly AnyRoute[],
  coreSettingsRoutes: readonly AnyRoute[],
  shellRoutes: readonly AnyRoute[],
): Map<string, ReservedSegment> {
  const reserved = new Map<string, ReservedSegment>();
  reserved.set(settingsPath, { owner: 'shell', path: `/$plant/${settingsPath}` });
  for (const segment of topSegments(shellRoutes)) {
    reserved.set(segment, { owner: 'shell', path: `/$plant/${segment}` });
  }
  // Core's settings segments come last, so a segment that also leads an old plant root URL on to
  // its page under the settings root, such as people, names the page itself.
  for (const segment of topSegments(coreRoutes)) {
    reserved.set(segment, { owner: 'core', path: `/$plant/${segment}` });
  }
  for (const segment of topSegments(coreSettingsRoutes)) {
    reserved.set(segment, { owner: 'core', path: `/$plant/${settingsPath}/${segment}` });
  }
  return reserved;
}

/**
 * Builds the shell's route tree: the root route, the $plant route under it, each module's
 * routes(plantRoute) under the $plant route, so a module's screens live at /$plant/<id>, the
 * settings route /$plant/settings with the shell's landing and each module's
 * settingsRoutes(settingsRoute) at /$plant/settings/<id> (ADR 0066, #876), and the shell's own
 * routes outside any plant beside the $plant route. Core's routes are pathless, so its screens live
 * at /$plant/<page> and /$plant/settings/<page> (ADR 0074). A module whose routes or settings
 * routes sit at another path than its id throws, so does core with a path, and so does a module
 * whose id is a top-level path segment of core's routes or of the shell's. plantBeforeLoad guards
 * every path under /$plant, settings pages included. The shell's own plant routes go beside the
 * modules'. The root and $plant components render their child route through Outlet; the shell's
 * $plant component renders ShellProvider for the plant in the URL.
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
  const plantRoutes = modules.flatMap((module) =>
    module.routes === undefined
      ? []
      : [{ module, route: placed(module, module.routes(plantRoute), 'routes') }],
  );
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
    plantRoute.addChildren([
      ...plantRoutes.map(({ route }) => route),
      ...shellRoutes,
      settingsRoute.addChildren([landing, ...settingsRoutes.flatMap(({ routes }) => routes)]),
    ]),
    ...(outsidePlantRoutes?.(rootRoute) ?? []),
  ]);
}
