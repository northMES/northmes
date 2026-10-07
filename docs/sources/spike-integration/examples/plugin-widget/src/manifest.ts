import { defineModule } from "@northmes/sdk";

/** Web-only plugin: no server part, no migrations. Contributes to a slot owned by planning. */
export default defineModule({
  id: "example-widget",
  version: "0.1.0",
  northmes: ">=0.1.0 <0.2.0",
  dependsOn: ["planning"],
  web: { label: "Large orders", permission: "planning.productionOrder:read", contributes: ["planning/board/side/v1"] },
});
