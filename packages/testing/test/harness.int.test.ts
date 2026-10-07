// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, inject, it, vi } from 'vitest';
import { templateDatabase, withClient } from '../src/database.ts';
import { query, useTestDatabase } from '../src/index.ts';

const imageFile = new URL('../../../infra/pg-image.json', import.meta.url);

describe('the test database', () => {
  const { connectionString, databaseName } = useTestDatabase();

  it('the connection string points at the database named databaseName', async () => {
    const rows = await query<{ current_database: string }>(
      connectionString,
      'select current_database()',
    );

    expect(rows).toEqual([{ current_database: databaseName }]);
  });

  it('the database is cloned from the template', async () => {
    const rows = await query<{ marker: string | null }>(
      connectionString,
      "select to_regclass('public.nm_marker')::text as marker",
    );

    expect(rows).toEqual([{ marker: 'nm_marker' }]);
  });

  it('the template database is flagged as a template', async () => {
    const name = templateDatabase.replaceAll("'", "''");

    const rows = await query<{ datistemplate: boolean }>(
      connectionString,
      `select datistemplate from pg_database where datname = '${name}'`,
    );

    expect(rows).toEqual([{ datistemplate: true }]);
  });

  it('the container image equals the digest in infra/pg-image.json', async () => {
    const { image } = JSON.parse(readFileSync(imageFile, 'utf8')) as { image: string };

    expect(inject('pgImage')).toBe(image);
    expect(image).toContain('@sha256:');
    // The server must report the major version that the image names, so a wrong image fails here.
    const major = /^postgres:(\d+)[@-]/.exec(image)?.[1];
    expect(major).toBeDefined();
    const rows = await query<{ version: string }>(connectionString, 'select version()');
    expect(rows[0]?.version).toMatch(new RegExp(`^PostgreSQL ${major}\\.`));
  });

  // harness-sibling.int.test.ts runs the same test with a table of its own, in parallel.
  it('each test file gets its own database', async () => {
    expect(databaseName).toMatch(/^t_\d+_[0-9a-f]{12}$/);
    await query(connectionString, 'create table harness_only (id integer)');

    const rows = await query<{ tablename: string }>(
      connectionString,
      "select tablename from pg_tables where schemaname = 'public' order by tablename",
    );

    expect(rows.map((row) => row.tablename)).toEqual(['harness_only', 'nm_marker']);
  });
});

describe('a project without the global setup', () => {
  afterEach(() => {
    vi.doUnmock('vitest');
    vi.resetModules();
  });

  it('useTestDatabase names the missing global setup', async () => {
    vi.resetModules();
    vi.doMock('vitest', async (importOriginal) => ({
      ...(await importOriginal<typeof import('vitest')>()),
      inject: () => undefined,
    }));
    const { useTestDatabase: withoutSetup } = await import('../src/database.ts');

    expect(() => withoutSetup()).toThrow(/global setup/);
  });
});

describe('withClient', () => {
  it('rethrows why the connection dropped, not that the client is not queryable', async () => {
    const pg = inject('pg');

    const failure = withClient(pg, async (client) => {
      const { rows } = await client.query<{ pid: number }>('select pg_backend_pid() as pid');
      const dropped = new Promise((resolve) => client.once('error', resolve));
      await withClient(pg, (admin) =>
        admin.query('select pg_terminate_backend($1)', [rows[0]?.pid]),
      );
      await dropped;
      await client.query('select 1');
    });

    await expect(failure).rejects.toThrow(/terminating connection due to administrator command/);
  });
});

describe('the global setup', () => {
  afterEach(() => {
    vi.doUnmock('@testcontainers/postgresql');
  });

  // Vitest only runs the teardown that setup returns, so a setup that rejects must stop the container itself.
  it('stops the container when preparing the template fails', async () => {
    const stop = vi.fn(async () => {});
    vi.doMock('@testcontainers/postgresql', () => ({
      PostgreSqlContainer: class {
        async start() {
          // Nothing listens on port 1, so the connection that creates the template is refused.
          return {
            getHost: () => '127.0.0.1',
            getPort: () => 1,
            getUsername: () => 'postgres',
            getPassword: () => 'postgres',
            getDatabase: () => 'postgres',
            stop,
          };
        }
      },
    }));
    const { default: setup } = await import('../src/global-setup.ts');
    const project = { provide: vi.fn() } as unknown as Parameters<typeof setup>[0];

    await expect(setup(project)).rejects.toThrow();

    expect(stop).toHaveBeenCalledOnce();
  });
});

describe('a test database that is dropped before the file ends', () => {
  const { databaseName } = useTestDatabase();

  // When the clone in beforeAll fails, the database never exists and afterAll runs the same drop.
  // That drop must not fail with its own error and hide the cause.
  it('afterAll does not fail when the database is already gone', async () => {
    await withClient(inject('pg'), async (client) => {
      await client.query(`drop database ${client.escapeIdentifier(databaseName)} with (force)`);
    });
  });
});
