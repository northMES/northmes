// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { realpathSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import type { WebFiles } from './served-web.ts';

/** The folder of the web app that apps/web builds. */
export const builtShellDir = fileURLToPath(new URL('../../../web/dist/', import.meta.url));

/** The Cache-Control of a file with a content hash in its name. */
export const IMMUTABLE = 'public, max-age=31536000, immutable';

/**
 * Serves the web app's hashed assets at /assets/, immutable, and the shared files of plugin
 * screens at /shared/ (ADR 0075). Their names stay the same across versions, so a browser
 * revalidates them. A file missing under a mount is a 404 with an empty body, and a path whose
 * real path lies outside the folder, through a symlink, answers 404.
 */
export function mountStatic(app: NestExpressApplication, { shellDir }: WebFiles): void {
  mountFolder(app, '/assets/', join(shellDir, 'assets'), { 'Cache-Control': IMMUTABLE });
  mountFolder(app, '/shared/', join(shellDir, 'shared'), {
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
}

/** Serves the files of `dir` at `prefix` with `headers`, as mountStatic describes. */
function mountFolder(
  app: NestExpressApplication,
  prefix: string,
  dir: string,
  headers: Readonly<Record<string, string>>,
): void {
  app.use(prefix, (request: Request, response: Response, next: NextFunction) => {
    if (escapesThroughSymlink(dir, request.path)) response.status(404).end();
    else next();
  });
  app.useStaticAssets(dir, {
    prefix,
    index: false,
    fallthrough: false,
    setHeaders: (response: ServerResponse) => {
      for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
    },
  });
  app.use(prefix, answerWithStatus);
}

/**
 * Whether the file that requestPath names under dir exists and its real path lies outside the real
 * path of dir. A path that does not resolve is left to the static mount, which answers it.
 */
export function escapesThroughSymlink(dir: string, requestPath: string): boolean {
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
export function answerWithStatus(
  error: { status?: number },
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  response.status(error.status ?? 404).end();
}
