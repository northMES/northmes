import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
// graphql 16 ships index.js (CJS, "main") and index.mjs ("module"). Node loads
// index.js for packages in node_modules; Vite would resolve index.mjs for code it
// transforms. Two copies break instanceof (GraphQLError, GraphQLSchema). Pin one.
const graphqlCjs = fileURLToPath(import.meta.resolve("graphql"));
export default defineConfig({
  resolve: process.env.SPIKE_NO_GRAPHQL_ALIAS === "1" ? {} : { alias: [{ find: /^graphql$/, replacement: graphqlCjs }] },
  test: { include: ["test/**/*.test.mjs"], testTimeout: 60_000, hookTimeout: 120_000, pool: "forks", fileParallelism: false },
});
