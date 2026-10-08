// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { type ModuleManifest, moduleNames } from '@northmes/sdk';
import {
  ConfigError,
  loadEnv,
  type MigrateEnv,
  migrateEnvSchema,
  readSecrets,
  type Secrets,
  type ServerEnv,
  secretsConfig,
  serverEnvSchema,
} from '@northmes/sdk/config';
import type { DefineSubgraphOptions } from '@northmes/sdk/graphql';
import { AppModule } from '../app.module.ts';
import { type CatalogEntry, checkCatalog } from '../catalog/check-catalog.ts';
import { GATEWAY_PATH, GatewayService } from '../gateway/gateway.module.ts';
import { migrationsDirOf } from '../migrate/files.ts';
import { inRepoManifests } from '../modules.ts';
import { BootError } from './boot-error.ts';

export interface BootOptions {
  /** The environment the server runs with. Without it, loadEnv reads process.env (ADR 0060). */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** The import specifiers of the manifests boot loads. Without it, boot loads inRepoManifests. */
  readonly manifests?: readonly string[];
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
 * Boot step 1 for the environment (ADR 0060): reads the secret files that an entry point's
 * validated environment names and creates the global ConfigModule that serves both. A bad secret
 * file throws one ConfigError.
 */
async function loadConfig(
  entryEnv: Readonly<Record<string, unknown>> & Pick<ServerEnv, 'NODE_ENV'>,
) {
  const secrets = readSecrets(secretFiles(entryEnv), { nodeEnv: entryEnv.NODE_ENV });
  const config = await ConfigModule.forRoot({
    isGlobal: true,
    ignoreEnvFile: true,
    cache: true,
    // forRoot would validate process.env. Boot validates the environment it was given instead,
    // which is process.env when main.ts runs it and a record of its own in a test.
    validate: () => entryEnv,
    load: [secretsConfig],
  });
  return { secrets, config };
}

/**
 * Boots the server in the order of ADR 0002 and returns the listening app. A ConfigError or a
 * BootError is written to log.error and ends the process with exit code 1; boot then returns
 * undefined.
 */
export async function boot(options: BootOptions): Promise<INestApplication | undefined> {
  try {
    return await serve(options);
  } catch (error) {
    if (!(error instanceof ConfigError || error instanceof BootError)) throw error;
    options.log.error(error.message);
    options.exit(1);
    return undefined;
  }
}

/** What the boot steps hand the entry point that ran them. */
export interface Booted<Env> {
  /** The entry point's validated environment. */
  readonly env: Env;
  /** The values of the secret files that env names. */
  readonly secrets: Secrets;
  /** The checked catalog in boot order. */
  readonly catalog: readonly CatalogEntry[];
  /** The created app, which listens on nothing. */
  readonly app: INestApplication;
}

/**
 * The boot of pnpm northmes migrate (ADR 0006, ADR 0060): the boot steps with migrateEnvSchema, so
 * the secrets hold only the owner password, and without listening. It throws a ConfigError or a
 * BootError, and the caller closes the app.
 */
export async function bootForMigrate(options: BootOptions): Promise<Booted<MigrateEnv>> {
  return bootSteps(loadEnv(migrateEnvSchema)(options.env), options);
}

/** Returns the file URL that a manifest specifier resolves to, or of another file in its package. */
export type ResolveManifest = (specifier: string) => string;

/**
 * Boot step 3: imports the manifest of every module. No Nest code of a module loads. A module's
 * migration files are in the migrations folder of its package.
 */
async function importManifests(
  specifiers: readonly string[],
  importManifest: BootOptions['importManifest'],
  resolveManifest: ResolveManifest,
): Promise<CatalogEntry[]> {
  const entries: CatalogEntry[] = [];
  for (const specifier of specifiers) {
    const { default: manifest } = await importManifest(specifier);
    const migrationsDir = migrationsDirOf(resolveManifest(specifier));
    entries.push({ manifest, kind: 'module', migrationsDir });
  }
  return entries;
}

/**
 * Boot steps 3 and 4: the in-repo modules' manifests and migration folders, checked and in boot
 * order. Boot resolves each manifest with import.meta.resolve. The integration tests' global setup
 * runs in Vite's module runner, which has no import.meta.resolve, so it passes a resolver of its own.
 */
export async function inRepoCatalog(
  importManifest: BootOptions['importManifest'],
  resolveManifest: ResolveManifest = (specifier) => import.meta.resolve(specifier),
): Promise<CatalogEntry[]> {
  return checkCatalog(await importManifests(inRepoManifests, importManifest, resolveManifest), {
    imageVersion: imageVersion(),
  });
}

/**
 * Boot step 6: imports the server entry of every module that has one, in boot order, and names
 * its subgraph after the module's GraphQL name.
 */
async function importServers(catalog: readonly CatalogEntry[]): Promise<DefineSubgraphOptions[]> {
  const subgraphs: DefineSubgraphOptions[] = [];
  for (const { manifest } of catalog) {
    if (!manifest.server) continue;
    const { default: module } = await manifest.server();
    subgraphs.push({ name: moduleNames(manifest.id).gql, module });
  }
  return subgraphs;
}

/**
 * The boot steps of ADR 0002 that run before the server listens, for an entry point's validated
 * environment. pnpm northmes migrate runs the same steps before its first file.
 */
async function bootSteps<
  Env extends Readonly<Record<string, unknown>> & Pick<ServerEnv, 'NODE_ENV'>,
>(
  env: Env,
  {
    manifests = inRepoManifests,
    importManifest,
    log,
  }: Pick<BootOptions, 'manifests' | 'importManifest' | 'log'>,
): Promise<Booted<Env>> {
  const { secrets, config } = await loadConfig(env);
  const entries = await importManifests(manifests, importManifest, (specifier) =>
    import.meta.resolve(specifier),
  );
  const catalog = checkCatalog(entries, { imageVersion: imageVersion() });
  const subgraphs = await importServers(catalog);
  const app = await NestFactory.create(AppModule.forRoot(config, subgraphs), {
    logger: ['error', 'warn'],
  });
  log.info(`Modules in boot order: ${catalog.map((entry) => entry.manifest.id).join(', ')}`);
  return { env, secrets, catalog, app };
}

async function serve(options: BootOptions): Promise<INestApplication> {
  const { log } = options;
  const { env: serverEnv, app } = await bootSteps(loadEnv(serverEnvSchema)(options.env), options);
  await app.listen(serverEnv.PORT, '127.0.0.1');
  const { supergraphHash } = app.get(GatewayService);
  if (supergraphHash) log.info(`Serving ${GATEWAY_PATH} with supergraph=${supergraphHash}`);
  log.info(`Listening on ${await app.getUrl()}`);
  return app;
}
