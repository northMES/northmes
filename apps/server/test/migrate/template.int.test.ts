// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { useTestDatabase } from '@northmes/testing';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { render } from '../../../../scripts/gen-migration.mjs';
import { checkCatalog } from '../../src/catalog/check-catalog.ts';
import { migrate } from '../../src/migrate/runner.ts';
import { imageVersion, inRepoModule } from '../fixtures/catalog.ts';

// The owner role of a module belongs to the server, which the other test files share, so this file
// migrates a module of its own.
const moduleId = 'table-template';
const ownerRole = 'nm_mod_table_template';
const table = 'table_template.work_note';

const plantA = randomUUID();
const plantB = randomUUID();

/**
 * Runs `run` on `client` in a transaction that sets both scope sets to `scopes` first, as the SDK's
 * transaction helper does (ADR 0008), or in one that sets no scopes when `scopes` is undefined.
 */
async function inTransaction<Result>(
  client: Client,
  scopes: readonly string[] | undefined,
  run: () => Promise<Result>,
): Promise<Result> {
  await client.query('begin');
  try {
    if (scopes) {
      const scopeSet = `{${scopes.join(',')}}`;
      await client.query(
        `select set_config('northmes.read_scopes', $1, true),
                set_config('northmes.write_scopes', $1, true)`,
        [scopeSet],
      );
    }
    const result = await run();
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

/** Runs `run` on a client that logs in with `connectionString`, and closes the client afterwards. */
async function connected<Result>(
  connectionString: string,
  run: (client: Client) => Promise<Result>,
): Promise<Result> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

describe('the table template', () => {
  const db = useTestDatabase();
  let migrationsDir: string;

  beforeAll(async () => {
    migrationsDir = mkdtempSync(join(tmpdir(), 'northmes-template-'));
    const { path, sql } = render({
      module: moduleId,
      slug: 'work_note',
      now: new Date('2026-10-08T12:00:00Z'),
    });
    writeFileSync(join(migrationsDir, basename(path)), sql);
    const catalog = checkCatalog([{ ...inRepoModule(moduleId), migrationsDir }], { imageVersion });
    await migrate({ ownerUrl: db.ownerUrl, catalog });

    // The owner role bypasses the policies (ADR 0008), so the rows are written as it.
    await connected(db.ownerUrl, async (client) => {
      await client.query('begin');
      await client.query(`set local role ${ownerRole}`);
      await client.query(`insert into ${table} (scope_id) values ($1), ($2)`, [plantA, plantB]);
      await client.query('commit');
    });
  });

  afterAll(() => {
    if (migrationsDir) rmSync(migrationsDir, { recursive: true, force: true });
  });

  it("E02-S02 a generated table returns no rows to nm_app without scopes and its scope's rows with them", async () => {
    const scopesOfRows = async (client: Client, scopes: readonly string[] | undefined) =>
      inTransaction(client, scopes, async () => {
        const { rows } = await client.query<{ scope_id: string }>(`select scope_id from ${table}`);
        return rows.map((row) => row.scope_id);
      });

    const [neverSet, atPlantA, afterScopedTransaction] = await connected(
      db.appUrl,
      async (client) => [
        await scopesOfRows(client, undefined),
        await scopesOfRows(client, [plantA]),
        // After a transaction that set the scopes commits, the setting reads as an empty string
        // on the same connection, not as NULL (ADR 0008).
        await scopesOfRows(client, undefined),
      ],
    );

    expect(neverSet).toEqual([]);
    expect(atPlantA).toEqual([plantA]);
    expect(afterScopedTransaction).toEqual([]);
  });
});
