import { defineConfig } from "vite";
import { defineRemoteConfig } from "@northmes/web-build/remote";

export default defineConfig(defineRemoteConfig({ id: "example-widget", version: "0.1.0", devPort: 5190 }));
