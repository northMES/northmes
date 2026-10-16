// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get, Inject, NotFoundException, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ServerEnv } from '@northmes/sdk/config';
import type { Request, Response } from 'express';
import { Public } from '../principal.ts';
import { ServedWeb } from './served-web.ts';

/**
 * The content security policy of the shell: every resource from the server's origin (ADR 0019),
 * and the inline scripts that `hashes` name, the shell's import map (ADR 0075).
 */
export function cspOf(hashes: readonly string[] = []): string {
  const inline = hashes.map((hash) => ` 'sha256-${hash}'`).join('');
  return [
    "default-src 'self'",
    `script-src 'self'${inline}`,
    "style-src 'self'",
    "connect-src 'self'",
    "img-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** The import maps of an index.html, by the base64 SHA-256 of each one's text. */
function importMapHashes(index: string): string[] {
  return [...index.matchAll(/<script type="importmap">([\s\S]*?)<\/script>/g)].map(([, text]) =>
    createHash('sha256')
      .update(text ?? '')
      .digest('base64'),
  );
}

/**
 * The first path segments of the server's own routes (ADR 0064). A path that starts with one is not
 * an SPA path, and a plant slug is never one of them. `modules` held the module remotes, so a stale
 * client that asks for a remote file gets 404 instead of the shell.
 */
const SERVER_SEGMENTS = new Set(['api', 'assets', 'graphql', 'health', 'mcp', 'modules', 'shared']);

/**
 * Answers the SPA paths with the shell's index.html (ADR 0064). It is public: the web app holds no
 * data, and its sign-in page loads before any session exists.
 *
 * In development the public origin can be another server's: pnpm dev passes Vite's origin, and
 * Vite serves the web app and forwards only the API paths here. A page asked for on this server's
 * own address would get the last build of apps/web, or none, so it is redirected to the same path
 * and query on the public origin instead. pnpm demo's public origin is the server's own, so its
 * requests carry that host and get the shell.
 */
@Public()
@Controller()
export class ShellController {
  constructor(
    @Inject(ServedWeb) private readonly web: ServedWeb,
    @Inject(ConfigService) private readonly config: ConfigService<ServerEnv, true>,
  ) {}

  @Get('{*path}')
  index(@Req() request: Request, @Res() response: Response): void {
    if (SERVER_SEGMENTS.has(request.path.split('/')[1] ?? '')) throw new NotFoundException();
    const elsewhere = this.webOriginElsewhere(request);
    if (elsewhere !== undefined) {
      // Joined as text: a path such as //example.com/x would leave the origin through new URL.
      response.redirect(302, `${elsewhere}${request.originalUrl}`);
      return;
    }
    const index = join(this.web.shellDir, 'index.html');
    if (!existsSync(index)) {
      response.setHeader('Content-Security-Policy', cspOf());
      response.status(404).type('text').send('The shell is not built');
      return;
    }
    const html = readFileSync(index, 'utf8');
    response.setHeader('Content-Security-Policy', cspOf(importMapHashes(html)));
    response.setHeader('Cache-Control', 'no-cache');
    response.type('html').send(html);
  }

  /** The public origin in development when the request's Host is not its host, else undefined. */
  private webOriginElsewhere(request: Request): string | undefined {
    if (this.config.get('NODE_ENV', { infer: true }) !== 'development') return undefined;
    const publicOrigin = this.config.get('NORTHMES_PUBLIC_ORIGIN', { infer: true });
    return request.headers.host === new URL(publicOrigin).host ? undefined : publicOrigin;
  }
}
