// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ServedWeb, type WebFiles } from './served-web.ts';
import { ShellController } from './shell.controller.ts';
import { mountStatic } from './static-mounts.ts';

/**
 * Serves the web app at the SPA paths (ADR 0019). The shell's route takes every GET path that no
 * route before it took, so AppModule imports this module last.
 */
@Module({ controllers: [ShellController], providers: [ServedWeb] })
export class WebModule {}

/**
 * Serves the web files from the app: the web app's assets and its index.html. Call it after
 * NestFactory.create and before the app initialises, so the static mount comes before the routes
 * and the shell's route does not take its paths.
 */
export function serveWeb(app: NestExpressApplication, web: WebFiles): void {
  mountStatic(app, web);
  app.get(ServedWeb).serve(web);
}
