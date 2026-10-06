import { defineModule } from "@northmes/sdk";

export default defineModule({
  id: "core",
  version: "0.1.0",
  northmes: ">=0.1.0 <0.2.0",
  permissions: { "core.article": ["read", "write"] },
  roles: { viewer: ["core.article:read"] },
  events: { "core.article.changed": { version: 1 } },
  personalData: [{ table: "core.user_profile", columns: ["display_name", "email"], purpose: "sign-in and attribution" }],
  server: () => import("./server/core.module.js"),
});
