// SPDX-License-Identifier: MIT
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../src/index.ts';

async function query<Row>(connectionString: string, sql: string): Promise<Row[]> {
  const client = new Client({ connectionString });
  client.on('error', () => {});
  await client.connect();
  try {
    const result = await client.query(sql);
    return result.rows as Row[];
  } finally {
    await client.end();
  }
}

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
});
