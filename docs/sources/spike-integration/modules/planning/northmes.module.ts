import { defineModule } from "@northmes/sdk";

export default defineModule({
  id: "planning",
  version: "0.1.0",
  northmes: ">=0.1.0 <0.2.0",
  dependsOn: ["core"],
  permissions: {
    "planning.productionOrder": ["read", "release"],
    "planning.batchRow": ["read", "schedule"],
  },
  roles: {
    planner: ["planning.productionOrder:read", "planning.productionOrder:release", "planning.batchRow:schedule"],
    viewer: ["planning.productionOrder:read"],
  },
  events: { "planning.production_order.released": { version: 1 } },
  commands: { "planning.releaseProductionOrder": { validatable: true } },
  web: { label: "Planning", permission: "planning.productionOrder:read", slots: ["planning/board/side/v1"] },
  subscriptions: true,
  server: () => import("./server/planning.module.js"),
});
