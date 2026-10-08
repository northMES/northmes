// SPDX-License-Identifier: AGPL-3.0-or-later
import { fileURLToPath } from 'node:url';
import { query, useTestDatabase } from '@northmes/testing';
import { describe, expect, it } from 'vitest';
import { checkCatalog } from '../src/catalog/check-catalog.ts';
import { migrate } from '../src/migrate/runner.ts';
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

describe('migrate', () => {
  const db = useTestDatabase();

  it("E02-S02 core then planning apply in catalog order, each file under SET LOCAL ROLE of its module's owner role", async () => {
    const { applied } = await migrate({ ownerUrl: db.ownerUrl, catalog });
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

    expect(applied).toEqual(fixtureFiles.map(({ module, name }) => `${module}/${name}`));
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
});
