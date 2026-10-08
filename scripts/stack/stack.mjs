// The stack script (ADR 0058): the steps that pnpm dev, the end-to-end global setup and
// handoff-demo share. It writes the dev configuration, starts Postgres through Testcontainers,
// bootstraps the database roles, migrates and seeds.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { readSecret, writeDevConfig } from './config.mjs';
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
 * Starts the stack: writes the dev configuration into stateDir (writeDevConfig), starts Postgres
 * from the image in infra/pg-image.json with the superuser password of the dev secrets, and
 * prepares its database (prepareDatabase). Resolves with the environment for the processes the
 * caller starts, which adds DATABASE_URL to dev.env, and stop, which stops the container.
 * @param {{ stateDir?: string, northmes?: Northmes }} [options] stateDir defaults to .northmes/ at
 *   the repository root.
 */
export async function startStack({
  stateDir = join(repositoryRoot, '.northmes'),
  northmes = pnpmNorthmes,
} = {}) {
  const devEnv = writeDevConfig(stateDir);
  const { image } = JSON.parse(readFileSync(imageFile, 'utf8'));
  const container = await new PostgreSqlContainer(image)
    .withUsername(superuser)
    .withPassword(readSecret(devEnv.POSTGRES_PASSWORD_FILE ?? ''))
    .withDatabase(database)
    .start();
  const stop = async () => {
    await container.stop();
  };
  try {
    const env = {
      ...devEnv,
      DATABASE_URL: `postgres://${container.getHost()}:${container.getPort()}/${database}`,
    };
    await prepareDatabase(env, { northmes });
    return { env, stop };
  } catch (error) {
    // The caller gets no stop when the start fails, so the container stops here. A failing stop
    // must not hide the error that made the start fail.
    await stop().catch(() => {});
    throw error;
  }
}
