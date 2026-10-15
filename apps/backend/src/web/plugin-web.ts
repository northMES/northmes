// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ModuleManifest } from '@northmes/sdk';
import type { NextFunction, Request, Response } from 'express';
import { answerWithStatus, escapesThroughSymlink, IMMUTABLE } from './static-mounts.ts';

/** The path of the plugin list, and the prefix of each plugin's web files under it (ADR 0075). */
export const PLUGIN_WEB_PATH = '/api/v1/web/plugins';

/** The file of a web part that the shell imports, which pnpm plugin:build writes. */
const ENTRY = 'entry.js';

/** A loaded plugin's web part: its manifest and the web/ folder that pnpm plugin:build wrote. */
export interface PluginWebPart {
  readonly manifest: ModuleManifest & { readonly web: NonNullable<ModuleManifest['web']> };
  readonly dir: string;
}

/** What the plugin list says of one plugin, so the shell can load its screens. */
export interface PluginListing {
  readonly id: string;
  readonly version: string;
  /** The URL of the web part's entry, from the API's origin. */
  readonly entry: string;
  readonly label: string;
  readonly icon?: string;
  readonly order: number;
  readonly permission?: string;
  readonly contributes: NonNullable<NonNullable<ModuleManifest['web']>['contributes']>;
}

/**
 * The web parts of the plugins in `plugins`: each plugin whose manifest has a web block and whose
 * web folder holds the entry. A plugin without either has no screens.
 */
export function pluginWebParts(
  plugins: readonly { readonly manifest: ModuleManifest; readonly webDir?: string }[],
): PluginWebPart[] {
  return plugins.flatMap(({ manifest, webDir }) => {
    const { web } = manifest;
    if (!web || !webDir || !existsSync(join(webDir, ENTRY))) return [];
    return [{ manifest: { ...manifest, web }, dir: webDir }];
  });
}

/** The URL path of a plugin's web files, which holds its version: a version never changes. */
function filesPath({ id, version }: ModuleManifest): string {
  return `${PLUGIN_WEB_PATH}/${encodeURIComponent(id)}/${encodeURIComponent(version)}/`;
}

/** The plugin list's entry for a web part. */
export function listingOf({ manifest }: PluginWebPart): PluginListing {
  const { id, version, web } = manifest;
  return {
    id,
    version,
    entry: `${filesPath(manifest)}${ENTRY}`,
    label: web.label,
    ...(web.icon === undefined ? {} : { icon: web.icon }),
    order: web.order,
    ...(web.permission === undefined ? {} : { permission: web.permission }),
    contributes: web.contributes ?? [],
  };
}

/**
 * The origin rule of WebOriginsModule for the file mounts, which run before Nest's middleware: a
 * request from no origin or the API's own passes, one from a web origin passes with its
 * Access-Control-Allow-Origin so it can load the file as a module script, and any other is refused
 * with 403. The files are public, so the rule allows no credentials.
 */
function originRule(publicOrigin: string, webOrigins: readonly string[]) {
  const allowed = new Set(webOrigins);
  return (request: Request, response: Response, next: NextFunction): void => {
    const origin = request.headers.origin;
    // The answer depends on Origin, so a shared cache keeps one copy per origin.
    response.setHeader('Vary', 'Origin');
    if (origin === undefined || origin === publicOrigin) {
      next();
      return;
    }
    if (!allowed.has(origin)) {
      response.status(403).end();
      return;
    }
    response.setHeader('Access-Control-Allow-Origin', origin);
    next();
  };
}

/**
 * Serves each plugin's web part at /api/v1/web/plugins/<id>/<version>/<file> (ADR 0075). The files
 * are immutable and nosniff, a file missing under the mount or any other path under the prefix
 * answers 404 with an empty body, and a path that leaves the web folder, through a symlink too,
 * answers 404. The files are public, as the web build's are: a module script carries no bearer
 * token. Call it before the app initialises, so the mounts come before the routes.
 */
export function mountPluginWeb(
  app: NestExpressApplication,
  parts: readonly PluginWebPart[],
  { publicOrigin, webOrigins }: { publicOrigin: string; webOrigins: readonly string[] },
): void {
  for (const { manifest, dir } of parts) {
    const prefix = filesPath(manifest);
    app.use(prefix, originRule(publicOrigin, webOrigins));
    app.use(prefix, (request: Request, response: Response, next: NextFunction) => {
      if (escapesThroughSymlink(dir, request.path)) response.status(404).end();
      else next();
    });
    app.useStaticAssets(dir, {
      prefix,
      index: false,
      fallthrough: false,
      dotfiles: 'deny',
      setHeaders: (response: ServerResponse) => {
        response.setHeader('Cache-Control', IMMUTABLE);
        response.setHeader('X-Content-Type-Options', 'nosniff');
      },
    });
    app.use(prefix, answerWithStatus);
  }
  // A path under the prefix that no plugin's mount took, such as an earlier version, is a 404; the
  // prefix itself is the plugin list's route.
  app.use(PLUGIN_WEB_PATH, (request: Request, response: Response, next: NextFunction) => {
    if (request.path === '/') next();
    else response.status(404).end();
  });
}
