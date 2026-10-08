import { appendFileSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { DEV_SECRET_MARKER } from '@northmes/sdk/config';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { containerReuse, writeDevConfig } from './config.mjs';

// The secret files of ADR 0060 that the database steps read: the superuser's for db bootstrap and
// one for each login role it creates.
const secretKeys = [
  'NORTHMES_DB_APP_PASSWORD_FILE',
  'NORTHMES_DB_AUTH_PASSWORD_FILE',
  'NORTHMES_DB_OWNER_PASSWORD_FILE',
  'POSTGRES_PASSWORD_FILE',
];

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'northmes-stack-config-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** The secret file paths of an environment, by key. */
function secretFiles(env: Readonly<Record<string, string>>): [string, string][] {
  return Object.entries(env).filter(([key]) => key.endsWith('_FILE'));
}

describe('writeDevConfig', () => {
  it('E02-S08 the dev secret files are written with mode 0600 and the dev marker', () => {
    const env = writeDevConfig(dir);
    const files = secretFiles(env);
    const values = files.map(([, path]) => readFileSync(path, 'utf8'));

    expect(files.map(([key]) => key).sort()).toEqual(secretKeys);
    for (const [key, path] of files) {
      expect(path, key).toMatch(new RegExp(`^${join(dir, 'secrets')}/`));
      expect(statSync(path).mode & 0o777, key).toBe(0o600);
    }
    for (const value of values) expect(value.startsWith(DEV_SECRET_MARKER)).toBe(true);
    // Each secret is random, so no two roles share a password.
    expect(new Set(values).size).toBe(secretKeys.length);
  });

  it('E02-S08 dev.env sets NODE_ENV to development and points each _FILE key at its secret file', () => {
    const env = writeDevConfig(dir);
    const devEnv = parseEnv(readFileSync(join(dir, 'dev.env'), 'utf8'));

    expect(devEnv).toEqual({
      NODE_ENV: 'development',
      POSTGRES_PASSWORD_FILE: join(dir, 'secrets/postgres_password'),
      NORTHMES_DB_OWNER_PASSWORD_FILE: join(dir, 'secrets/db_owner_password'),
      NORTHMES_DB_APP_PASSWORD_FILE: join(dir, 'secrets/db_app_password'),
      NORTHMES_DB_AUTH_PASSWORD_FILE: join(dir, 'secrets/db_auth_password'),
    });
    expect(env).toEqual(devEnv);
  });

  it('E02-S08 a second run keeps dev.env and the secret files', () => {
    const first = writeDevConfig(dir);
    // What the first run wrote, with a key added to dev.env by hand.
    appendFileSync(join(dir, 'dev.env'), 'NORTHMES_ROLE=api\n');
    const written = () => ({
      devEnv: readFileSync(join(dir, 'dev.env'), 'utf8'),
      secrets: secretFiles(first).map(([, path]) => readFileSync(path, 'utf8')),
    });
    const before = written();

    const second = writeDevConfig(dir);

    expect(written()).toEqual(before);
    expect(second).toEqual({ ...first, NORTHMES_ROLE: 'api' });
  });
});

describe('containerReuse', () => {
  it('E02-S08 the stack reuses its Postgres container only with NORTHMES_STACK_REUSE=1 and never in CI', () => {
    expect(containerReuse({})).toBe(false);
    expect(containerReuse({ NORTHMES_STACK_REUSE: 'true' })).toBe(false);
    expect(containerReuse({ NORTHMES_STACK_REUSE: '1' })).toBe(true);
    // GitHub Actions sets CI=true in every job.
    expect(containerReuse({ NORTHMES_STACK_REUSE: '1', CI: 'true' })).toBe(false);
  });
});
