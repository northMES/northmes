import type { Router } from "@tanstack/react-router";
import type { ShellRoutes } from "@northmes/web-sdk/routes";
import type { PlanningRouteTree } from "./routes";

// Type-only. Nothing imports this file at run time; it is in the TypeScript program through
// tsconfig "include". It tells this module's program what the route tree looks like from
// here: the shell's public skeleton ("/$plant") plus this module's own subtree.
declare const shell: ShellRoutes;
declare const planning: PlanningRouteTree;
const treeForTypes = () => shell.rootRoute.addChildren([shell.plantRoute.addChildren([planning])]);

declare module "@tanstack/react-router" {
  interface Register {
    router: Router<ReturnType<typeof treeForTypes>>;
  }
}
