import { federation } from "@module-federation/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { remoteShared } from "./shared.mjs";

/**
 * One call per module: the expose is named once here, and this factory writes it into both
 * the federation config and the bundler input (a remote has no index.html).
 */
// Entry files of shared workspace packages. The federation plugin reads their export names
// once per dev server; a changed export list needs a fresh remote dev server.
const sharedEntryFiles = [new URL("../web-sdk/src/index.ts", import.meta.url).pathname];

function restartOnSharedExportChange() {
  return {
    name: "northmes:restart-on-shared-export-change",
    apply: "serve",
    configureServer(server) {
      server.watcher.add(sharedEntryFiles);
      server.watcher.on("change", (file) => {
        if (sharedEntryFiles.includes(file)) {
          server.config.logger.info(`[northmes] ${file} changed; restarting this remote dev server`);
          server.restart();
        }
      });
    },
  };
}

// Fails the build when code from a singleton package ends up inside a remote's chunks,
// for example through an unshared subpath such as "@apollo/client/cache".
import { SINGLETONS } from "./shared.mjs";
const singletonPackages = [...new Set(SINGLETONS.map((s) => (s.startsWith("@") ? s.split("/").slice(0, 2).join("/") : s.split("/")[0])))];
function noBundledSingletons() {
  return {
    name: "northmes:no-bundled-singletons",
    apply: "build",
    generateBundle(_options, bundle) {
      const offenders = new Set();
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue;
        for (const id of chunk.moduleIds) {
          const norm = id.replaceAll("\\", "/");
          for (const pkg of singletonPackages) {
            const inNodeModules = norm.includes(`/node_modules/${pkg}/`);
            const inWorkspace = pkg === "@northmes/web-sdk" && norm.includes("/packages/web-sdk/src/");
            if (inNodeModules || inWorkspace) offenders.add(`${pkg} (${norm.split("/node_modules/").pop()}) in ${chunk.fileName}`);
          }
        }
      }
      if (offenders.size > 0) this.error(`singleton code bundled into this remote:\n  ${[...offenders].join("\n  ")}`);
    },
  };
}

export function defineRemoteConfig({ id, version, entry = "./src/module.tsx", devPort: fixedPort, styles = "./src/styles.css" }) {
  // The dev orchestrator assigns ports; a hand-written port is only a fallback.
  const devPort = Number(process.env.NORTHMES_DEV_PORT ?? fixedPort);
  // REMOTE_CSS=none: the module ships no CSS; the shell build scans its sources instead.
  const stylesFile = process.env.REMOTE_CSS === "none" ? new URL("./empty.css", import.meta.url).pathname : resolve(styles);
  return ({ command }) => ({
    resolve: { alias: { "@module-styles": stylesFile } },
    base: command === "serve" ? `http://localhost:${devPort}/` : `/modules/${id}/${version}/`,
    plugins: [
      restartOnSharedExportChange(),
      noBundledSingletons(),
      react(),
      tailwindcss(),
      federation({
        name: id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()),
        filename: "remoteEntry.js",
        manifest: true,
        exposes: { "./module": entry },
        shared: remoteShared({ dev: command === "serve" }),
        dts: false,
        dev: { remoteHmr: true },
        ...(process.env.EXTERNAL_RUNTIME === "1" ? { experiments: { externalRuntime: true } } : {}),
      }),
    ],
    build: { target: "esnext", outDir: "dist", rolldownOptions: { input: { module: entry } } },
    server: { port: devPort, strictPort: true, origin: `http://localhost:${devPort}`, cors: true },
  });
}
