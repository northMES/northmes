// Plugin build: host-provided packages stay external (one copy per process), everything else is bundled.
import { rmSync } from "node:fs";
import { rolldown } from "rolldown";
import { isHostProvided } from "@northmes/sdk/host-provided";

const bundleEverything = process.env.BUNDLE_HOST === "1"; // negative test: ship private copies of Nest, graphql and the SDK
const outDir = process.env.OUT_DIR ?? "dist";
rmSync(outDir, { recursive: true, force: true });
const t0 = performance.now();
const bundle = await rolldown({
  input: { manifest: "src/manifest.ts", server: "src/server.ts" },
  platform: "node",
  tsconfig: "./tsconfig.json",
  external: (id) => id.startsWith("node:") || (!bundleEverything && isHostProvided(id)),
});
const { output } = await bundle.write({ dir: outDir, format: "esm", entryFileNames: "[name].js", chunkFileNames: "chunks/[name]-[hash].js" });
console.log(`built ${output.length} files in ${Math.round(performance.now() - t0)} ms:`, output.map((o) => `${o.fileName} ${o.type === "chunk" ? o.code.length : ""}`).join(", "));
