import "reflect-metadata";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Body, Controller, Get, Module, Post, Query, Req, Res } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { buildSchema, graphql } from "graphql";
import { enabledRemotesFor, type RemoteOnDisk } from "./web-modules.js";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const shellDist = process.env.SHELL_DIST ?? join(repo, "apps/shell/dist");
const planningDist = process.env.PLANNING_DIST ?? join(repo, "modules/planning/web/dist");

const installed: RemoteOnDisk[] = [
  { id: "planning", version: "0.1.0", remoteName: "planning", dir: planningDist, permission: "planning.board.read" },
  // A plugin-style remote with a prefixed stylesheet.
  { id: "quality", version: "0.1.0", remoteName: "quality", dir: join(repo, "modules/quality/web/dist"), permission: "planning.board.read" },
  // Installed and enabled, but its files are missing: the shell must survive it.
  { id: "inventory", version: "0.1.0", remoteName: "inventory", dir: join(repo, "modules/inventory/web/dist"), permission: "planning.board.read" },
  // Installed but disabled for this organization: never listed, never fetched.
  { id: "maintenance", version: "0.1.0", remoteName: "maintenance", dir: join(repo, "modules/maintenance/web/dist"), permission: "planning.board.read" },
];

const enabled = new Set((process.env.ENABLED_MODULES ?? "planning,quality,inventory").split(","));

// In dev the module list points at the remote's Vite dev server instead of built files.
const devRemotes = process.env.DEV_REMOTES === "1";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const schema = buildSchema(`
  type Plant { id: ID! name: String! }
  type Query { plant(id: ID!): Plant }
  type Mutation { renamePlant(id: ID!, name: String!): Plant }
`);
const plants = new Map([["plant-a", { id: "plant-a", name: "Plant A" }]]);
const rootValue = {
  plant: ({ id }: { id: string }) => plants.get(id) ?? null,
  renamePlant: ({ id, name }: { id: string; name: string }) => {
    const plant = plants.get(id);
    if (!plant) return null;
    plant.name = name;
    return plant;
  },
};

@Controller()
class WebController {
  @Get("api/web/modules")
  modules(@Query("plant") _plant: string) {
    if (devRemotes) {
      // Written by the dev orchestrator: one Vite dev server per module, ports derived from the list.
      const list = JSON.parse(process.env.NORTHMES_DEV_REMOTES ?? "[]") as { id: string; port: number }[];
      return {
        modules: list.map((m) => ({
          id: m.id, version: "dev", remoteName: m.id,
          manifestUrl: `http://localhost:${m.port}/mf-manifest.json`, integrity: null,
        })),
      };
    }
    // The spike's user holds one permission; the real server reads the session and the plant role.
    return { modules: enabledRemotesFor(installed, enabled, new Set(["planning.board.read"])) };
  }

  @Post("graphql")
  async graphql(@Body() body: { query: string; variables?: Record<string, unknown>; operationName?: string }) {
    return graphql({ schema, source: body.query, rootValue, variableValues: body.variables, operationName: body.operationName });
  }

  // SPA fallback: every other GET gets the shell's index.html with the CSP header.
  @Get("*path")
  index(@Req() req: Request, @Res() res: Response) {
    if (req.path.startsWith("/modules/") || req.path.startsWith("/assets/")) {
      res.status(404).send("Not found");
      return;
    }
    res.setHeader("Content-Security-Policy", CSP);
    res.setHeader("Cache-Control", "no-cache");
    res.type("html").send(readFileSync(join(shellDist, "index.html"), "utf8"));
  }
}

@Module({ controllers: [WebController] })
class AppModule {}

async function main() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ["error", "warn"] });
  // Hashed shell assets never change under the same name.
  app.useStaticAssets(join(shellDist, "assets"), { prefix: "/assets/", immutable: true, maxAge: "1y", index: false });
  // One static mount per installed module version. Entry files have fixed names, so they
  // revalidate; hashed chunks are immutable.
  for (const remote of installed) {
    if (!existsSync(remote.dir)) continue;
    app.useStaticAssets(remote.dir, {
      prefix: `/modules/${remote.id}/${remote.version}/`,
      index: false,
      fallthrough: false,
      setHeaders(res, path) {
        const fixedName = /(mf-manifest\.json|mf-stats\.json|remoteEntry\.js)$/.test(path);
        res.setHeader("Cache-Control", fixedName ? "no-cache" : "public, max-age=31536000, immutable");
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    });
  }
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`Listening on port ${port}`);
}
main();
