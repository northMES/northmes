import { createRoute, lazyRouteComponent, Link, Outlet } from "@tanstack/react-router";
import type { PlantRoute } from "@northmes/web-sdk/routes";

function PlanningLayout() {
  return (
    <section data-testid="planning-layout" className="flex flex-col gap-4 p-4">
      <nav className="flex gap-3 text-sm">
        {/* Typed link: the module's own Register (register.ts) knows "/$plant/planning/board". */}
        <Link from="/$plant" to="/$plant/planning/board">Board</Link>
        <Link from="/$plant" to="/$plant/planning/orders/$orderId" params={{ orderId: "4101" }}>
          Order 4101
        </Link>
      </nav>
      <Outlet />
    </section>
  );
}

export function createPlanningRoutes(plantRoute: PlantRoute) {
  const planningRoute = createRoute({
    getParentRoute: () => plantRoute,
    path: "planning",
    component: PlanningLayout,
  });
  const boardRoute = createRoute({
    getParentRoute: () => planningRoute,
    path: "board",
    component: lazyRouteComponent(() => import("./board-screen"), "BoardScreen"),
  });
  const orderRoute = createRoute({
    getParentRoute: () => planningRoute,
    path: "orders/$orderId",
    component: lazyRouteComponent(() => import("./order-screen"), "OrderScreen"),
  });
  const brokenRoute = createRoute({
    getParentRoute: () => planningRoute,
    path: "broken",
    component: () => {
      throw new Error("planning screen crashed");
    },
  });
  return planningRoute.addChildren([boardRoute, orderRoute, brokenRoute]);
}

export type PlanningRouteTree = ReturnType<typeof createPlanningRoutes>;
