// What a plugin's CI runs, using only the MIT SDK, Nest and the plugin's own build. No AGPL host code.
import "reflect-metadata";
import { readFileSync, readdirSync } from "node:fs";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { defineSubgraph, SubgraphRegistry, SubgraphRegistryModule, moduleNames } from "@northmes/sdk";
import { composeServices, compositionHasErrors } from "@theguild/federation-composition";
import { buildSchema, parse, validate } from "graphql";

const t0 = performance.now();
const manifest = (await import("./dist/manifest.js")).default;
const pluginModule = (await manifest.server()).default;
const name = moduleNames(manifest.id).gql;
class PrintModule {}
Module({ imports: [SubgraphRegistryModule, pluginModule, defineSubgraph({ name, module: pluginModule })] })(PrintModule);
const app = await NestFactory.create(PrintModule, { logger: ["error"] });
await app.init();
const own = app.get(SubgraphRegistry).all()[0];
await app.close();
const snapshotDir = process.env.SNAPSHOT ?? "../../schema-snapshot/subgraphs";
const published = readdirSync(snapshotDir).map((f) => ({ name: f.replace(".graphql", ""), typeDefs: parse(readFileSync(`${snapshotDir}/${f}`, "utf8")), url: `inproc://${f}` }));
const result = composeServices([...published, { name: own.name, typeDefs: parse(own.sdl), url: "inproc://plugin" }]);
if (compositionHasErrors(result)) {
  console.log("COMPOSITION FAILED:", result.errors.map((e) => e.message).join(" | "));
  process.exit(1);
}
const api = buildSchema(result.publicSdl);
const doc = parse(`{ planningProductionOrders { edges { node { number exampleValidatorBlockReason } } } }`);
console.log(JSON.stringify({ ownSdlBytes: own.sdl.length, composedWith: published.map((p) => p.name), validationErrors: validate(api, doc).map((e) => e.message), ms: Math.round(performance.now() - t0) }));
