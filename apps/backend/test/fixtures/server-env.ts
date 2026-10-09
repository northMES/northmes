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
  'NORTHMES_DB_AUTH_PASSWORD_FILE',
  'NORTHMES_AUTH_SECRET_FILE',
] as const;

/** The nm_app password that useServerEnv writes. No server has a role with it. */
export const appPassword = 'nm-app-password-of-a-boot-test';

/** The nm_auth password that useServerEnv writes without a database. No server has it either. */
export const authPassword = 'nm-auth-password-of-a-boot-test';

/** Better Auth's secret that useServerEnv writes. */
export const authSecret = 'northmes-auth-secret-of-a-boot-test-0123456789';

export interface ServerEnvOptions {
  /**
   * The database from useTestDatabase() that the server's pools log in to as nm_app and as
   * nm_auth.
   */
  readonly database?: Pick<TestDatabase, 'appUrl' | 'authUrl'>;
}

/**
 * A valid server environment for the calling test file. PORT 0 lets the operating system pick a
 * free port. The passwords of nm_app and nm_auth and Better Auth's secret are in secret files of
 * the file's own, which afterAll removes.
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
  const secretFile = (name: string, value: string) => {
    const file = join(dir, name);
    writeFileSync(file, `${value}\n`, { mode: 0o600 });
    return file;
  };
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    NODE_ENV: 'test',
    PORT: '0',
    NORTHMES_PUBLIC_ORIGIN: 'http://127.0.0.1:4100',
    DATABASE_URL: databaseUrl.href,
    NORTHMES_DB_APP_PASSWORD_FILE: secretFile('db_app_password', password),
    NORTHMES_DB_AUTH_PASSWORD_FILE: secretFile(
      'db_auth_password',
      database ? decodeURIComponent(new URL(database.authUrl).password) : authPassword,
    ),
    NORTHMES_AUTH_SECRET_FILE: secretFile('auth_secret', authSecret),
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
