// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ServerEnv } from '@northmes/sdk/config';
import { mountPluginWeb } from './plugin-web.ts';
import { PluginsController } from './plugins.controller.ts';
import { ServedWeb, type WebFiles } from './served-web.ts';
import { ShellController } from './shell.controller.ts';
import { mountStatic } from './static-mounts.ts';

/**
 * Serves the web app at the SPA paths (ADR 0019) and lists the plugins whose screens it loads (ADR
 * 0075). The shell's route takes every GET path that no route before it took, so it comes last
 * here and AppModule imports this module last.
 */
@Module({ controllers: [PluginsController, ShellController], providers: [ServedWeb] })
export class WebModule {}

/**
 * Serves the web files from the app: the web app's assets, its index.html and the plugins' web
 * parts for the web origins in `webOrigins`. Call it after NestFactory.create and before the app
 * initialises, so the static mounts come before the routes and the shell's route does not take
 * their paths.
 */
export function serveWeb(
  app: NestExpressApplication,
  web: WebFiles,
  { webOrigins = [] }: { readonly webOrigins?: readonly string[] } = {},
): void {
  mountStatic(app, web);
  const config = app.get<ConfigService<ServerEnv, true>>(ConfigService);
  const publicOrigin = config.get('NORTHMES_PUBLIC_ORIGIN', { infer: true });
  mountPluginWeb(app, web.plugins ?? [], { publicOrigin, webOrigins });
  app.get(ServedWeb).serve(web);
}
