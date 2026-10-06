import type { CodegenConfig } from "@graphql-codegen/cli";
const config: CodegenConfig = {
  schema: "out/supergraph.api.graphql",
  documents: ["web/**/*.graphql"],
  generates: { "web/planning/__generated__/graphql.ts": { plugins: ["typescript-operations", "typed-document-node"] } },
};
export default config;
