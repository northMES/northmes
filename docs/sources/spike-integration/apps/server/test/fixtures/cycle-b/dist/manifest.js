import { defineModule } from "@northmes/sdk";
export default defineModule({ id: "cycle-b", version: "0.1.0", northmes: ">=0.1.0 <0.2.0", dependsOn: ["cycle-a"] });
