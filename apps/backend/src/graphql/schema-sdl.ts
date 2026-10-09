// SPDX-License-Identifier: AGPL-3.0-or-later
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { readSecrets, secretsConfig } from '@northmes/sdk/config';
import { printSchema } from 'graphql';
import { AppModule } from '../app.module.ts';
import { importServers, inRepoCatalog } from '../boot/boot.ts';

/**
 * The SDL of the one schema that the in-repo modules build, with its types in name order: what
 * pnpm gen writes to schema/api.graphql (ADR 0070). It builds the app as boot does, without a pool
 * (database mode 'none'), with an empty ConfigModule that reads no environment and no secret file,
 * and without listening, then closes it.
 */
export async function schemaSdl(): Promise<string> {
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
    return `${printSchema(app.get(GraphQLSchemaHost).schema)}\n`;
  } finally {
    await app.close();
  }
}
