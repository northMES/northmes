// SPDX-License-Identifier: AGPL-3.0-or-later
import { moduleNames } from '@northmes/sdk';
import { Client } from 'pg';
import type { CatalogEntry } from '../catalog/check-catalog.ts';
import { readMigrationFiles } from './files.ts';

export interface MigrateOptions {
  /** Logs in as nm_owner, on a direct connection rather than through a pooler. */
  readonly ownerUrl: string;
  /** The checked catalog in boot order, core first. */
  readonly catalog: readonly CatalogEntry[];
}

/**
 * How long a run waits for the migration lock that another run holds before it gives up. The
 * timeout covers the lock only, not the statements of the files.
 */
const lockTimeout = '1min';

export interface MigrateResult {
  /** The files this run applied, as <module id>/<file name>, in the order it applied them. */
  readonly applied: readonly string[];
}

/**
 * Applies the migration files of every catalog module in catalog order (ADR 0006). Each module's
 * schema is owned by the NOLOGIN role nm_mod_<sql name>, which nm_owner creates and may SET to,
 * and each file runs in a transaction of its own under SET LOCAL ROLE of that role. Applied files
 * are recorded in northmes_meta.migration. A run holds the migration advisory lock of the
 * database throughout, so concurrent runs apply each file once.
 */
export async function migrate({ ownerUrl, catalog }: MigrateOptions): Promise<MigrateResult> {
  const client = new Client({ connectionString: ownerUrl });
  await client.connect();
  const applied: string[] = [];
  try {
    // A session lock outlives the transaction that takes it and ends with the connection, so a
    // second run waits until this one is done and then finds every file applied.
    await client.query(
      `begin;
       set local lock_timeout = '${lockTimeout}';
       select pg_advisory_lock(hashtextextended('northmes.migrate', 0));
       commit`,
    );
    await client.query('create schema if not exists northmes_meta');
    await client.query(
      `create table if not exists northmes_meta.migration (
         module text not null,
         name text not null,
         sha256 text not null,
         applied_at timestamptz not null default now(),
         primary key (module, name)
       )`,
    );
    for (const { manifest, migrationsDir } of catalog) {
      const { sql, ownerRole } = moduleNames(manifest.id);
      const role = client.escapeIdentifier(ownerRole);
      const existing = await client.query('select 1 from pg_roles where rolname = $1', [ownerRole]);
      if (existing.rowCount === 0) await client.query(`create role ${role} nologin`);
      // A CREATEROLE creator gets ADMIN on the role it creates, but neither SET nor INHERIT.
      // SET lets nm_owner give the role a schema and run files as it; nm_owner keeps none of
      // its rights.
      await client.query(`grant ${role} to current_user with set true, inherit false`);
      // The module role uses the REFERENCES grants that other modules give nm_ext (ADR 0006).
      await client.query(`grant nm_ext to ${role} with inherit true, set false`);
      await client.query(
        `create schema if not exists ${client.escapeIdentifier(sql)} authorization ${role}`,
      );
      const recorded = await client.query<{ name: string }>(
        'select name from northmes_meta.migration where module = $1',
        [manifest.id],
      );
      const done = new Set(recorded.rows.map((row) => row.name));
      for (const file of readMigrationFiles(migrationsDir)) {
        if (done.has(file.name)) continue;
        // A file that fails leaves its transaction open, and closing the connection rolls it
        // back with its record.
        await client.query('begin');
        await client.query(
          'insert into northmes_meta.migration (module, name, sha256) values ($1, $2, $3)',
          [manifest.id, file.name, file.sha256],
        );
        await client.query(`set local role ${role}`);
        await client.query(file.sql);
        await client.query('commit');
        applied.push(`${manifest.id}/${file.name}`);
      }
    }
  } finally {
    await client.end();
  }
  return { applied };
}
