// The stack script (ADR 0058): the steps that pnpm dev, the end-to-end global setup and
// handoff-demo share. It writes the dev configuration, starts Postgres through Testcontainers,
// bootstraps the database roles, migrates and seeds.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { containerReuse, readSecret, writeDevConfig } from './config.mjs';
import { freePort } from './ports.mjs';
import { seed } from './seed.mjs';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const imageFile = new URL('../../infra/pg-image.json', import.meta.url);

/** The superuser of the official image, as which northmes db bootstrap logs in (ADR 0060). */
const superuser = 'postgres';
/** The database the stack creates in its container. */
const database = 'northmes';

/**
 * @typedef {{ exitCode: number | null, stdout: string, stderr: string }} CommandResult
 * @typedef {(args: readonly string[], env: Readonly<Record<string, string>>) => Promise<CommandResult>} Northmes
 *   Runs a pnpm northmes command with env, such as ['db', 'bootstrap'] or ['migrate'].
 */

/**
 * Runs pnpm northmes <args> from the repository root, which builds the server and runs it, with
 * env over this process's environment.
 * @type {Northmes}
 */
function pnpmNorthmes(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['northmes', ...args], {
      cwd: repositoryRoot,
      env: { ...process.env, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (exitCode) => resolve({ exitCode, stdout, stderr }));
  });
}

/**
 * Runs a pnpm northmes command and throws with its output when it fails.
 * @param {Northmes} northmes
 * @param {readonly string[]} args
 * @param {Readonly<Record<string, string>>} env
 */
async function run(northmes, args, env) {
  const { exitCode, stdout, stderr } = await northmes(args, env);
  if (exitCode !== 0) {
    throw new Error(`pnpm northmes ${args.join(' ')} exited ${exitCode}:\n${stdout}${stderr}`);
  }
}

/**
 * A URL to the database of databaseUrl that logs in as role with password.
 * @param {string} databaseUrl
 * @param {string} role
 * @param {string} password
 */
function loginUrl(databaseUrl, role, password) {
  const url = new URL(databaseUrl);
  url.username = role;
  url.password = encodeURIComponent(password);
  return url.href;
}

/**
 * Prepares the database that env.DATABASE_URL names: northmes db bootstrap creates the roles as the
 * container's superuser, northmes migrate applies the migrations as nm_owner, and the seed writes
 * the tracer records as nm_app. Each step reads its passwords from the secret files env names.
 * @param {Readonly<Record<string, string>>} env The stack's environment, with DATABASE_URL.
 * @param {{ northmes?: Northmes }} [options] northmes runs the server's commands; by default
 *   through pnpm northmes.
 */
export async function prepareDatabase(env, { northmes = pnpmNorthmes } = {}) {
  await run(northmes, ['db', 'bootstrap'], env);
  await run(northmes, ['migrate'], env);
  const appPassword = readSecret(env.NORTHMES_DB_APP_PASSWORD_FILE ?? '');
  await seed(loginUrl(env.DATABASE_URL ?? '', 'nm_app', appPassword));
}

/**
 * @typedef {{ getHost(): string, getPort(): number, stop(): Promise<unknown> }} StartedPostgres
 * @typedef {(settings: { image: string, password: string, reuse: boolean }) => Promise<StartedPostgres>} StartContainer
 *   Starts the stack's Postgres container from image, with password for the superuser. With reuse,
 *   Testcontainers reuses the container of an earlier run with the same settings.
 */

/**
 * Starts Postgres through Testcontainers, with the stack's superuser and database.
 * @type {StartContainer}
 */
function startPostgresContainer({ image, password, reuse }) {
  const definition = new PostgreSqlContainer(image)
    .withUsername(superuser)
    .withPassword(password)
    .withDatabase(database);
  return (reuse ? definition.withReuse() : definition).start();
}

/**
 * Starts the stack: writes the dev configuration into stateDir (writeDevConfig), starts Postgres
 * from the image in infra/pg-image.json with the superuser password of the dev secrets, and
 * prepares its database (prepareDatabase). Resolves with the environment for the processes the
 * caller starts and stop, which stops the container. The environment adds to dev.env the
 * DATABASE_URL of the container, which changes from run to run, and a PORT that freePort took with
 * the public origin on it.
 *
 * When env opts in to reuse (containerReuse), Testcontainers reuses the container of an earlier run
 * with the same settings, and stop leaves it running, so the container outlives the run (ADR 0058).
 * The database steps then run again on it, and they are idempotent. The caller cannot turn reuse
 * on in CI.
 * @param {{
 *   stateDir?: string,
 *   env?: Readonly<Record<string, string | undefined>>,
 *   northmes?: Northmes,
 *   startContainer?: StartContainer,
 *   prepare?: typeof prepareDatabase,
 * }} [options] stateDir defaults to .northmes/ at the repository root, and env, the stack's own
 *   environment, to process.env. startContainer starts Postgres, by default through
 *   Testcontainers, and prepare runs the database steps with northmes, by default prepareDatabase.
 */
export async function startStack({
  stateDir = join(repositoryRoot, '.northmes'),
  env: stackEnv = process.env,
  northmes = pnpmNorthmes,
  startContainer = startPostgresContainer,
  prepare = prepareDatabase,
} = {}) {
  const devEnv = writeDevConfig(stateDir);
  const { image } = JSON.parse(readFileSync(imageFile, 'utf8'));
  const password = readSecret(devEnv.POSTGRES_PASSWORD_FILE ?? '');
  const reuse = containerReuse(stackEnv);
  const container = await startContainer({ image, password, reuse });
  const stop = async () => {
    if (!reuse) await container.stop();
  };
  try {
    const port = await freePort();
    const env = {
      ...devEnv,
      DATABASE_URL: `postgres://${container.getHost()}:${container.getPort()}/${database}`,
      PORT: String(port),
      NORTHMES_PUBLIC_ORIGIN: `http://127.0.0.1:${port}`,
    };
    await prepare(env, { northmes });
    return { env, stop };
  } catch (error) {
    // The caller gets no stop when the start fails, so the container stops here. A failing stop
    // must not hide the error that made the start fail.
    await stop().catch(() => {});
    throw error;
  }
}
