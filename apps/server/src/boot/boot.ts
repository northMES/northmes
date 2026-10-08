// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { ModuleManifest } from '@northmes/sdk';
import {
  ConfigError,
  loadEnv,
  readSecrets,
  secretsConfig,
  serverEnvSchema,
} from '@northmes/sdk/config';
import { AppModule } from '../app.module.ts';
import { type CatalogEntry, checkCatalog } from '../catalog/check-catalog.ts';
import { inRepoManifests } from '../modules.ts';
import { BootError } from './boot-error.ts';

export interface BootOptions {
  /** The environment the server runs with. main.ts passes process.env. */
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Imports the manifest module that a specifier names. main.ts passes a dynamic import. */
  readonly importManifest: (specifier: string) => Promise<{ default: ModuleManifest }>;
  /** Ends the process with an exit code. main.ts passes process.exit. */
  readonly exit: (code: number) => void;
  /** Where boot writes its lines: progress to info, problems to error. main.ts passes console. */
  readonly log: { info(line: string): void; error(line: string): void };
}

/** The NorthMES version of this build, from the server's package.json. */
function imageVersion(): string {
  const packageJson = new URL('../../package.json', import.meta.url);
  return (JSON.parse(readFileSync(packageJson, 'utf8')) as { version: string }).version;
}

/** The secret file paths of an environment: the value of every key that ends in _FILE. */
function secretFiles(env: Readonly<Record<string, unknown>>): Record<`${string}_FILE`, string> {
  const files: Record<`${string}_FILE`, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (key.endsWith('_FILE') && typeof value === 'string') files[key as `${string}_FILE`] = value;
  }
  return files;
}

/**
 * Boot step 1 for the environment (ADR 0060): validates env with serverEnvSchema, reads the secret
 * files it names and creates the global ConfigModule that serves both. A bad key or secret file
 * throws one ConfigError.
 */
async function loadConfig(env: BootOptions['env']) {
  const serverEnv = loadEnv(serverEnvSchema)(env);
  readSecrets(secretFiles(serverEnv), { nodeEnv: serverEnv.NODE_ENV });
  const config = await ConfigModule.forRoot({
    isGlobal: true,
    ignoreEnvFile: true,
    cache: true,
    // forRoot hands validate the merged process.env. The environment boot was given is already
    // validated: main.ts gives process.env, and a test its own record.
    validate: () => serverEnv,
    load: [secretsConfig],
  });
  return { serverEnv, config };
}

/**
 * Boots the server in the order of ADR 0002 and returns the listening app. A ConfigError or a
 * BootError is written to log.error and ends the process with exit code 1; boot then returns
 * undefined.
 */
export async function boot(options: BootOptions): Promise<INestApplication | undefined> {
  try {
    return await bootSteps(options);
  } catch (error) {
    if (!(error instanceof ConfigError || error instanceof BootError)) throw error;
    options.log.error(error.message);
    options.exit(1);
    return undefined;
  }
}

async function bootSteps({ env, importManifest, log }: BootOptions): Promise<INestApplication> {
  const { serverEnv, config } = await loadConfig(env);
  const entries: CatalogEntry[] = [];
  for (const specifier of inRepoManifests) {
    const { default: manifest } = await importManifest(specifier);
    entries.push({ manifest, kind: 'module' });
  }
  const catalog = checkCatalog(entries, { imageVersion: imageVersion() });
  const app = await NestFactory.create(AppModule.forRoot(config), { logger: ['error', 'warn'] });
  await app.listen(serverEnv.PORT, '127.0.0.1');
  log.info(`Modules in boot order: ${catalog.map((entry) => entry.manifest.id).join(', ')}`);
  log.info(`Listening on ${await app.getUrl()}`);
  return app;
}
