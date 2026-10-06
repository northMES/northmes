import { createRootRoute, createRoute, type RouteComponent } from "@tanstack/react-router";

export interface ShellRouteComponents {
  readonly root: RouteComponent;
  readonly plant: RouteComponent;
}

/**
 * The shell's route skeleton. The shell calls this once with its layouts; the types
 * are exported so a module can type its own subtree and its links against "/$plant".
 */
export function createShellRoutes(components: ShellRouteComponents) {
  const rootRoute = createRootRoute({ component: components.root });
  const plantRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "$plant",
    component: components.plant,
  });
  return { rootRoute, plantRoute };
}

export type ShellRoutes = ReturnType<typeof createShellRoutes>;
export type RootRoute = ShellRoutes["rootRoute"];
export type PlantRoute = ShellRoutes["plantRoute"];
