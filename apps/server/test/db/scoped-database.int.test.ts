// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { inspect } from 'node:util';
import { Logger } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { hostFactory } from '@northmes/server/testing';
import { createTestApp, given, query, type TestApp, useTestDatabase } from '@northmes/testing';
import { CompiledQuery } from 'kysely';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from '../../../../scripts/gen-migration.mjs';
import { checkCatalog } from '../../src/catalog/check-catalog.ts';
import { tracerPrincipal } from '../../src/gateway/tracer-principal.ts';
import { migrate } from '../../src/migrate/runner.ts';
import { type Principal, runAs } from '../../src/principal.ts';
import { imageVersion, inRepoModule } from '../fixtures/catalog.ts';

// The owner role of a module belongs to the server, which the other test files share, so this file
// migrates a module of its own.
const moduleId = 'scoped-database';

/** What a connection reports about its login and its scope settings. */
interface Session {
  user: string;
  pid: number;
  readScopes: string | null;
  writeScopes: string | null;
}

/** Selects a Session row. missing_ok is true, so a setting that was never set reads as null. */
const sessionQuery = `select current_user as "user", pg_backend_pid() as pid,
  current_setting('northmes.read_scopes', true) as "readScopes",
  current_setting('northmes.write_scopes', true) as "writeScopes"`;

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

  /** The app's nm_app pool, which the ScopedDatabase runs on. */
  function pool(): Pool {
    if (!testApp) throw new Error('the test app did not start');
    return testApp.app.get(Pool);
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

  it('E02-S04 the pool connects as nm_app and sets scopes only inside the transaction', async () => {
    const inside = await runAs(tracerPrincipal(plantA), () =>
      scopedDatabase().transaction(async (tx) => {
        const { rows } = await tx.executeQuery<Session>(CompiledQuery.raw(sessionQuery));
        return rows[0];
      }),
    );
    // The pool hands out the connection released last, the one the transaction ran on; the
    // backend pid shows that it is.
    const {
      rows: [after],
    } = await pool().query<Session>(sessionQuery);

    expect(inside).toEqual({
      user: 'nm_app',
      pid: expect.any(Number),
      readScopes: `{${plantA}}`,
      writeScopes: `{${plantA}}`,
    });
    // A transaction-local setting reads as an empty string once its transaction ends (ADR 0008).
    expect(after).toEqual({ user: 'nm_app', pid: inside?.pid, readScopes: '', writeScopes: '' });
  });

  it('E02-S04 after Postgres ends an idle connection of the pool, the server logs it without its connection settings and the next transaction runs', async () => {
    const appPassword = decodeURIComponent(new URL(db.appUrl).password);
    const warned = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    try {
      // The transaction leaves its connection idle in the pool.
      await scopesReadAs(tracerPrincipal(plantA));

      // A restart, pg_terminate_backend or idle_session_timeout ends a connection the same way.
      // nm_app may end the other connections of its own role. pg-pool drops each ended client and
      // emits error on the pool, with the client and its password on the error.
      await query(
        db.appUrl,
        `select pg_terminate_backend(pid)
           from pg_stat_activity
          where datname = current_database() and usename = 'nm_app' and pid <> pg_backend_pid()`,
      );
      await vi.waitFor(() => expect(pool().totalCount).toBe(0));

      expect(warned).toHaveBeenCalledWith(
        'The nm_app pool dropped an idle connection after error 57P01: terminating connection due to administrator command',
      );
      expect(inspect(warned.mock.calls, { depth: null })).not.toContain(appPassword);
      expect(await scopesReadAs(tracerPrincipal(plantA))).toEqual([plantA]);
    } finally {
      warned.mockRestore();
    }
  });
});
