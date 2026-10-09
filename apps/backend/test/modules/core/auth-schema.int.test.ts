// SPDX-License-Identifier: AGPL-3.0-or-later
import { query, useTestDatabase } from '@northmes/testing';
import { getMigrations } from 'better-auth/db/migration';
import { PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { authOptions } from '../../../src/modules/core/infrastructure/auth/auth-options.ts';

describe("Better Auth's tables", () => {
  const db = useTestDatabase();
  let pool: Pool | undefined;

  afterAll(async () => {
    await pool?.end();
  });

  it('E05-S05 the core migrations hold every table, column and index that Better Auth asks for, so its migration check finds nothing left to create', async () => {
    pool = new Pool({ connectionString: db.authUrl });
    const options = authOptions({
      dialect: new PostgresDialect({ pool }),
      baseURL: 'http://127.0.0.1:4100',
      secret: 'a-test-secret-that-is-long-enough-for-better-auth',
      webOrigins: [],
    });

    const { toBeCreated, toBeAdded, toBeAddedIndexes } = await getMigrations(options);

    expect({
      tables: toBeCreated.map(({ table }) => table),
      columns: toBeAdded.flatMap(({ table, fields }) =>
        Object.keys(fields).map((field) => `${table}.${field}`),
      ),
      indexes: toBeAddedIndexes.map(({ name }) => name),
    }).toEqual({ tables: [], columns: [], indexes: [] });
  });

  it('E05-S05 nm_auth reads auth.account, and nm_app may not', async () => {
    await expect(query(db.authUrl, 'select count(*)::int as n from auth.account')).resolves.toEqual(
      [{ n: 0 }],
    );
    await expect(query(db.appUrl, 'select count(*) from auth.account')).rejects.toThrow(
      /permission denied for table account/,
    );
    await expect(query(db.appUrl, 'select count(*) from auth.session')).rejects.toThrow(
      /permission denied for table session/,
    );
  });

  it('E05-S08 nm_app reads users through core.user_directory, and no other column of auth.user', async () => {
    await expect(
      query(db.appUrl, 'select id, name, username, banned from core.user_directory limit 1'),
    ).resolves.toEqual([]);
    await expect(query(db.appUrl, 'select email from auth."user"')).rejects.toThrow(
      /permission denied for table user/,
    );
  });
});
