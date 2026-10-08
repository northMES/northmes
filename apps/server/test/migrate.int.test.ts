// SPDX-License-Identifier: AGPL-3.0-or-later
import { appendFileSync, cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ModuleRef } from '@nestjs/core';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { emptyTemplateDatabase, query, useTestDatabase } from '@northmes/testing';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootForMigrate } from '../src/boot/boot.ts';
import { checkCatalog } from '../src/catalog/check-catalog.ts';
import { cli } from '../src/cli.ts';
import { type MigrateResult, migrate } from '../src/migrate/runner.ts';
import { imageVersion, inRepoModule, plugin } from './fixtures/catalog.ts';
import { migrateEnvKeys, useMigrateEnv } from './fixtures/server-env.ts';

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
    sha256: '9d616515fa1a0c0559fa418e0635e0676e88341eb9098865573a6d7790ff2226',
  },
  {
    module: 'core',
    name: '20260107080000_article_name.sql',
    sha256: '21a42f6c5d6c740940bb1d5e991e9de17691fb89094a477ced3731e3bd78fe49',
  },
  {
    module: 'planning',
    name: '20260106080000_production_order.sql',
    sha256: '260cf722f1446cffa2a1cf4e3b38efabc9559b9070874f9c9353d7d7d007b798',
  },
  {
    module: 'planning',
    name: '20260108080000_production_order_quantity.sql',
    sha256: '08066b277f30e993854c0c8d77bc496a6d11c859dd53c10ccd69ef548b4043c3',
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

describe('migrate checks every module before it applies a file', () => {
  const db = useTestDatabase({ template: emptyTemplateDatabase });
  let copies: string;

  beforeAll(() => {
    copies = mkdtempSync(join(tmpdir(), 'northmes-migrate-checks-'));
  });

  afterAll(() => {
    if (copies) rmSync(copies, { recursive: true, force: true });
  });

  it('E02-S02 checksum drift stops the run naming the file', async () => {
    // Copies of the fixture modules, which the test edits after the first run.
    const coreDir = join(copies, 'core');
    const planningDir = join(copies, 'planning');
    cpSync(fixtureMigrations('core'), coreDir, { recursive: true });
    cpSync(fixtureMigrations('planning'), planningDir, { recursive: true });
    const copied = checkCatalog(
      [
        { ...inRepoModule('planning', ['core']), migrationsDir: planningDir },
        { ...inRepoModule('core'), migrationsDir: coreDir },
      ],
      { imageVersion },
    );
    await migrate({ ownerUrl: db.ownerUrl, catalog: copied });
    // An applied planning file is edited, and core, which comes first, gains a pending file.
    appendFileSync(
      join(planningDir, '20260106080000_production_order.sql'),
      'alter table planning.production_order add column note text;\n',
    );
    writeFileSync(
      join(coreDir, '20260109080000_article_unit.sql'),
      '-- migration: expand\nalter table core.article add column unit text;\n',
    );

    const run = migrate({ ownerUrl: db.ownerUrl, catalog: copied });

    await expect(run).rejects.toMatchObject({
      name: 'MigrationError',
      exitCode: 1,
      problems: [
        'planning/20260106080000_production_order.sql changed after it was applied; put the change in a new migration file',
      ],
    });
    // The pending core file was not applied either.
    expect(
      await query(
        db.ownerUrl,
        'select module, name from northmes_meta.migration order by module, name',
      ),
    ).toEqual(fixtureFiles.map(({ module, name }) => ({ module, name })));
  });
});

// Planning's folder is a fixture with a problem, and core's fixture files are fine. core comes
// first in catalog order, so a run that applied files before it checked them would apply core's.
describe('migrate refuses a module whose files break a naming rule', () => {
  const db = useTestDatabase({ template: emptyTemplateDatabase });

  /** The catalog of core's fixture files and planning with the files of the fixture folder. */
  function catalogWithPlanning(folder: string) {
    return checkCatalog(
      [
        { ...inRepoModule('planning', ['core']), migrationsDir: fixtureMigrations(folder) },
        { ...inRepoModule('core'), migrationsDir: fixtureMigrations('core') },
      ],
      { imageVersion },
    );
  }

  it('E02-S02 two files with the same timestamp prefix in one module are refused', async () => {
    const run = migrate({
      ownerUrl: db.ownerUrl,
      catalog: catalogWithPlanning('duplicate-prefix'),
    });

    await expect(run).rejects.toMatchObject({
      name: 'MigrationError',
      exitCode: 1,
      problems: [
        'planning/20260110080000_shift.sql and planning/20260110080000_work_center.sql share the timestamp prefix 20260110080000; give each file a timestamp of its own',
      ],
    });
    expect(await query(db.ownerUrl, 'select module, name from northmes_meta.migration')).toEqual(
      [],
    );
  });

  it('E02-S02 a file without an expand or contract marker is refused', async () => {
    // The folder's first file carries the marker, and its second starts with another comment.
    const run = migrate({ ownerUrl: db.ownerUrl, catalog: catalogWithPlanning('unmarked') });

    await expect(run).rejects.toMatchObject({
      name: 'MigrationError',
      exitCode: 1,
      problems: [
        'planning/20260110080000_shift.sql has no expand or contract marker; start the file with "-- migration: expand" or "-- migration: contract"',
      ],
    });
    expect(await query(db.ownerUrl, 'select module, name from northmes_meta.migration')).toEqual(
      [],
    );
  });
});

// Each plugin's fixture folder holds one file that reaches into a schema the plugin does not own.
// The plugin's owner role may use core and planning through nm_ext, so Postgres refuses the
// statement itself, as it would for a plugin that tried.
describe('migrate confines a plugin to its own schema', () => {
  const db = useTestDatabase({ template: emptyTemplateDatabase });

  beforeAll(async () => {
    await migrate({ ownerUrl: db.ownerUrl, catalog });
  });

  /** The fixture modules and the plugin whose fixture folder has the plugin's id. */
  function catalogWithPlugin(id: string, dependsOn: readonly string[]) {
    return checkCatalog(
      [
        { ...inRepoModule('planning', ['core']), migrationsDir: fixtureMigrations('planning') },
        { ...inRepoModule('core'), migrationsDir: fixtureMigrations('core') },
        { ...plugin(id, dependsOn), migrationsDir: fixtureMigrations(id) },
      ],
      { imageVersion },
    );
  }

  /** The files northmes_meta.migration records for a module. */
  function recordsOf(module: string) {
    return query(
      db.ownerUrl,
      `select name from northmes_meta.migration where module = '${module}' order by name`,
    );
  }

  /**
   * The schema and the owner role nm_mod_<sql> that the database holds for a plugin's sql name.
   * Roles belong to the server, so pg_roles would also show a role that a refused file left behind.
   */
  async function schemaAndRoleOf(sql: string) {
    return {
      schemas: await query(
        db.ownerUrl,
        `select nspname from pg_namespace where nspname = '${sql}'`,
      ),
      roles: await query(
        db.ownerUrl,
        `select rolname from pg_roles where rolname = 'nm_mod_${sql}'`,
      ),
    };
  }

  it('E02-S02 a plugin ALTER on core.article is refused', async () => {
    // information_schema lists only the columns that the role may use, and nm_owner holds no
    // rights on core's tables, so the columns come from the catalog.
    const columns = () =>
      query(
        db.ownerUrl,
        `select a.attname as column
           from pg_attribute a
           join pg_class c on c.oid = a.attrelid
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'core' and c.relname = 'article' and a.attnum > 0
            and not a.attisdropped
          order by a.attnum`,
      );
    const before = await columns();

    const run = migrate({
      ownerUrl: db.ownerUrl,
      catalog: catalogWithPlugin('alter-core', ['core']),
    });

    await expect(run).rejects.toMatchObject({
      name: 'MigrationError',
      exitCode: 1,
      problems: [
        'alter-core/20260111080000_article_secret.sql failed as nm_mod_alter_core and was rolled back: must be owner of table article',
      ],
    });
    expect(before).toEqual([{ column: 'id' }, { column: 'code' }, { column: 'name' }]);
    expect(await columns()).toEqual(before);
    expect(await recordsOf('alter-core')).toEqual([]);
    expect(await schemaAndRoleOf('alter_core')).toEqual({ schemas: [], roles: [] });
  });

  it('E02-S02 a plugin CREATE TABLE in the core schema is refused and changes nothing', async () => {
    const run = migrate({
      ownerUrl: db.ownerUrl,
      catalog: catalogWithPlugin('core-schema', ['core']),
    });

    await expect(run).rejects.toMatchObject({
      name: 'MigrationError',
      exitCode: 1,
      problems: [
        'core-schema/20260112080000_sneaky.sql failed as nm_mod_core_schema and was rolled back: permission denied for schema core',
      ],
    });
    expect(
      await query(db.ownerUrl, "select tablename from pg_tables where schemaname = 'core'"),
    ).toEqual([{ tablename: 'article' }]);
    expect(await recordsOf('core-schema')).toEqual([]);
    expect(await schemaAndRoleOf('core_schema')).toEqual({ schemas: [], roles: [] });
  });

  it('E02-S02 a plugin CREATE TABLE AS SELECT from planning.production_order is refused', async () => {
    const run = migrate({
      ownerUrl: db.ownerUrl,
      catalog: catalogWithPlugin('reads-planning', ['planning']),
    });

    await expect(run).rejects.toMatchObject({
      name: 'MigrationError',
      exitCode: 1,
      problems: [
        'reads-planning/20260113080000_production_order_copy.sql failed as nm_mod_reads_planning and was rolled back: permission denied for table production_order',
      ],
    });
    expect(await recordsOf('reads-planning')).toEqual([]);
    // migrate creates the plugin's schema in the transaction of its first file, so no schema is
    // left to hold a copy.
    expect(await schemaAndRoleOf('reads_planning')).toEqual({ schemas: [], roles: [] });
  });
});

describe('pnpm northmes migrate', () => {
  const db = useTestDatabase({ template: emptyTemplateDatabase });
  // The environment of migrate: DATABASE_URL without a login and the owner's password in a secret
  // file.
  const env = useMigrateEnv({ database: db });

  // ConfigModule writes the validated environment into process.env, as it does in the server. The
  // stubs remove these keys for each test, and unstubAllEnvs takes them out again afterwards.
  beforeEach(() => {
    for (const key of migrateEnvKeys) vi.stubEnv(key, undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('E02-S02 pnpm northmes migrate boots the catalog without listening and migrates it as nm_owner', async () => {
    const log = { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
    const exit = vi.fn<(code: number) => void>();

    await cli(['migrate'], { env, exit, log });
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
    // Each file of the in-repo modules is logged as pending by the boot's migration check, and
    // again as migrate applies it, and nothing listens.
    expect(log.info.mock.calls).toEqual([
      ['Modules in boot order: core, planning'],
      ...records.map(({ module, name }) => [`Pending ${module}/${name}`]),
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
      env,
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

  it('E02-S02 pnpm northmes migrate exits 1 naming an applied file whose sha256 changed', async () => {
    const log = { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
    const exit = vi.fn<(code: number) => void>();
    // The first run applies the in-repo files, or finds them applied.
    await cli(['migrate'], { env, exit, log });
    // A record whose sha256 no longer matches its file stands for a file edited after it applied.
    const [file] = await query<{ module: string; name: string }>(
      db.ownerUrl,
      `update northmes_meta.migration
          set sha256 = repeat('0', 64)
        where (module, name) = (select module, name from northmes_meta.migration
                                 order by module, name limit 1)
       returning module, name`,
    );
    log.info.mockClear();

    await cli(['migrate'], { env, exit, log });

    expect(exit.mock.calls).toEqual([[1]]);
    expect(log.error.mock.calls).toEqual([
      [
        `refused to migrate (1 problem)\n- ${file?.module}/${file?.name} changed after it was applied; put the change in a new migration file`,
      ],
    ]);
    expect(log.info.mock.calls).toEqual([['Modules in boot order: core, planning']]);
  });
});
