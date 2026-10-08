// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { GatewayModule } from '../gateway/gateway.module.ts';
import { ServedWeb, type WebFiles } from './served-web.ts';
import { mountStatic } from './static-mounts.ts';
import { WebModulesController } from './web-modules.controller.ts';

/** Serves the web module list (ADR 0019). */
@Module({ imports: [GatewayModule], controllers: [WebModulesController], providers: [ServedWeb] })
export class WebModule {}

/**
 * Serves the web files from the app: the remote of each catalog module with a web block, and the
 * module list. Call it after NestFactory.create and before the app initialises.
 */
export function serveWeb(app: NestExpressApplication, web: WebFiles): void {
  mountStatic(app, web.catalog);
  app.get(ServedWeb).serve(web);
}
