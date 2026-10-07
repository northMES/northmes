import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Controller, Get, Inject, Module, Req, Res } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { resolvePrincipal } from "./gateway/sessions.js";
import { GatewayModule, GatewayService } from "./gateway/gateway.module.js";
import { CATALOG, type LoadedCatalog } from "./tokens.js";
import type { InstalledModule } from "./catalog.js";

export const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self'", "connect-src 'self'",
  "img-src 'self' data:", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'",
].join("; ");

/** One layout for in-repo modules and plugin packages: <package>/web/dist holds the built remote. */
export const webDistOf = (m: InstalledModule) => join(m.dir, "web", "dist");

const sri = (file: string) => `sha384-${createHash("sha384").update(readFileSync(file)).digest("base64")}`;

export const shellDist = () => process.env.SHELL_DIST ?? new URL("../../shell/dist", import.meta.url).pathname;

@Controller()
class WebController {
  constructor(
    @Inject(CATALOG) private readonly catalog: LoadedCatalog,
    @Inject(GatewayService) private readonly gateway: GatewayService,
  ) {}

  /** Only modules that are installed, built, and readable by this user at the requested plant. */
  @Get("api/web/modules")
  modules(@Req() req: Request, @Res() res: Response) {
    const principal = resolvePrincipal(req.headers.cookie, (req.query.plant as string) ?? null);
    const modules = this.catalog.ordered
      .filter((m) => m.manifest.web)
      .filter((m) => !m.manifest.web!.permission || principal?.permissions.has(m.manifest.web!.permission))
      .map((m) => {
        const manifestFile = join(webDistOf(m), "mf-manifest.json");
        return {
          id: m.manifest.id,
          version: m.manifest.version,
          remoteName: m.names.remote,
          label: m.manifest.web!.label,
          manifestUrl: `/modules/${m.manifest.id}/${m.manifest.version}/mf-manifest.json`,
          integrity: existsSync(manifestFile) ? sri(manifestFile) : null,
          // Static facts from the backend manifest, so the shell need not trust remote code for them.
          dependsOn: [...this.catalog.dependencyClosure(m.manifest.id)].sort(),
          ownsSlots: m.manifest.web!.slots ?? [],
          contributes: m.manifest.web!.contributes ?? [],
        };
      });
    res.setHeader("Cache-Control", "no-store");
    res.json({ northmes: this.catalog.northmesVersion, supergraph: this.gateway.supergraphHash, modules });
  }

  @Get("health/ready")
  ready() {
    return { status: this.gateway.runtime ? "ok" : "starting", supergraph: this.gateway.supergraphHash };
  }

  @Get("*path")
  index(@Req() req: Request, @Res() res: Response) {
    if (req.path.startsWith("/modules/") || req.path.startsWith("/assets/") || req.path.startsWith("/api/")) {
      res.status(404).send("Not found");
      return;
    }
    const index = join(shellDist(), "index.html");
    if (!existsSync(index)) {
      res.status(404).send("shell not built");
      return;
    }
    res.setHeader("Content-Security-Policy", CSP);
    res.setHeader("Cache-Control", "no-cache");
    res.type("html").send(readFileSync(index, "utf8"));
  }
}

@Module({ imports: [GatewayModule], controllers: [WebController] })
export class WebModule {}

/** Static mounts: the shell's hashed assets and one path per installed module version. */
export function mountStatic(app: NestExpressApplication, catalog: LoadedCatalog) {
  const assets = join(shellDist(), "assets");
  if (existsSync(assets)) app.useStaticAssets(assets, { prefix: "/assets/", immutable: true, maxAge: "1y", index: false });
  for (const m of catalog.ordered) {
    if (!m.manifest.web || !existsSync(webDistOf(m))) continue;
    app.useStaticAssets(webDistOf(m), {
      prefix: `/modules/${m.manifest.id}/${m.manifest.version}/`,
      index: false,
      fallthrough: false,
      setHeaders(res, path) {
        const fixed = /(mf-manifest\.json|mf-stats\.json|remoteEntry\.js)$/.test(path);
        res.setHeader("Cache-Control", fixed ? "no-cache" : "public, max-age=31536000, immutable");
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    });
  }
}
