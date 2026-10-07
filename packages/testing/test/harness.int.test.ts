// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, inject, it, vi } from 'vitest';
import { withClient } from '../src/database.ts';
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

  it('the container image equals the digest in infra/pg-image.json', async () => {
    const { image } = JSON.parse(readFileSync(imageFile, 'utf8')) as { image: string };

    expect(inject('pgImage')).toBe(image);
    expect(image).toContain('@sha256:');
    const rows = await query<{ version: string }>(connectionString, 'select version()');
    expect(rows[0]?.version).toMatch(/^PostgreSQL 18\./);
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
