// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestDatabase } from '@northmes/testing';
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

export interface ServerEnvOptions {
  /** The database from useTestDatabase() that the server's pool logs in to as nm_app. */
  readonly database?: Pick<TestDatabase, 'appUrl'>;
}

/**
 * A valid server environment for the calling test file. PORT 0 lets the operating system pick a
 * free port. nm_app's password is in a secret file of the file's own, which afterAll removes.
 * Without `database`, nothing listens on port 1 of DATABASE_URL, so a query would fail at once.
 * With it, DATABASE_URL names that database without a login, and the secret file holds the
 * password of its nm_app, as the server reads them (ADR 0060).
 */
export function useServerEnv({
  database,
}: ServerEnvOptions = {}): Readonly<Record<string, string>> {
  const databaseUrl = new URL(database?.appUrl ?? 'postgres://127.0.0.1:1/northmes');
  const password = database ? decodeURIComponent(databaseUrl.password) : appPassword;
  databaseUrl.username = '';
  databaseUrl.password = '';
  const dir = mkdtempSync(join(tmpdir(), 'northmes-env-'));
  const passwordFile = join(dir, 'db_app_password');
  writeFileSync(passwordFile, `${password}\n`, { mode: 0o600 });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    NODE_ENV: 'test',
    PORT: '0',
    NORTHMES_PUBLIC_ORIGIN: 'http://127.0.0.1:4100',
    DATABASE_URL: databaseUrl.href,
    NORTHMES_DB_APP_PASSWORD_FILE: passwordFile,
  };
}

/** The keys of the environment of pnpm northmes migrate, which a test stubs away as serverEnvKeys. */
export const migrateEnvKeys = ['DATABASE_URL', 'NORTHMES_DB_OWNER_PASSWORD_FILE'] as const;

export interface MigrateEnvOptions {
  /** The database from useTestDatabase() that migrate logs in to as nm_owner. */
  readonly database: Pick<TestDatabase, 'ownerUrl'>;
}

/**
 * The environment of pnpm northmes migrate for the calling test file: DATABASE_URL names the
 * database without a login, and nm_owner's password is in a secret file of the file's own, which
 * afterAll removes (ADR 0060).
 */
export function useMigrateEnv({ database }: MigrateEnvOptions): Readonly<Record<string, string>> {
  const databaseUrl = new URL(database.ownerUrl);
  const password = decodeURIComponent(databaseUrl.password);
  databaseUrl.username = '';
  databaseUrl.password = '';
  const dir = mkdtempSync(join(tmpdir(), 'northmes-env-'));
  const passwordFile = join(dir, 'db_owner_password');
  writeFileSync(passwordFile, `${password}\n`, { mode: 0o600 });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl.href,
    NORTHMES_DB_OWNER_PASSWORD_FILE: passwordFile,
  };
}
