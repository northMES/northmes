// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { findPackageJSON } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
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
import { AppModule, type AppOptions, type ServerEntry } from '../app.module.ts';
import { type CatalogEntry, checkCatalog } from '../catalog/check-catalog.ts';
import { GATEWAY_PATH, GatewayService } from '../gateway/gateway.module.ts';
import { migrationsDirOf } from '../migrate/files.ts';
import { inRepoManifests } from '../modules.ts';
import { builtShellDir, webDirOf } from '../web/static-mounts.ts';
import { serveWeb } from '../web/web.module.ts';
import { BootError } from './boot-error.ts';

export interface BootOptions {
  /** The environment the server runs with. Without it, loadEnv reads process.env (ADR 0060). */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** The import specifiers of the manifests boot loads. Without it, boot loads inRepoManifests. */
  readonly manifests?: readonly string[];
  /** Imports the manifest module that a specifier names. main.ts passes a dynamic import. */
  readonly importManifest: (specifier: string) => Promise<{ default: ModuleManifest }>;
  /**
   * Resolves each manifest specifier, so boot finds the migrations folder of its package. Without
   * it, boot uses packageJsonOf.
   */
  readonly resolveManifest?: ResolveManifest;
  /** Ends the process with an exit code. main.ts passes process.exit. */
  readonly exit: (code: number) => void;
  /** Where boot writes its lines: progress to info, problems to error. main.ts passes console. */
  readonly log: { info(line: string): void; error(line: string): void };
}

/** The NorthMES version of this build, from the server's package.json. */
export function imageVersion(): string {
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
  readonly app: NestExpressApplication;
}

/**
 * The boot of pnpm northmes migrate (ADR 0006, ADR 0060): the boot steps with migrateEnvSchema, so
 * the secrets hold only the owner password, without the nm_app pool and without listening. It
 * throws a ConfigError or a BootError, and the caller closes the app.
 */
export async function bootForMigrate(options: BootOptions): Promise<Booted<MigrateEnv>> {
  return bootSteps(loadEnv(migrateEnvSchema)(options.env), options, { database: 'none' });
}

/** Returns the file URL that a manifest specifier resolves to, or of another file in its package. */
export type ResolveManifest = (specifier: string) => string;

/**
 * Boot's ResolveManifest: the file URL of the package.json at the root of the manifest's package.
 * The folder above the manifest file would not do for an in-repo module: its manifest imports its
 * package.json, so the build writes a copy of that file into dist/.
 */
function packageJsonOf(specifier: string): string {
  const packageJson = findPackageJSON(specifier, import.meta.url);
  if (!packageJson) throw new Error(`No package.json for ${specifier}`);
  return pathToFileURL(packageJson).href;
}

/**
 * Boot step 3: imports the manifest of every module. No Nest code of a module loads. A module's
 * migration files are in the migrations folder of its package, and its built remote in web/dist/.
 */
async function importManifests(
  specifiers: readonly string[],
  importManifest: BootOptions['importManifest'],
  resolveManifest: ResolveManifest,
): Promise<CatalogEntry[]> {
  const entries: CatalogEntry[] = [];
  for (const specifier of specifiers) {
    const { default: manifest } = await importManifest(specifier);
    const manifestUrl = resolveManifest(specifier);
    const migrationsDir = migrationsDirOf(manifestUrl);
    entries.push({ manifest, kind: 'module', migrationsDir, webDir: webDirOf(manifestUrl) });
  }
  return entries;
}

export interface InRepoCatalogOptions {
  /** The ids of the in-repo modules to keep. Without it, the catalog holds every in-repo module. */
  readonly modules?: readonly string[];
}

/**
 * Boot steps 3 and 4: the in-repo modules' manifests and migration folders, checked and in boot
 * order.
 */
export async function inRepoCatalog(
  importManifest: BootOptions['importManifest'],
  { modules }: InRepoCatalogOptions = {},
): Promise<CatalogEntry[]> {
  const entries = await importManifests(inRepoManifests, importManifest, packageJsonOf);
  const kept = modules ? entries.filter(({ manifest }) => modules.includes(manifest.id)) : entries;
  return checkCatalog(kept, { imageVersion: imageVersion() });
}

/**
 * Boot step 6: imports the server entry of every module that has one, in boot order, and names
 * its subgraph after the module's GraphQL name. createTestApp's host factory runs the same step.
 */
export async function importServers(catalog: readonly CatalogEntry[]): Promise<ServerEntry[]> {
  const servers: ServerEntry[] = [];
  for (const { manifest } of catalog) {
    if (!manifest.server) continue;
    const { default: module } = await manifest.server();
    servers.push({ id: manifest.id, name: moduleNames(manifest.id).gql, module });
  }
  return servers;
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
    resolveManifest = packageJsonOf,
    log,
  }: Pick<BootOptions, 'manifests' | 'importManifest' | 'resolveManifest' | 'log'>,
  appOptions: AppOptions = {},
): Promise<Booted<Env>> {
  const { secrets, config } = await loadConfig(env);
  const entries = await importManifests(manifests, importManifest, resolveManifest);
  const catalog = checkCatalog(entries, { imageVersion: imageVersion() });
  const servers = await importServers(catalog);
  const root = AppModule.forRoot(config, servers, appOptions);
  const app = await NestFactory.create<NestExpressApplication>(root, { logger: ['error', 'warn'] });
  log.info(`Modules in boot order: ${catalog.map((entry) => entry.manifest.id).join(', ')}`);
  return { env, secrets, catalog, app };
}

/** The interface the server listens on. */
const listenHost = '127.0.0.1';

/**
 * Listens on PORT. A port that another process holds closes the app and stops the boot with a
 * BootError that names PORT (ADR 0058).
 */
async function listen(app: NestExpressApplication, port: number): Promise<void> {
  try {
    await app.listen(port, listenHost);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
    await app.close();
    throw new BootError([
      `PORT: ${listenHost}:${port} is in use by another process (EADDRINUSE). Stop that process, or set PORT to a free port or to 0`,
    ]);
  }
}

async function serve(options: BootOptions): Promise<INestApplication> {
  const { log } = options;
  const { env, catalog, app } = await bootSteps(loadEnv(serverEnvSchema)(options.env), options);
  // The static mounts go in before listen initialises the app and adds the routes after them.
  serveWeb(app, { northmes: imageVersion(), shellDir: builtShellDir, catalog });
  await listen(app, env.PORT);
  const { supergraphHash } = app.get(GatewayService);
  if (supergraphHash) log.info(`Serving ${GATEWAY_PATH} with supergraph=${supergraphHash}`);
  log.info(`Listening on ${await app.getUrl()}`);
  return app;
}
