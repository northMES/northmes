// The dev configuration of the stack script (ADR 0058, ADR 0060): .northmes/dev.env and the dev
// secret files under .northmes/secrets/, which every process the stack starts reads.

import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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
 * Writes the dev secret files under dir/secrets/, each with a random value that starts with the
 * dev marker and with mode 0600, and dir/dev.env, which sets NODE_ENV to development and points the
 * _FILE keys at the secret files. Returns the environment dev.env holds.
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
    writeFileSync(path, `${devSecretMarker}${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
    env[key] = path;
  }
  const lines = Object.entries(env).map(([key, value]) => `${key}=${value}\n`);
  writeFileSync(join(dir, 'dev.env'), `${devEnvHeader}${lines.join('')}`);
  return env;
}
