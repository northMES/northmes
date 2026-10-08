// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { hostFactory } from '@northmes/server/testing';
import { createTestApp, given, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { render } from '../../../../scripts/gen-migration.mjs';
import { checkCatalog } from '../../src/catalog/check-catalog.ts';
import { tracerPrincipal } from '../../src/gateway/tracer-principal.ts';
import { migrate } from '../../src/migrate/runner.ts';
import { type Principal, runAs } from '../../src/principal.ts';
import { imageVersion, inRepoModule } from '../fixtures/catalog.ts';

// The owner role of a module belongs to the server, which the other test files share, so this file
// migrates a module of its own.
const moduleId = 'scoped-database';

/** The Kysely table types of the fixture module, written by hand. */
interface FixtureDatabase {
  'scoped_database.work_note': { id: string; scope_id: string; version: number };
}

describe('ScopedDatabase', () => {
  const db = useTestDatabase();
  const plantA = given.plant();
  const plantB = given.plant();
  let migrationsDir: string | undefined;
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    migrationsDir = mkdtempSync(join(tmpdir(), 'northmes-scoped-'));
    const { path, sql } = render({
      module: moduleId,
      slug: 'work_note',
      now: new Date('2026-10-08T12:00:00Z'),
    });
    writeFileSync(join(migrationsDir, basename(path)), sql);
    const catalog = checkCatalog([{ ...inRepoModule(moduleId), migrationsDir }], { imageVersion });
    await migrate({ ownerUrl: db.ownerUrl, catalog });
    for (const plant of [plantA, plantB]) {
      await db.command(
        { principal: { type: 'system', id: 'fixture' }, scopes: [plant], reason: 'fixture' },
        (tx) => tx.query('insert into scoped_database.work_note (scope_id) values ($1)', [plant]),
      );
    }
    testApp = await createTestApp({ modules: [], hostFactory, database: db });
  });

  // Vitest runs the afterAll hooks of a block last registered first, so the app and its pool close
  // before useTestDatabase drops the database.
  afterAll(async () => {
    await testApp?.app.close();
    if (migrationsDir) rmSync(migrationsDir, { recursive: true, force: true });
  });

  /** The app's ScopedDatabase. */
  function scopedDatabase(): ScopedDatabase<FixtureDatabase> {
    if (!testApp) throw new Error('the test app did not start');
    return testApp.app.get(DATABASE);
  }

  /** The scope ids of the work notes that one transaction reads as `principal`. */
  function scopesReadAs(principal: Principal | null): Promise<string[]> {
    return runAs(principal, () =>
      scopedDatabase().transaction(async (tx) => {
        const rows = await tx.selectFrom('scoped_database.work_note').select('scope_id').execute();
        return rows.map((row) => row.scope_id);
      }),
    );
  }

  it("E02-S04 a transaction for plant A reads plant A's rows and none of plant B's", async () => {
    const scopes = await scopesReadAs(tracerPrincipal(plantA));

    expect(scopes).toEqual([plantA]);
  });

  it('E02-S04 a transaction without a plant reads zero rows', async () => {
    // The tracer principal plugin gives a request without x-northmes-plant no principal.
    const scopes = await scopesReadAs(null);

    expect(scopes).toEqual([]);
  });
});
