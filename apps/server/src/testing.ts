// SPDX-License-Identifier: AGPL-3.0-or-later
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { HostFactory } from '@northmes/testing';
import { AppModule } from './app.module.ts';
import { inRepoCatalog } from './boot/boot.ts';
import { mountStatic } from './web/static-mounts.ts';

/**
 * The host factory that createTestApp from @northmes/testing calls (ADR 0041). It runs the boot
 * steps of ADR 0002 that come before listening, in the test process: the catalog of the in-repo
 * modules that `modules` names, then the Nest app with the test's ConfigModule as AppModule's first
 * import. The app listens on nothing. A catalog problem throws one BootError. A provider that fails
 * to build rejects with its error, where Nest would by default abort the process and the Vitest
 * worker with it.
 */
export const hostFactory: HostFactory = createHostFactory();

/**
 * The host factory of hostFactory, whose app serves the web files under webDir: each module's
 * built remote from modules/<id>/.
 */
export function hostFactoryWithWebFiles(webDir: string): HostFactory {
  return createHostFactory(webDir);
}

function createHostFactory(webDir?: string): HostFactory {
  return async ({ modules, config }) => {
    const catalog = await inRepoCatalog((specifier) => import(specifier), { modules });
    const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), {
      logger: ['error', 'warn'],
      abortOnError: false,
    });
    if (webDir !== undefined) {
      mountStatic(
        app,
        catalog.map((entry) => ({ ...entry, webDir: join(webDir, 'modules', entry.manifest.id) })),
      );
    }
    return { app, modules: catalog.map(({ manifest }) => manifest.id) };
  };
}
