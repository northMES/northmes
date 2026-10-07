// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { describe, expect, inject, it } from 'vitest';
import { useTestDatabase } from '../src/index.ts';

const imageFile = new URL('../../../infra/pg-image.json', import.meta.url);

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

  it('the container image equals the digest in infra/pg-image.json', async () => {
    const { image } = JSON.parse(readFileSync(imageFile, 'utf8')) as { image: string };

    expect(inject('pgImage')).toBe(image);
    expect(image).toContain('@sha256:');
    const rows = await query<{ version: string }>(connectionString, 'select version()');
    expect(rows[0]?.version).toMatch(/^PostgreSQL 18\./);
  });
});
