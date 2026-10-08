// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  emptyTemplateDatabase,
  type PostgresServer,
  query,
  startPostgres,
  useTestDatabase,
} from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkCatalog } from '../../src/catalog/check-catalog.ts';
import { bootstrapRoles } from '../../src/db/bootstrap.ts';
import { imageVersion, inRepoModule } from '../fixtures/catalog.ts';
import { migrateTemplate } from '../global-setup.ts';

const templateName = /^nm_template_[0-9a-f]{16}$/;

// migrateTemplate clones and renames databases as the superuser, which tests never log in as on
// the run's server (ADR 0041). This test runs it on a server of its own, which it bootstraps and
// gives an empty template, as the global setups do on the run's server.
describe('the template of a test run', () => {
  const passwords = {
    owner: randomBytes(16).toString('hex'),
    app: randomBytes(16).toString('hex'),
    auth: randomBytes(16).toString('hex'),
  };
  let server: PostgresServer;
  let migrationsDir: string | undefined;

  /** Logs in to database as role with password, on this test's server. */
  function urlFor(role: string, password: string, database: string): string {
    const { host, port } = server.connection;
    const credentials = `${encodeURIComponent(role)}:${encodeURIComponent(password)}`;
    return `postgres://${credentials}@${host}:${port}/${encodeURIComponent(database)}`;
  }

  beforeAll(async () => {
    server = await startPostgres();
    const { user, password, database } = server.connection;
    const superuserUrl = urlFor(user, password, database);
    await bootstrapRoles(superuserUrl, passwords);
    await query(superuserUrl, `create database ${emptyTemplateDatabase}`);
  }, 120_000);

  afterAll(async () => {
    if (migrationsDir) rmSync(migrationsDir, { recursive: true, force: true });
    await server?.stop();
  });

  it('E02-S02 the template name changes with the migration files and an unchanged run reuses it', async () => {
    migrationsDir = mkdtempSync(join(tmpdir(), 'northmes-template-hash-'));
    const file = join(migrationsDir, '20261008120000_note.sql');
    const catalog = checkCatalog([{ ...inRepoModule('template-hash'), migrationsDir }], {
      imageVersion,
    });
    const options = {
      superuser: server.connection,
      ownerPassword: passwords.owner,
      catalog,
    };

    writeFileSync(file, '-- migration: expand\ncreate table template_hash.note (id integer);\n');
    const first = await migrateTemplate(options);
    const unchanged = await migrateTemplate(options);
    writeFileSync(
      file,
      '-- migration: expand\ncreate table template_hash.note (id integer, body text);\n',
    );
    const changed = await migrateTemplate(options);
    // nm_owner holds no right on the module's table, so the columns are read from the catalog,
    // which information_schema would filter by privilege.
    const columns = await query(
      urlFor('nm_owner', options.ownerPassword, changed.name),
      `select a.attname as column_name
         from pg_attribute a
         join pg_class c on c.oid = a.attrelid
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'template_hash' and c.relname = 'note'
          and a.attnum > 0 and not a.attisdropped
        order by a.attnum`,
    );

    expect(first).toEqual({ name: expect.stringMatching(templateName), reused: false });
    expect(unchanged).toEqual({ name: first.name, reused: true });
    expect(changed).toEqual({ name: expect.stringMatching(templateName), reused: false });
    expect(changed.name).not.toBe(first.name);
    // The template that the new name points at holds the changed file.
    expect(columns).toEqual([{ column_name: 'id' }, { column_name: 'body' }]);
  });
});

describe('a test database', () => {
  const db = useTestDatabase();

  it('E02-S02 a test database is cloned from the template that holds the in-repo modules', async () => {
    const schemas = await query(
      db.appUrl,
      `select n.nspname as schema, r.rolname as owner
         from pg_namespace n
         join pg_roles r on r.oid = n.nspowner
        where n.nspname in ('core', 'planning', 'northmes_meta')
        order by n.nspname`,
    );

    expect(schemas).toEqual([
      { schema: 'core', owner: 'nm_mod_core' },
      { schema: 'northmes_meta', owner: 'nm_owner' },
      { schema: 'planning', owner: 'nm_mod_planning' },
    ]);
  });
});
