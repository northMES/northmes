import { defineWebModule } from "@northmes/web-sdk";
import { createPlanningRoutes } from "./routes";
import "@module-styles";

export default defineWebModule({
  id: "planning",
  version: "0.1.0",
  northmesRange: ">=0.1.0 <0.2.0",
  permissions: ["planning.productionOrder:read"],
  routes: createPlanningRoutes,
  nav: [{ id: "planning.board", label: "Planning board", to: "planning/board" }],
  contributions: [],
});
