// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, inject, it, vi } from 'vitest';
import { withClient } from '../src/client.ts';
import { emptyTemplateDatabase, query, useTestDatabase } from '../src/index.ts';

const imageFile = new URL('../../../infra/pg-image.json', import.meta.url);

/**
 * Logs in to database as the container's superuser. Only the checks of the container itself use
 * it: nm_app sees neither the server's own time zone, which its role setting replaces, nor the data
 * directory.
 */
function superuserUrl(database: string): string {
  const { user, password, host, port } = inject('pg');
  const credentials = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  return `postgres://${credentials}@${host}:${port}/${encodeURIComponent(database)}`;
}

describe('the test database', () => {
  const { appUrl, ownerUrl, databaseName } = useTestDatabase();

  it('the connection string points at the database named databaseName', async () => {
    const rows = await query<{ current_database: string }>(appUrl, 'select current_database()');

    expect(rows).toEqual([{ current_database: databaseName }]);
  });

  it('the database is cloned from the template', async () => {
    const rows = await query<{ marker: string | null }>(
      appUrl,
      "select to_regclass('public.nm_marker')::text as marker",
    );

    expect(rows).toEqual([{ marker: 'nm_marker' }]);
  });

  it('the template database is flagged as a template', async () => {
    const name = inject('pgTemplate').replaceAll("'", "''");

    const rows = await query<{ datistemplate: boolean }>(
      appUrl,
      `select datistemplate from pg_database where datname = '${name}'`,
    );

    expect(rows).toEqual([{ datistemplate: true }]);
  });

  it('the server time zone follows NM_TEST_PG_TZ', async () => {
    const rows = await query<{ TimeZone: string }>(superuserUrl(databaseName), 'show timezone');

    // An unset, empty or blank NM_TEST_PG_TZ means UTC.
    expect(rows).toEqual([{ TimeZone: process.env.NM_TEST_PG_TZ?.trim() || 'UTC' }]);
  });

  it('the data directory is a tmpfs mount', async () => {
    const dataDirectories = await query<{ data_directory: string }>(
      superuserUrl(databaseName),
      'show data_directory',
    );
    // pg_read_file needs the superuser that the container creates.
    const mountTables = await query<{ mounts: string }>(
      superuserUrl(databaseName),
      "select pg_read_file('/proc/mounts') as mounts",
    );
    const dataDirectory = dataDirectories[0]?.data_directory ?? '';

    // Each line of /proc/mounts reads: device, mount point, file system type, options.
    const mounts = (mountTables[0]?.mounts ?? '')
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => {
        const [, mountPoint = '', type = ''] = line.split(' ');
        return { mountPoint, type };
      });
    // The mount that holds the data directory is the one with the longest mount point above it.
    const holding = mounts
      .filter(
        ({ mountPoint }) =>
          dataDirectory === mountPoint ||
          dataDirectory.startsWith(mountPoint.endsWith('/') ? mountPoint : `${mountPoint}/`),
      )
      .sort((a, b) => b.mountPoint.length - a.mountPoint.length)[0];

    expect(holding?.type).toBe('tmpfs');
  });

  it('durability is off', async () => {
    const settings = await Promise.all(
      ['fsync', 'synchronous_commit', 'full_page_writes'].map(async (setting) => {
        const rows = await query<Record<string, string>>(appUrl, `show ${setting}`);
        return [setting, rows[0]?.[setting]];
      }),
    );

    expect(Object.fromEntries(settings)).toEqual({
      fsync: 'off',
      synchronous_commit: 'off',
      full_page_writes: 'off',
    });
  });

  it('the server allows 300 connections', async () => {
    const rows = await query<{ max_connections: string }>(appUrl, 'show max_connections');

    expect(rows).toEqual([{ max_connections: '300' }]);
  });

  it('the container uses the run credentials', () => {
    const { password, database } = inject('pg');

    expect(password).not.toBe('test');
    expect(password.length).toBeGreaterThanOrEqual(32);
    expect(database).toMatch(/^nm_run_[0-9a-f]+$/);
  });

  it('the container image equals the digest in infra/pg-image.json', async () => {
    const { image } = JSON.parse(readFileSync(imageFile, 'utf8')) as { image: string };

    expect(inject('pgImage')).toBe(image);
    expect(image).toContain('@sha256:');
    // The server must report the major version that the image names, so a wrong image fails here.
    const major = /^postgres:(\d+)[@-]/.exec(image)?.[1];
    expect(major).toBeDefined();
    const rows = await query<{ version: string }>(appUrl, 'select version()');
    expect(rows[0]?.version).toMatch(new RegExp(`^PostgreSQL ${major}\\.`));
  });

  // harness-sibling.int.test.ts runs the same test with a schema of its own, in parallel.
  it('each test file gets its own database', async () => {
    expect(databaseName).toMatch(/^t_\d+_[0-9a-f]{12}$/);
    await query(ownerUrl, 'create schema harness_only');

    const rows = await query<{ nspname: string }>(
      appUrl,
      "select nspname from pg_namespace where nspname in ('harness_only', 'sibling_only')",
    );

    expect(rows).toEqual([{ nspname: 'harness_only' }]);
  });
});

describe('the connections of a test database', () => {
  const database = useTestDatabase();

  it('E02-S02 useTestDatabase hands out nm_app and nm_owner connections and never the superuser', async () => {
    const { password } = inject('pg');

    // No connection string of the superuser is handed out, under any key.
    expect(Object.keys(database).sort()).toEqual(['appUrl', 'command', 'databaseName', 'ownerUrl']);
    expect(JSON.stringify(database)).not.toContain(encodeURIComponent(password));

    const sessions = await Promise.all(
      [database.appUrl, database.ownerUrl].map((url) =>
        query(url, 'select current_user, current_database()'),
      ),
    );

    expect(sessions).toEqual([
      [{ current_user: 'nm_app', current_database: database.databaseName }],
      [{ current_user: 'nm_owner', current_database: database.databaseName }],
    ]);
  });

  // Bootstrap grants nm_owner CREATE on the database, and a clone does not copy that grant.
  it('E02-S02 nm_owner may create a schema in its test database', async () => {
    await query(database.ownerUrl, 'create schema owner_only');

    const rows = await query(
      database.appUrl,
      "select pg_get_userbyid(nspowner) as owner from pg_namespace where nspname = 'owner_only'",
    );

    expect(rows).toEqual([{ owner: 'nm_owner' }]);
  });
});

describe('a test database cloned from the empty template', () => {
  const { appUrl } = useTestDatabase({ template: emptyTemplateDatabase });

  // The migrated template holds northmes_meta, which the empty template lacks.
  it('E02-S02 useTestDatabase clones the template that its options name', async () => {
    const rows = await query<{ marker: string | null; meta: string | null }>(
      appUrl,
      `select to_regclass('public.nm_marker')::text as marker,
              to_regnamespace('northmes_meta')::text as meta`,
    );

    expect(rows).toEqual([{ marker: 'nm_marker', meta: null }]);
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
    // The index imports the container module, so the mock applies only to modules loaded afresh.
    vi.resetModules();
    vi.doMock('@testcontainers/postgresql', () => ({
      PostgreSqlContainer: class {
        withUsername() {
          return this;
        }

        withCommand() {
          return this;
        }

        withTmpFs() {
          return this;
        }

        withPassword() {
          return this;
        }

        withDatabase() {
          return this;
        }

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
