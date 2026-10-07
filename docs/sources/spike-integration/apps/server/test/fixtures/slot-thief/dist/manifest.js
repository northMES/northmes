import { defineModule } from "@northmes/sdk";
export default defineModule({ id: "slot-thief", version: "0.1.0", northmes: ">=0.1.0 <0.2.0", dependsOn: ["core"], web: { label: "Thief", contributes: ["planning/board/side/v1"] } });
