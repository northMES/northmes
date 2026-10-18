// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { readSecrets, secretsConfig } from '@northmes/sdk/config';
import { AppModule } from '../app.module.ts';
import { importServers, inRepoCatalog } from './boot.ts';

/**
 * Builds the app of the in-repo modules as boot does, without a pool (database mode 'none'), with
 * an empty ConfigModule that reads no environment and no secret file, and without listening; hands
 * it to `use` and closes it. pnpm gen prints its generated files from this app, so they never
 * depend on northmes.config.json, a plugin or a database (ADR 0015, ADR 0064).
 */
export async function withInRepoApp<T>(use: (app: INestApplication) => Promise<T>): Promise<T> {
  const catalog = inRepoCatalog();
  const servers = await importServers(catalog);
  readSecrets({}, { nodeEnv: 'development' });
  const config = await ConfigModule.forRoot({
    isGlobal: true,
    ignoreEnvFile: true,
    validatePredefined: false,
    skipProcessEnv: true,
    load: [secretsConfig],
  });
  const app = await NestFactory.create(AppModule.forRoot(config, servers, { database: 'none' }), {
    logger: ['error'],
    abortOnError: false,
  });
  try {
    await app.init();
    return await use(app);
  } finally {
    await app.close();
  }
}
