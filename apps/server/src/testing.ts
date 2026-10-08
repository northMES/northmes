// SPDX-License-Identifier: AGPL-3.0-or-later
import { NestFactory } from '@nestjs/core';
import type { HostFactory } from '@northmes/testing';
import { AppModule } from './app.module.ts';
import { inRepoCatalog } from './boot/boot.ts';

/**
 * The host factory that createTestApp from @northmes/testing calls (ADR 0041). It runs the boot
 * steps of ADR 0002 that come before listening, in the test process: the catalog of the in-repo
 * modules that `modules` names, then the Nest app with the test's ConfigModule as AppModule's first
 * import. The app listens on nothing. A catalog problem throws one BootError.
 */
export const hostFactory: HostFactory = async ({ modules, config }) => {
  const catalog = await inRepoCatalog((specifier) => import(specifier), { modules });
  const app = await NestFactory.create(AppModule.forRoot(config), { logger: ['error', 'warn'] });
  return { app, modules: catalog.map(({ manifest }) => manifest.id) };
};
