// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { query } from '@northmes/testing';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { checkCatalog } from '../../src/catalog/check-catalog.ts';
import { imageVersion, inRepoModule } from '../fixtures/catalog.ts';
import { migrateTemplate } from '../global-setup.ts';

/** Logs in to database as role with password, on the container of the run. */
function urlFor(role: string, password: string, database: string): string {
  const { host, port } = inject('pg');
  const credentials = `${encodeURIComponent(role)}:${encodeURIComponent(password)}`;
  return `postgres://${credentials}@${host}:${port}/${encodeURIComponent(database)}`;
}

const templateName = /^nm_template_[0-9a-f]{16}$/;

describe('the template of a test run', () => {
  const superuser = inject('pg');
  const created: string[] = [];
  let migrationsDir: string | undefined;

  afterAll(async () => {
    if (migrationsDir) rmSync(migrationsDir, { recursive: true, force: true });
    const admin = urlFor(superuser.user, superuser.password, superuser.database);
    for (const name of created) {
      // Postgres refuses to drop a database flagged as a template.
      await query(admin, `alter database "${name}" is_template false`);
      await query(admin, `drop database "${name}"`);
    }
  });

  it('E02-S02 the template name changes with the migration files and an unchanged run reuses it', async () => {
    migrationsDir = mkdtempSync(join(tmpdir(), 'northmes-template-hash-'));
    const file = join(migrationsDir, '20261008120000_note.sql');
    // The owner role of a module belongs to the server, which the other test files share, so this
    // file migrates a module of its own.
    const catalog = checkCatalog([{ ...inRepoModule('template-hash'), migrationsDir }], {
      imageVersion,
    });
    const options = {
      superuser,
      ownerPassword: inject('pgRolePasswords').owner,
      catalog,
    };

    writeFileSync(file, '-- migration: expand\ncreate table template_hash.note (id integer);\n');
    const first = await migrateTemplate(options);
    created.push(first.name);
    const unchanged = await migrateTemplate(options);
    writeFileSync(
      file,
      '-- migration: expand\ncreate table template_hash.note (id integer, body text);\n',
    );
    const changed = await migrateTemplate(options);
    created.push(changed.name);
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
