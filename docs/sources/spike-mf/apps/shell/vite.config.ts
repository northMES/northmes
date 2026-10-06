import { createRequire } from "node:module";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { SINGLETONS } from "../../packages/web-build/shared.mjs";

const require = createRequire(import.meta.url);
function versionOf(spec: string): string {
  const parts = spec.split("/");
  const pkg = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
  try {
    return require(`${pkg}/package.json`).version;
  } catch {
    return "0.1.0"; // workspace packages without a package.json export
  }
}
const sharedVersions = Object.fromEntries(SINGLETONS.map((s) => [s, versionOf(s)]));

const cssMode = process.env.SHELL_CSS ?? "shell-only";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __SHARED_VERSIONS__: JSON.stringify(sharedVersions) },
  resolve: {
    alias: {
      "shell-styles": new URL(
        cssMode === "scan-modules" ? "./src/styles-scan-modules.css" : "./src/styles.css",
        import.meta.url,
      ).pathname,
    },
  },
  build: { target: "esnext" },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": "http://localhost:3310", "/graphql": "http://localhost:3310", "/modules": "http://localhost:3310" },
  },
});
