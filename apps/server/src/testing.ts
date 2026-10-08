// SPDX-License-Identifier: AGPL-3.0-or-later
import { NestFactory } from '@nestjs/core';
import type { HostFactory } from '@northmes/testing';
import { AppModule } from './app.module.ts';
import { inRepoCatalog } from './boot/boot.ts';

/**
 * The host factory that createTestApp from @northmes/testing calls (ADR 0041). It runs the boot
 * steps of ADR 0002 that come before listening, in the test process: the catalog of the in-repo
 * modules that `modules` names, then the Nest app with the test's ConfigModule as AppModule's first
 * import. The app listens on nothing. A catalog problem throws one BootError. A provider that fails
 * to build rejects with its error, where Nest would by default abort the process and the Vitest
 * worker with it.
 */
export const hostFactory: HostFactory = async ({ modules, config }) => {
  const catalog = await inRepoCatalog((specifier) => import(specifier), { modules });
  const app = await NestFactory.create(AppModule.forRoot(config), {
    logger: ['error', 'warn'],
    abortOnError: false,
  });
  return { app, modules: catalog.map(({ manifest }) => manifest.id) };
};
