import { rolldown } from "rolldown";
import { isHostProvided } from "@northmes/sdk/host-provided";
const bundle = await rolldown({ input: { manifest: "src/manifest.ts" }, platform: "node", external: (id) => id.startsWith("node:") || isHostProvided(id) });
await bundle.write({ dir: "dist", format: "esm", entryFileNames: "[name].js" });
