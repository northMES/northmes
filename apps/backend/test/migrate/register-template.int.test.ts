// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { givenCompany } from '@northmes/backend/testing';
import { DomainError, toDomainError } from '@northmes/sdk/errors';
import { useTestDatabase, withClient } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from '../../../../scripts/gen-migration.mjs';
import { checkCatalog } from '../../src/catalog/check-catalog.ts';
import { migrate } from '../../src/migrate/runner.ts';
import { imageVersion, inRepoModule } from '../fixtures/catalog.ts';

// The owner role of a module belongs to the server, which the other test files share, so this file
// migrates a module of its own. It is not core, so its foreign key into core.scope also shows that
// a plugin's register may use the template.
const moduleId = 'register-template';
const table = 'register_template.tool';

const principal = { type: 'user', id: 'e06-s04-register-template' } as const;

/** The SQLSTATE and constraint of a refused statement, or undefined when it ran. */
interface Refusal {
  readonly code: string;
  readonly constraint?: string;
}

describe('the register template', () => {
  const db = useTestDatabase();
  let migrationsDir: string;

  beforeAll(async () => {
    migrationsDir = mkdtempSync(join(tmpdir(), 'northmes-register-template-'));
    const { path, sql } = render({
      module: moduleId,
      slug: 'tool',
      now: new Date('2026-10-31T12:00:00Z'),
      register: true,
    });
    writeFileSync(join(migrationsDir, basename(path)), sql);
    const catalog = checkCatalog([{ ...inRepoModule(moduleId), migrationsDir }], { imageVersion });
    await migrate({ ownerUrl: db.ownerUrl, catalog });
  });

  afterAll(() => {
    if (migrationsDir) rmSync(migrationsDir, { recursive: true, force: true });
  });

  /**
   * Inserts a row at `scope`, a company's or a plant's node, as nm_app with only that scope in its
   * scope sets, and returns its id. The span is the node's own unless `span` names another node.
   */
  function insertAt(scope: string, code: string, span: string = scope): Promise<string> {
    return db.command({ principal, scopes: [scope], reason: 'fixture' }, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into ${table} (company_id, scope_id, scope_span, code, name)
         select s.company_id, s.id, (select span from core.scope where id = $3), $2, $2
           from core.scope s
          where s.id = $1
         returning id`,
        [scope, code, span],
      );
      const id = rows[0]?.id;
      if (id === undefined) throw new Error(`No scope node ${scope}`);
      return id;
    });
  }

  /** The SQLSTATE and constraint of the error a statement fails with. */
  async function refusal(run: Promise<unknown>): Promise<Refusal | undefined> {
    try {
      await run;
      return undefined;
    } catch (error) {
      const { code, constraint } = error as Refusal;
      return { code, constraint };
    }
  }

  it('E06-S04 two plants of one company both take T-100, and two companies both take it at company level', async () => {
    const acme = await givenCompany(db.ownerUrl, { plants: 2 });
    const other = await givenCompany(db.ownerUrl);
    const [hel = '', sto = ''] = acme.plants;

    await insertAt(hel, 'T-100');
    await insertAt(sto, 'T-100');
    await insertAt(acme.company, 'C-100');
    await insertAt(other.company, 'C-100');

    const rows = await db.command(
      { principal, scopes: [hel, sto, acme.company, other.company], reason: 'read' },
      async (tx) =>
        (await tx.query<{ code: string }>(`select code from ${table} order by code`)).rows,
    );
    expect(rows.map(({ code }) => code)).toEqual(['C-100', 'C-100', 'T-100', 'T-100']);
  });

  it('E06-S04 a company t-100 is refused while a plant holds T-100, as core.code_taken that names no plant, code or id', async () => {
    const acme = await givenCompany(db.ownerUrl);
    const [hel = ''] = acme.plants;
    const plantRow = await insertAt(hel, 'T-100');

    let error: unknown;
    try {
      await insertAt(acme.company, 't-100');
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({ code: '23P01', constraint: 'tool_code_excl' });
    const mapped = toDomainError(error);
    expect(mapped).toBeInstanceOf(DomainError);
    expect(mapped).toMatchObject({ code: 'core.code_taken' });
    const told = JSON.stringify({
      message: (mapped as DomainError).message,
      details: (mapped as DomainError).details,
      fieldErrors: (mapped as DomainError).fieldErrors,
    });
    for (const secret of [hel, plantRow, 'T-100', 't-100']) expect(told).not.toContain(secret);
  });

  it('E06-S04 a plant C-1 is refused when its company has c-1', async () => {
    const acme = await givenCompany(db.ownerUrl);
    const [hel = ''] = acme.plants;
    await insertAt(acme.company, 'c-1');

    expect(await refusal(insertAt(hel, 'C-1'))).toEqual({
      code: '23P01',
      constraint: 'tool_code_excl',
    });
  });

  it("E06-S04 moving plant A's T-100 to the company is refused while plant B has T-100", async () => {
    const acme = await givenCompany(db.ownerUrl, { plants: 2 });
    const [hel = '', sto = ''] = acme.plants;
    const helRow = await insertAt(hel, 'T-100');
    await insertAt(sto, 'T-100');

    const move = db.command(
      { principal, scopes: [acme.company, hel], reason: 'move to company' },
      (tx) =>
        tx.query(
          `update ${table}
              set scope_id = s.id, scope_span = s.span
             from core.scope s
            where s.id = $1 and ${table}.id = $2`,
          [acme.company, helRow],
        ),
    );

    expect(await refusal(move)).toEqual({ code: '23P01', constraint: 'tool_code_excl' });
  });

  it("E06-S04 a row whose span is not its scope's own is refused by the composite foreign key", async () => {
    const acme = await givenCompany(db.ownerUrl, { plants: 2 });
    const [hel = '', sto = ''] = acme.plants;

    expect(await refusal(insertAt(hel, 'S-1', sto))).toEqual({
      code: '23503',
      constraint: 'tool_scope_fkey',
    });
  });

  it('E06-S04 an archived row keeps its code', async () => {
    const acme = await givenCompany(db.ownerUrl);
    const [hel = ''] = acme.plants;
    const row = await insertAt(hel, 'A-1');
    await db.command({ principal, scopes: [hel], reason: 'archive' }, (tx) =>
      tx.query(`update ${table} set archived_at = now() where id = $1`, [row]),
    );

    expect(await refusal(insertAt(hel, 'a-1'))).toEqual({
      code: '23P01',
      constraint: 'tool_code_excl',
    });
  });

  it('E06-S04 with two sessions, the company insert waits for the uncommitted plant insert and then fails', async () => {
    const acme = await givenCompany(db.ownerUrl);
    const [hel = ''] = acme.plants;
    const insert = `insert into ${table} (company_id, scope_id, scope_span, code, name)
                    select company_id, id, span, $2, $2 from core.scope where id = $1`;
    const setScopes = `select set_config('northmes.read_scopes', $1::uuid[]::text, true),
                              set_config('northmes.write_scopes', $1::uuid[]::text, true)`;

    const companyResult = await withClient({ connectionString: db.appUrl }, (plantSession) =>
      withClient({ connectionString: db.appUrl }, async (companySession) => {
        await plantSession.query('begin');
        await plantSession.query(setScopes, [[hel]]);
        await plantSession.query(insert, [hel, 'W-1']);

        const {
          rows: [{ pid } = { pid: 0 }],
        } = await companySession.query<{ pid: number }>('select pg_backend_pid() as pid');
        await companySession.query('begin');
        await companySession.query(setScopes, [[acme.company]]);
        const companyInsert = refusal(companySession.query(insert, [acme.company, 'w-1']));
        // The company insert waits on the plant session's transaction, which pg_locks shows as a
        // lock of the company session's backend that is not granted. Other files share the
        // server, so only that backend counts.
        await vi.waitFor(
          async () => {
            const waiting = await withClient(
              { connectionString: db.ownerUrl },
              async (client) =>
                (
                  await client.query<{ count: number }>(
                    'select count(*)::int as count from pg_locks where pid = $1 and not granted',
                    [pid],
                  )
                ).rows[0],
            );
            expect(waiting?.count).toBeGreaterThan(0);
          },
          { timeout: 5000, interval: 50 },
        );
        await plantSession.query('commit');
        const result = await companyInsert;
        await companySession.query('rollback');
        return result;
      }),
    );

    expect(companyResult).toEqual({ code: '23P01', constraint: 'tool_code_excl' });
  });

  it("E06-S04 plant B reads its own rows and the company's, never plant A's", async () => {
    const acme = await givenCompany(db.ownerUrl, { plants: 2 });
    const [hel = '', sto = ''] = acme.plants;
    await insertAt(hel, 'H-1');
    await insertAt(sto, 'S-1');
    await insertAt(acme.company, 'C-1');

    const codes = await db.command(
      { principal, scopes: [sto, acme.company], writeScopes: [sto], reason: 'read' },
      async (tx) =>
        (await tx.query<{ code: string }>(`select code from ${table} order by code`)).rows,
    );

    expect(codes).toEqual([{ code: 'C-1' }, { code: 'S-1' }]);
  });

  it('E06-S04 an update bumps version and moves updated_at on through the touch trigger', async () => {
    const acme = await givenCompany(db.ownerUrl);
    const [hel = ''] = acme.plants;
    const row = await insertAt(hel, 'U-1');

    // The insert committed in a transaction of its own, so the update's now() is later.
    const [updated] = await db.command(
      { principal, scopes: [hel], reason: 'rename' },
      async (tx) =>
        (
          await tx.query<{ version: number; moved: boolean }>(
            `update ${table} set name = 'Renamed' where id = $1
           returning version, updated_at > created_at as moved`,
            [row],
          )
        ).rows,
    );

    expect(updated).toEqual({ version: 2, moved: true });
  });
});
