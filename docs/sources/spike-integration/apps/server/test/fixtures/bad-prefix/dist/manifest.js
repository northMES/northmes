import { defineModule } from "@northmes/sdk";
export default defineModule({ id: "bad-prefix", version: "0.1.0", northmes: ">=0.1.0 <0.2.0", dependsOn: ["core"], permissions: { "planning.productionOrder": ["delete"] } });
