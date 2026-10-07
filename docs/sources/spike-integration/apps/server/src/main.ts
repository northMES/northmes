import "reflect-metadata";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Type } from "@nestjs/common";
import { AppModule } from "./app.module.js";
import { checkCatalog, loadCatalog, readConfig } from "./catalog.js";
import { migrate, pendingMigrations } from "./migrate.js";
import { installPluginResolution } from "./plugin-resolution.js";
import type { LoadedCatalog } from "./tokens.js";
import { mountStatic } from "./web.js";
import { GatewayService } from "./gateway/gateway.module.js";
import { resolverIsolationProblems } from "./isolation.js";

export class BootError extends Error {
  constructor(readonly problems: string[]) {
    super(`NorthMES refused to start (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "BootError";
  }
}

const hostDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultConfig = () => process.env.NORTHMES_CONFIG ?? resolve(hostDir, "northmes.config.json");

export async function prepareCatalog(configFile = defaultConfig()) {
  const timings: Record<string, number> = {};
  let t = performance.now();
  const mark = (k: string) => { const n = performance.now(); timings[k] = Math.round((n - t) * 10) / 10; t = n; };
  const config = readConfig(configFile);
  const pluginRoots = config.plugins.map((p) => resolve(config.baseDir, p));
  const outside = pluginRoots.filter((r) => relative(hostDir, r).startsWith(".."));
  const hooks = process.env.NORTHMES_PLUGIN_HOOKS ?? "all";
  if (hooks === "all" && pluginRoots.length) installPluginResolution(pluginRoots);
  else if (hooks === "outside" && outside.length) installPluginResolution(outside);
  mark("config");
  const installed = await loadCatalog(config);
  mark("manifests");
  const { ordered, errors, dependencyClosure } = checkCatalog(installed, config.northmes);
  if (errors.length) throw new BootError(errors);
  mark("checks");
  return { config, ordered, dependencyClosure, timings, mark };
}

export async function bootstrap(opts: { configFile?: string; port?: number; databaseUrl?: string; listen?: boolean } = {}) {
  const { config, ordered, dependencyClosure, timings, mark } = await prepareCatalog(opts.configFile);
  const databaseUrl = opts.databaseUrl ?? process.env.DATABASE_URL;
  if (databaseUrl) {
    const { pending, unknown } = await pendingMigrations(databaseUrl, ordered);
    const problems = [...pending.map((p) => `migration ${p} is not applied; run northmes migrate`), ...unknown.map((u) => `database has ${u}, which this build does not know`)];
    if (problems.length) throw new BootError(problems);
    mark("migrationCheck");
  }
  const serverModules = new Map<string, Type>();
  for (const m of ordered) {
    if (!m.manifest.server) continue;
    const loaded = await m.manifest.server();
    if (typeof loaded.default !== "function") throw new BootError([`${m.manifest.id}: server entry has no default export Nest module`]);
    serverModules.set(m.manifest.id, loaded.default);
  }
  mark("serverImports");
  const catalog: LoadedCatalog = { ordered, serverModules, dependencyClosure, northmesVersion: config.northmes };
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(catalog), {
    logger: process.env.NORTHMES_LOG ? ["log", "error", "warn"] : ["error", "warn"],
    abortOnError: false,
  });
  mark("nestCreate");
  const isolation = resolverIsolationProblems(app, catalog);
  if (isolation.length) {
    await app.close();
    throw new BootError(isolation);
  }
  mountStatic(app, catalog);
  // Hive Gateway's Yoga instance registers process.once("SIGTERM") (disposeOnProcessTerminate is
  // hardcoded true), which stops Node's default exit. Nest's hooks close the app and re-raise.
  if (process.env.NORTHMES_SHUTDOWN_HOOKS !== "0") app.enableShutdownHooks(["SIGTERM", "SIGINT"]);
  await app.init();
  mark("nestInit");
  const gateway = app.get(GatewayService);
  timings.compose = Math.round((gateway.composeMs ?? 0) * 10) / 10;
  if (opts.listen !== false) {
    await app.listen(opts.port ?? Number(process.env.PORT ?? 3000), "127.0.0.1");
    mark("listen");
  }
  return { app, catalog, timings };
}

async function cli() {
  const t0 = performance.now();
  if (process.argv[2] === "schema" && process.argv[3] === "print") {
    const out = process.argv[4] ?? "schema";
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const { SubgraphRegistry } = await import("@northmes/sdk");
    const { composeServices } = await import("@theguild/federation-composition");
    const { parse } = await import("graphql");
    const { app } = await bootstrap({ listen: false });
    const subgraphs = app.get(SubgraphRegistry).all();
    mkdirSync(`${out}/subgraphs`, { recursive: true });
    for (const s of subgraphs) writeFileSync(`${out}/subgraphs/${s.name}.graphql`, s.sdl);
    const result = composeServices(subgraphs.map((s) => ({ name: s.name, typeDefs: parse(s.sdl), url: s.url }))) as any;
    writeFileSync(`${out}/supergraph.graphql`, result.supergraphSdl);
    writeFileSync(`${out}/api.graphql`, result.publicSdl);
    console.log(`wrote ${subgraphs.length} subgraph SDLs, supergraph and api schema to ${out}`);
    await app.close();
    return;
  }
  if (process.argv[2] === "migrate") {
    const { ordered } = await prepareCatalog();
    const { applied } = await migrate(process.env.DATABASE_OWNER_URL!, ordered);
    console.log(`applied ${applied.length}: ${applied.join(", ")}`);
    return;
  }
  const { app, catalog, timings } = await bootstrap();
  const port = process.env.PORT ?? 3000;
  console.log(`Listening on port ${port}`);
  console.log(`modules=${catalog.ordered.map((m) => `${m.manifest.id}@${m.manifest.version}${m.kind === "plugin" ? "(plugin)" : ""}`).join(",")}`);
  console.log(`supergraph=${app.get(GatewayService).supergraphHash} boot_ms=${Math.round(performance.now() - t0)} rss_mb=${Math.round(process.memoryUsage().rss / 1e6)}`);
  console.log(`phases=${JSON.stringify(timings)}`);
  if (process.env.EXIT_AFTER_BOOT === "1") { await app.close(); process.exit(0); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  cli().catch((e) => {
    console.error(e?.stack ?? String(e));
    process.exit(1);
  });
}
