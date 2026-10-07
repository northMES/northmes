// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { query, useTestDatabase } from '../src/index.ts';

// harness.int.test.ts runs the same test with a table of its own, in parallel.
describe('the test database of the sibling file', () => {
  const { connectionString, databaseName } = useTestDatabase();

  it('each test file gets its own database', async () => {
    expect(databaseName).toMatch(/^t_\d+_[0-9a-f]{12}$/);
    await query(connectionString, 'create table sibling_only (id integer)');

    const rows = await query<{ tablename: string }>(
      connectionString,
      "select tablename from pg_tables where schemaname = 'public' order by tablename",
    );

    expect(rows.map((row) => row.tablename)).toEqual(['nm_marker', 'sibling_only']);
  });
});
