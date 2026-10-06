import { defineModule } from "@northmes/sdk";
export default defineModule({ id: "wrong-target", version: "0.1.0", northmes: ">=0.1.0 <0.2.0", dependsOn: ["planning"], server: () => import("./server.js") });
