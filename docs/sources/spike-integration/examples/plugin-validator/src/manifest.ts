import { defineModule } from "@northmes/sdk";

export default defineModule({
  id: "example-validator",
  version: "0.1.0",
  northmes: ">=0.1.0 <0.2.0",
  dependsOn: ["planning"],
  permissions: { "exampleValidator.rule": ["read"] },
  server: () => import("./server.js"),
});
