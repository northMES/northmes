// SPDX-License-Identifier: MIT
import {
  bootstrapEnvSchema,
  ConfigError,
  loadEnv,
  migrateEnvSchema,
  serverEnvSchema,
} from '@northmes/sdk/config';
import { describe, expect, it } from 'vitest';

/** Calls fn and returns the ConfigError it throws, so a test can read its problems. */
function configErrorOf(fn: () => unknown): ConfigError {
  try {
    fn();
  } catch (error) {
    if (error instanceof ConfigError) return error;
    throw error;
  }
  throw new Error('expected a ConfigError, but nothing was thrown');
}

describe('serverEnvSchema', () => {
  it('E02-S01 a record without PORT fails naming PORT', () => {
    const error = configErrorOf(() =>
      loadEnv(serverEnvSchema)({ NORTHMES_PUBLIC_ORIGIN: 'https://mes.example.com' }),
    );

    expect(error.problems).toHaveLength(1);
    expect(error.problems[0]).toMatch(/^PORT: /);
  });

  it('E02-S01 PORT 0 is accepted as the number 0, so the operating system picks the port', () => {
    const env = loadEnv(serverEnvSchema)({
      PORT: '0',
      NORTHMES_PUBLIC_ORIGIN: 'https://mes.example.com',
    });

    expect(env.PORT).toBe(0);
  });

  it('E02-S01 a missing public origin, PORT 70000 and role web are listed together without their values', () => {
    const error = configErrorOf(() =>
      loadEnv(serverEnvSchema)({ PORT: '70000', NORTHMES_ROLE: 'web' }),
    );

    expect(error.problems.map((problem) => problem.split(':')[0]).sort()).toEqual([
      'NORTHMES_PUBLIC_ORIGIN',
      'NORTHMES_ROLE',
      'PORT',
    ]);
    expect(error.problems).toContain('PORT: must be an integer from 0 to 65535');
    expect(error.problems).toContain('NORTHMES_ROLE: must be all, api or worker');
    expect(error.message).not.toContain('70000');
    expect(error.message).not.toContain('web');
  });

  it('E02-S01 NODE_ENV defaults to production and NORTHMES_ROLE to all', () => {
    const env = loadEnv(serverEnvSchema)({
      PORT: '8080',
      NORTHMES_PUBLIC_ORIGIN: 'https://mes.example.com',
    });

    expect(env.NODE_ENV).toBe('production');
    expect(env.NORTHMES_ROLE).toBe('all');
  });

  it('E02-S01 an http://127.0.0.1 origin passes with NODE_ENV test and fails with production', () => {
    const record = { PORT: '8080', NORTHMES_PUBLIC_ORIGIN: 'http://127.0.0.1:8080' };

    const env = loadEnv(serverEnvSchema)({ ...record, NODE_ENV: 'test' });
    const error = configErrorOf(() =>
      loadEnv(serverEnvSchema)({ ...record, NODE_ENV: 'production' }),
    );

    expect(env.NORTHMES_PUBLIC_ORIGIN).toBe('http://127.0.0.1:8080');
    expect(error.problems).toHaveLength(1);
    expect(error.problems[0]).toMatch(/^NORTHMES_PUBLIC_ORIGIN: must be /);
    expect(error.message).not.toContain('127.0.0.1:8080');
  });

  it('E02-S01 a public origin with a path, even a single slash, fails', () => {
    for (const origin of ['https://mes.example.com/', 'https://mes.example.com/northmes']) {
      const error = configErrorOf(() =>
        loadEnv(serverEnvSchema)({ PORT: '8080', NORTHMES_PUBLIC_ORIGIN: origin }),
      );

      expect(error.problems, origin).toHaveLength(1);
      expect(error.problems[0], origin).toMatch(/^NORTHMES_PUBLIC_ORIGIN: must be /);
    }
  });
});

describe('migrateEnvSchema and bootstrapEnvSchema', () => {
  const DATABASE_URL = 'postgres://db.internal:5432/northmes';
  const migrateKeys = {
    DATABASE_URL,
    NORTHMES_DB_OWNER_PASSWORD_FILE: '/run/secrets/db_owner_password',
  };
  const bootstrapKeys = {
    DATABASE_URL,
    POSTGRES_PASSWORD_FILE: '/run/secrets/postgres_password',
    NORTHMES_DB_OWNER_PASSWORD_FILE: '/run/secrets/db_owner_password',
    NORTHMES_DB_APP_PASSWORD_FILE: '/run/secrets/db_app_password',
    NORTHMES_DB_AUTH_PASSWORD_FILE: '/run/secrets/db_auth_password',
  };

  it("E02-S01 migrateEnvSchema and bootstrapEnvSchema accept their entry point's keys without PORT", () => {
    expect(loadEnv(migrateEnvSchema)(migrateKeys)).toEqual({
      NODE_ENV: 'production',
      ...migrateKeys,
    });
    expect(loadEnv(bootstrapEnvSchema)(bootstrapKeys)).toEqual({
      NODE_ENV: 'production',
      ...bootstrapKeys,
    });

    const keysOf = (error: ConfigError) =>
      error.problems.map((problem) => problem.split(':')[0]).sort();
    expect(keysOf(configErrorOf(() => loadEnv(migrateEnvSchema)({})))).toEqual(
      Object.keys(migrateKeys).sort(),
    );
    expect(keysOf(configErrorOf(() => loadEnv(bootstrapEnvSchema)({})))).toEqual(
      Object.keys(bootstrapKeys).sort(),
    );
  });

  it('E02-S01 a DATABASE_URL that is not a Postgres URL or carries a login fails without its value', () => {
    for (const url of [
      'mysql://db.internal:5432/northmes',
      'postgres://nm_owner@db.internal:5432/northmes',
      'postgres://nm_owner:s3cret-pw@db.internal:5432/northmes',
      'postgresql://db.internal:5432/northmes?user=nm_owner&password=s3cret-pw',
    ]) {
      const error = configErrorOf(() =>
        loadEnv(migrateEnvSchema)({ ...migrateKeys, DATABASE_URL: url }),
      );

      expect(error.problems, url).toHaveLength(1);
      expect(error.problems[0], url).toMatch(/^DATABASE_URL: must be /);
      expect(error.message, url).not.toContain('db.internal');
      expect(error.message, url).not.toContain('s3cret-pw');
    }
  });
});
