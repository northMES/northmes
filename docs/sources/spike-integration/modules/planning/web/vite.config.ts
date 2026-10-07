import { defineConfig } from "vite";
import { defineRemoteConfig } from "../../../packages/web-build/remote.mjs";

export default defineConfig(defineRemoteConfig({ id: "planning", version: "0.1.0", devPort: 5174 }));
