// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { GatewayModule } from '../gateway/gateway.module.ts';
import { ServedWeb, type WebFiles } from './served-web.ts';
import { ShellController } from './shell.controller.ts';
import { mountStatic } from './static-mounts.ts';
import { WebModulesController } from './web-modules.controller.ts';

/**
 * Serves the web module list and the shell at the SPA paths (ADR 0019). The shell's route takes
 * every GET path that no route before it took, so AppModule imports this module last.
 */
@Module({
  imports: [GatewayModule],
  controllers: [WebModulesController, ShellController],
  providers: [ServedWeb],
})
export class WebModule {}

/**
 * Serves the web files from the app: the shell's assets, the remote of each catalog module with a
 * web block, the module list and the shell. Call it after NestFactory.create and before the app
 * initialises, so the static mounts come before the routes and the shell's route does not take
 * their paths.
 */
export function serveWeb(app: NestExpressApplication, web: WebFiles): void {
  mountStatic(app, web);
  app.get(ServedWeb).serve(web);
}
