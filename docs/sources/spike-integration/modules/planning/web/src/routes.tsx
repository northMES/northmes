import { createRoute, lazyRouteComponent, Outlet } from "@tanstack/react-router";
import type { PlantRoute } from "@northmes/web-sdk/routes";

export function createPlanningRoutes(plantRoute: PlantRoute) {
  const planningRoute = createRoute({ getParentRoute: () => plantRoute, path: "planning", component: () => <section className="flex flex-col gap-4"><Outlet /></section> });
  const boardRoute = createRoute({ getParentRoute: () => planningRoute, path: "board", component: lazyRouteComponent(() => import("./board-screen"), "BoardScreen") });
  return planningRoute.addChildren([boardRoute]);
}

export type PlanningRouteTree = ReturnType<typeof createPlanningRoutes>;
