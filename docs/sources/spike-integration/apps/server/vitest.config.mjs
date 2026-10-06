import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
// graphql 16 dual package: pin one copy for code Vite transforms (internal research note 18).
const graphqlCjs = fileURLToPath(import.meta.resolve("graphql"));
export default defineConfig({
  resolve: { alias: [{ find: /^graphql$/, replacement: graphqlCjs }] },
  test: { include: ["test/**/*.test.mjs"], testTimeout: 60_000, hookTimeout: 180_000, pool: "forks", fileParallelism: true },
});
