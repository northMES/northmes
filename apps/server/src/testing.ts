// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DynamicModule, INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.ts';
import { inRepoCatalog } from './boot/boot.ts';

/** What createTestApp from @northmes/testing hands the host factory. */
export interface HostOptions {
  /** The ids of the in-repo modules the app boots. */
  readonly modules: readonly string[];
  /** The ConfigModule that configForTest built. */
  readonly config: DynamicModule;
}

/** The host app that the host factory builds. */
export interface Host {
  /** The created app, which listens on nothing. */
  readonly app: INestApplication;
  /** The ids of the modules the app booted, in boot order. */
  readonly modules: readonly string[];
}

/**
 * The host factory that createTestApp from @northmes/testing calls (ADR 0041). It runs the boot
 * steps of ADR 0002 that come before listening, in the test process: the catalog of the in-repo
 * modules that `modules` names, then the Nest app with the test's ConfigModule as AppModule's first
 * import. A catalog problem throws one BootError.
 */
export async function hostFactory({ modules, config }: HostOptions): Promise<Host> {
  const catalog = await inRepoCatalog((specifier) => import(specifier), { modules });
  const app = await NestFactory.create(AppModule.forRoot(config), { logger: ['error', 'warn'] });
  return { app, modules: catalog.map(({ manifest }) => manifest.id) };
}
