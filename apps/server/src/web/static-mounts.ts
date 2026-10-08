// SPDX-License-Identifier: AGPL-3.0-or-later
import { realpathSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { basename, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { packageDirOf } from '../catalog/package-dir.ts';
import type { WebFiles } from './served-web.ts';

/**
 * The folder of a module's built remote: web/dist/ of the package that holds its manifest, which
 * manifestUrl names, for an in-repo module and a plugin alike (ADR 0037).
 */
export function webDirOf(manifestUrl: string): string {
  return join(packageDirOf(manifestUrl), 'web', 'dist');
}

/** The folder of the shell that apps/web builds. */
export const builtShellDir = fileURLToPath(new URL('../../../web/dist/', import.meta.url));

/** The Cache-Control of a file with a content hash in its name. */
const IMMUTABLE = 'public, max-age=31536000, immutable';

/**
 * The files of a remote whose names stay the same from build to build. A browser asks the server
 * again before it uses its copy of one; every other file has a content hash in its name.
 */
const FIXED_NAMES = new Set(['mf-manifest.json', 'mf-stats.json', 'remoteEntry.js']);

/**
 * Serves the shell's hashed assets at /assets/ and the built remote of each catalog module with a
 * web block at /modules/<id>/<version>/. A file missing under a mount is a 404 with an empty body.
 */
export function mountStatic(
  app: NestExpressApplication,
  { shellDir, catalog }: Pick<WebFiles, 'shellDir' | 'catalog'>,
): void {
  mount(app, join(shellDir, 'assets'), '/assets/', () => IMMUTABLE);
  for (const { manifest, webDir } of catalog) {
    if (!manifest.web || webDir === undefined) continue;
    mount(app, webDir, `/modules/${manifest.id}/${manifest.version}/`, (path) =>
      FIXED_NAMES.has(basename(path)) ? 'no-cache' : IMMUTABLE,
    );
  }
}

/**
 * Serves the files in dir at prefix with the Cache-Control that cacheControl gives each file. A
 * path whose real path lies outside dir, through a symlink, answers 404.
 */
function mount(
  app: NestExpressApplication,
  dir: string,
  prefix: string,
  cacheControl: (path: string) => string,
): void {
  app.use(prefix, (request: Request, response: Response, next: NextFunction) => {
    if (escapesThroughSymlink(dir, request.path)) response.status(404).end();
    else next();
  });
  app.useStaticAssets(dir, {
    prefix,
    index: false,
    fallthrough: false,
    setHeaders: (response: ServerResponse, path: string) =>
      response.setHeader('Cache-Control', cacheControl(path)),
  });
  app.use(prefix, answerWithStatus);
}

/**
 * Whether the file that requestPath names under dir exists and its real path lies outside the real
 * path of dir. A path that does not resolve is left to the static mount, which answers it.
 */
function escapesThroughSymlink(dir: string, requestPath: string): boolean {
  let root: string;
  let target: string;
  try {
    root = realpathSync(dir);
    target = realpathSync(join(dir, decodeURIComponent(requestPath)));
  } catch {
    return false;
  }
  const inside = relative(root, target);
  return inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside);
}

/**
 * Answers the error of a static mount with its status alone. Nest's exception filter would put the
 * error's message, which names the file's absolute path, in the body and log it with a stack.
 * Express takes a handler with four parameters as an error handler.
 */
function answerWithStatus(
  error: { status?: number },
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  response.status(error.status ?? 404).end();
}
