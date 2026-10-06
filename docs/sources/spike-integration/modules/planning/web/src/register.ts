import type { Router } from "@tanstack/react-router";
import type { ShellRoutes } from "@northmes/web-sdk/routes";
import type { PlanningRouteTree } from "./routes";

declare const shell: ShellRoutes;
declare const planning: PlanningRouteTree;
const treeForTypes = () => shell.rootRoute.addChildren([shell.plantRoute.addChildren([planning])]);

declare module "@tanstack/react-router" {
  interface Register {
    router: Router<ReturnType<typeof treeForTypes>>;
  }
}
