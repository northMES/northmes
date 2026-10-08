// The dev configuration of the stack script (ADR 0058, ADR 0060): .northmes/dev.env and the dev
// secret files under .northmes/secrets/, which every process the stack starts reads.

import { randomBytes } from 'node:crypto';
import { linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

// DEV_SECRET_MARKER in packages/sdk/src/config/secrets.ts. This script runs under plain node,
// where @northmes/sdk resolves to its build output, so it keeps its own copy; config.test.ts checks
// that the two agree.
const devSecretMarker = 'northmes-dev-secret-';

/**
 * The secret files the database steps read, by _FILE key: the superuser's password for db
 * bootstrap and the password of each login role it creates (ADR 0047, ADR 0060).
 */
const secretFiles = {
  POSTGRES_PASSWORD_FILE: 'postgres_password',
  NORTHMES_DB_OWNER_PASSWORD_FILE: 'db_owner_password',
  NORTHMES_DB_APP_PASSWORD_FILE: 'db_app_password',
  NORTHMES_DB_AUTH_PASSWORD_FILE: 'db_auth_password',
};

const devEnvHeader = `# Written by the stack script (ADR 0058). The processes it starts read these keys; the secret
# values are in the files that the _FILE keys name, never in this file (ADR 0060).
`;

/**
 * Reads the secret in a file that writeDevConfig wrote, without the trailing newline, as readSecrets
 * in @northmes/sdk/config reads it.
 * @param {string} path
 */
export function readSecret(path) {
  return readFileSync(path, 'utf8').replace(/\n$/, '');
}

/**
 * True when the stack should reuse its Postgres container (Testcontainers' withReuse), which then
 * outlives the run. A person opts in on a laptop with NORTHMES_STACK_REUSE=1. CI never reuses one,
 * so any CI value turns it off (ADR 0058).
 * @param {Readonly<Record<string, string | undefined>>} env The stack's own environment.
 */
export function containerReuse(env) {
  return env.NORTHMES_STACK_REUSE === '1' && !env.CI;
}

/**
 * Publishes a file unless it exists, and returns true when it did. The content is written to a
 * temporary file in the same folder first and then hard-linked into place, so another stack process
 * sees either no file or the whole file, and a file that exists is never replaced (link refuses
 * with EEXIST).
 * @param {string} path
 * @param {string} content
 * @param {number} [mode]
 */
export function publishIfMissing(path, content, mode) {
  const temporary = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  writeFileSync(temporary, content, { flag: 'wx', mode });
  try {
    linkSync(temporary, path);
    return true;
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'EEXIST') return false;
    throw error;
  } finally {
    rmSync(temporary, { force: true });
  }
}

/**
 * Writes the dev secret files under dir/secrets/, each with a random value that starts with the
 * dev marker and with mode 0600, and dir/dev.env, which sets NODE_ENV to development and points the
 * _FILE keys at the secret files. A file that exists is kept as it is, so the database roles keep
 * the passwords they were created with and an edit to dev.env stays. Returns the environment that
 * dev.env holds.
 * @param {string} dir The stack's state directory, .northmes/ at the repository root.
 * @returns {Record<string, string>}
 */
export function writeDevConfig(dir) {
  const secretsDir = join(dir, 'secrets');
  mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
  /** @type {Record<string, string>} */
  const env = { NODE_ENV: 'development' };
  for (const [key, name] of Object.entries(secretFiles)) {
    const path = join(secretsDir, name);
    publishIfMissing(path, `${devSecretMarker}${randomBytes(32).toString('hex')}\n`, 0o600);
    env[key] = path;
  }
  const devEnvFile = join(dir, 'dev.env');
  const lines = Object.entries(env).map(([key, value]) => `${key}=${value}\n`);
  if (publishIfMissing(devEnvFile, `${devEnvHeader}${lines.join('')}`)) return env;
  return /** @type {Record<string, string>} */ (parseEnv(readFileSync(devEnvFile, 'utf8')));
}
