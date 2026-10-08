import {
  appendFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseEnv } from 'node:util';
import { DEV_SECRET_MARKER } from '@northmes/sdk/config';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { publishIfMissing, writeDevConfig } from './config.mjs';

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
      expect(dirname(path), key).toBe(join(dir, 'secrets'));
      // Windows has no POSIX mode bits to check.
      if (process.platform !== 'win32') expect(statSync(path).mode & 0o777, key).toBe(0o600);
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

describe('publishIfMissing', () => {
  it('E02-S08 publishIfMissing writes a missing file whole and leaves no temporary file', () => {
    const path = join(dir, 'dev.env');

    expect(publishIfMissing(path, 'NODE_ENV=development\n', 0o600)).toBe(true);

    expect(readFileSync(path, 'utf8')).toBe('NODE_ENV=development\n');
    expect(readdirSync(dir)).toEqual(['dev.env']);
  });

  it('E02-S08 publishIfMissing keeps a file that exists and leaves no temporary file', () => {
    const path = join(dir, 'dev.env');
    writeFileSync(path, 'NODE_ENV=production\n');

    expect(publishIfMissing(path, 'NODE_ENV=development\n', 0o600)).toBe(false);

    expect(readFileSync(path, 'utf8')).toBe('NODE_ENV=production\n');
    expect(readdirSync(dir)).toEqual(['dev.env']);
  });
});
