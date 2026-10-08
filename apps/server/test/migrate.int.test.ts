// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ModuleRef } from '@nestjs/core';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { emptyTemplateDatabase, query, useTestDatabase } from '@northmes/testing';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { bootForMigrate } from '../src/boot/boot.ts';
import { checkCatalog } from '../src/catalog/check-catalog.ts';
import { cli } from '../src/cli.ts';
import { type MigrateResult, migrate } from '../src/migrate/runner.ts';
import { imageVersion, inRepoModule } from './fixtures/catalog.ts';

/** The folder of a fixture module's migration files. */
function fixtureMigrations(id: string): string {
  return fileURLToPath(new URL(`./fixtures/migrations/${id}`, import.meta.url));
}

// Planning is listed first, and the catalog puts core first because planning depends on it. The
// timestamps of the two modules interleave, so applying every file by name would mix the modules.
const catalog = checkCatalog(
  [
    { ...inRepoModule('planning', ['core']), migrationsDir: fixtureMigrations('planning') },
    { ...inRepoModule('core'), migrationsDir: fixtureMigrations('core') },
  ],
  { imageVersion },
);

// The sha256 of each fixture file, as shasum -a 256 prints it.
const fixtureFiles = [
  {
    module: 'core',
    name: '20260105080000_article.sql',
    sha256: '3843fcbfa5ea7f75c47b14da24f49cc0f8e7e9a419a656b936961887bb1c5f9f',
  },
  {
    module: 'core',
    name: '20260107080000_article_name.sql',
    sha256: '7bc050daf883fa47dbb7269494f562e0599fcb03981dd6ad2fcaf274455276b4',
  },
  {
    module: 'planning',
    name: '20260106080000_production_order.sql',
    sha256: '68045a8dd101e8d0f3c5e77bba208adaef3d015a2f5e3cb7d71844de13914a26',
  },
  {
    module: 'planning',
    name: '20260108080000_production_order_quantity.sql',
    sha256: '5ae28ac1ae6a6803d97bb04abb2faf2411dd284d20b5760c24a550af17ba4629',
  },
];

// Each database here is cloned from the empty template, so it holds only what the test migrates.
// The migrated template already holds the in-repo modules' schemas and records, which would hide a
// migrate that does nothing and mix with the fixture files.
describe('migrate', () => {
  const db = useTestDatabase({ template: emptyTemplateDatabase });
  let first: MigrateResult;

  beforeAll(async () => {
    first = await migrate({ ownerUrl: db.ownerUrl, catalog });
  });

  it("E02-S02 core then planning apply in catalog order, each file under SET LOCAL ROLE of its module's owner role", async () => {
    const tables = await query(
      db.ownerUrl,
      `select schemaname, tablename, tableowner
         from pg_tables
        where schemaname in ('core', 'planning')
        order by schemaname, tablename`,
    );
    const records = await query<{ module: string; name: string; sha256: string; xmin: string }>(
      db.ownerUrl,
      'select module, name, sha256, xmin::text from northmes_meta.migration order by module, name',
    );

    expect(first.applied).toEqual(fixtureFiles.map(({ module, name }) => `${module}/${name}`));
    // The second file of each module alters the table its first file created, which only the
    // table's owner may do.
    expect(tables).toEqual([
      { schemaname: 'core', tablename: 'article', tableowner: 'nm_mod_core' },
      { schemaname: 'planning', tablename: 'production_order', tableowner: 'nm_mod_planning' },
    ]);
    expect(records.map(({ xmin, ...record }) => record)).toEqual(fixtureFiles);
    // xmin is the transaction that wrote the record: one per file.
    expect(new Set(records.map((record) => record.xmin)).size).toBe(fixtureFiles.length);
  });

  it('E02-S02 each module schema is owned by its module role', async () => {
    const schemas = await query(
      db.ownerUrl,
      `select n.nspname as schema, r.rolname as owner, r.rolcanlogin as can_login
         from pg_namespace n
         join pg_roles r on r.oid = n.nspowner
        where n.nspname in ('core', 'planning')
        order by n.nspname`,
    );
    // Roles belong to the server, which other test files share, so only these two are read.
    // Postgres keeps one row per grantor, so the options are combined over the rows.
    const memberships = await query(
      db.ownerUrl,
      `select r.rolname as role, m.rolname as member, bool_or(a.admin_option) as admin,
              bool_or(a.inherit_option) as inherit, bool_or(a.set_option) as set
         from pg_auth_members a
         join pg_roles r on r.oid = a.roleid
         join pg_roles m on m.oid = a.member
        where r.rolname in ('nm_mod_core', 'nm_mod_planning')
           or m.rolname in ('nm_mod_core', 'nm_mod_planning')
        group by r.rolname, m.rolname
        order by r.rolname, m.rolname`,
    );

    expect(schemas).toEqual([
      { schema: 'core', owner: 'nm_mod_core', can_login: false },
      { schema: 'planning', owner: 'nm_mod_planning', can_login: false },
    ]);
    // Each module role uses the REFERENCES grants of nm_ext. nm_owner may run as a module role
    // and administer it, and holds none of its rights.
    expect(memberships).toEqual([
      { role: 'nm_ext', member: 'nm_mod_core', admin: false, inherit: true, set: false },
      { role: 'nm_ext', member: 'nm_mod_planning', admin: false, inherit: true, set: false },
      { role: 'nm_mod_core', member: 'nm_owner', admin: true, inherit: false, set: true },
      { role: 'nm_mod_planning', member: 'nm_owner', admin: true, inherit: false, set: true },
    ]);
  });

  it('E02-S04 nm_ext may use each module schema, so a module role can reach a table it references', async () => {
    const usage = await query(
      db.ownerUrl,
      `select n.nspname as schema, has_schema_privilege('nm_ext', n.oid, 'USAGE') as usage
         from pg_namespace n
        where n.nspname in ('core', 'planning')
        order by n.nspname`,
    );

    expect(usage).toEqual([
      { schema: 'core', usage: true },
      { schema: 'planning', usage: true },
    ]);
  });

  it('E02-S02 a second run is a no-op', async () => {
    const records = () =>
      query(
        db.ownerUrl,
        'select module, name, sha256, applied_at from northmes_meta.migration order by module, name',
      );
    const before = await records();

    const second = await migrate({ ownerUrl: db.ownerUrl, catalog });

    expect(second.applied).toEqual([]);
    expect(await records()).toEqual(before);
  });
});

describe('concurrent migrate runs', () => {
  const db = useTestDatabase({ template: emptyTemplateDatabase });

  it('E02-S02 two concurrent runs apply each file once', async () => {
    const runs = await Promise.all([
      migrate({ ownerUrl: db.ownerUrl, catalog }),
      migrate({ ownerUrl: db.ownerUrl, catalog }),
    ]);
    const records = await query(
      db.ownerUrl,
      'select module, name from northmes_meta.migration order by module, name',
    );

    expect(runs.map((run) => run.applied.length).sort((a, b) => a - b)).toEqual([
      0,
      fixtureFiles.length,
    ]);
    expect(records).toEqual(fixtureFiles.map(({ module, name }) => ({ module, name })));
  });
});

describe('pnpm northmes migrate', () => {
  const db = useTestDatabase({ template: emptyTemplateDatabase });
  let secretsDir: string;

  beforeAll(() => {
    secretsDir = mkdtempSync(join(tmpdir(), 'northmes-migrate-'));
  });

  afterAll(() => {
    if (secretsDir) rmSync(secretsDir, { recursive: true, force: true });
  });

  // ConfigModule writes the validated environment into process.env, as it does in the server. The
  // stubs remove these keys for the test, and unstubAllEnvs takes them out again afterwards.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /**
   * The environment of migrate: DATABASE_URL without a login and the owner's password in a secret
   * file. The keys are stubbed, so ConfigModule's writes to process.env end with the test.
   */
  function migrateEnv(): Record<string, string> {
    for (const key of ['DATABASE_URL', 'NORTHMES_DB_OWNER_PASSWORD_FILE'])
      vi.stubEnv(key, undefined);
    const databaseUrl = new URL(db.ownerUrl);
    const passwordFile = join(secretsDir, 'db_owner_password');
    writeFileSync(passwordFile, `${decodeURIComponent(databaseUrl.password)}\n`, { mode: 0o600 });
    databaseUrl.username = '';
    databaseUrl.password = '';
    return {
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl.href,
      NORTHMES_DB_OWNER_PASSWORD_FILE: passwordFile,
    };
  }

  it('E02-S02 pnpm northmes migrate boots the catalog without listening and migrates it as nm_owner', async () => {
    const log = { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
    const exit = vi.fn<(code: number) => void>();

    await cli(['migrate'], { env: migrateEnv(), exit, log });
    const schemas = await query(
      db.ownerUrl,
      `select n.nspname as schema, r.rolname as owner
         from pg_namespace n
         join pg_roles r on r.oid = n.nspowner
        where n.nspname in ('core', 'planning')
        order by n.nspname`,
    );
    const records = await query<{ module: string; name: string }>(
      db.ownerUrl,
      'select module, name from northmes_meta.migration order by applied_at',
    );

    expect(exit).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
    // Each file of the in-repo modules is logged as migrate applies it, and nothing listens.
    expect(log.info.mock.calls).toEqual([
      ['Modules in boot order: core, planning'],
      ...records.map(({ module, name }) => [`Applied ${module}/${name}`]),
      ['Migrations up to date'],
    ]);
    expect(schemas).toEqual([
      { schema: 'core', owner: 'nm_mod_core' },
      { schema: 'planning', owner: 'nm_mod_planning' },
    ]);
  });

  it('E02-S04 the boot of pnpm northmes migrate constructs no nm_app pool, and its ScopedDatabase refuses a transaction', async () => {
    // The migrate environment holds no nm_app password (ADR 0060).
    const { app } = await bootForMigrate({
      env: migrateEnv(),
      importManifest: (specifier) => import(specifier),
      exit: vi.fn<(code: number) => void>(),
      log: { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() },
    });
    try {
      const database = app.get<string, ScopedDatabase<unknown>>(DATABASE);
      // The app's own get ends the process when a provider is missing, as boot does not pass
      // abortOnError: false. Its ModuleRef throws instead.
      const moduleRef = app.get(ModuleRef);

      expect(() => moduleRef.get(Pool, { strict: false })).toThrow('this provider does not exist');
      await expect(database.transaction(async () => 'ran')).rejects.toThrow(
        'pnpm northmes migrate has no nm_app pool',
      );
    } finally {
      await app.close();
    }
  });
});
