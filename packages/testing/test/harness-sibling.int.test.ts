// SPDX-License-Identifier: MIT
import { describe, expect, inject, it } from 'vitest';
import { query, useTestDatabase } from '../src/index.ts';

/** Logs in to database as the container's superuser, which may create a table in public. */
function superuserUrl(database: string): string {
  const { user, password, host, port } = inject('pg');
  const credentials = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  return `postgres://${credentials}@${host}:${port}/${encodeURIComponent(database)}`;
}

// harness.int.test.ts runs the same test with a table of its own, in parallel.
describe('the test database of the sibling file', () => {
  const { appUrl, databaseName } = useTestDatabase();

  it('each test file gets its own database', async () => {
    expect(databaseName).toMatch(/^t_\d+_[0-9a-f]{12}$/);
    await query(superuserUrl(databaseName), 'create table sibling_only (id integer)');

    const rows = await query<{ tablename: string }>(
      appUrl,
      "select tablename from pg_tables where schemaname = 'public' order by tablename",
    );

    expect(rows.map((row) => row.tablename)).toEqual(['nm_marker', 'sibling_only']);
  });
});
