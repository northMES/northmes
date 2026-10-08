// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';

/**
 * The keys of a server environment. ConfigModule writes the validated environment into
 * process.env, as it does in the server, so a test that boots stubs these keys away first.
 */
export const serverEnvKeys = [
  'PORT',
  'NORTHMES_PUBLIC_ORIGIN',
  'NORTHMES_ROLE',
  'DATABASE_URL',
  'NORTHMES_DB_APP_PASSWORD_FILE',
] as const;

/** The nm_app password that useServerEnv writes. No server has a role with it. */
export const appPassword = 'nm-app-password-of-a-boot-test';

/**
 * A valid server environment for the calling test file. PORT 0 lets the operating system pick a
 * free port. nm_app's password is in a secret file of the file's own, which afterAll removes.
 * Nothing listens on port 1 of DATABASE_URL, so a query would fail at once.
 */
export function useServerEnv(): Readonly<Record<string, string>> {
  const dir = mkdtempSync(join(tmpdir(), 'northmes-env-'));
  const passwordFile = join(dir, 'db_app_password');
  writeFileSync(passwordFile, `${appPassword}\n`, { mode: 0o600 });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    NODE_ENV: 'test',
    PORT: '0',
    NORTHMES_PUBLIC_ORIGIN: 'http://127.0.0.1:4100',
    DATABASE_URL: 'postgres://127.0.0.1:1/northmes',
    NORTHMES_DB_APP_PASSWORD_FILE: passwordFile,
  };
}
