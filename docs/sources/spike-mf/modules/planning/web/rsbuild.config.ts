import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { remoteShared } from "../../../packages/web-build/shared.mjs";

export default defineConfig(({ command }) => ({
  source: { entry: { index: "./src/rsbuild-noop.ts" } },
  resolve: { alias: { "@module-styles": new URL("../../../packages/web-build/empty.css", import.meta.url).pathname } },
  plugins: [
    pluginReact(),
    pluginModuleFederation({
      name: "planning",
      exposes: { "./module": "./src/module.tsx" },
      shared: remoteShared({ dev: command === "dev" }),
      manifest: true,
      dts: false,
    }),
  ],
  output: {
    distPath: { root: "dist-rsbuild" },
    assetPrefix: command === "dev" ? "http://localhost:5176/" : "/modules/planning/0.1.0/",
  },
  server: { port: 5176, strictPort: true, cors: true },
  html: { template: undefined },
  tools: { htmlPlugin: false },
}));
