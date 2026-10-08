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

export interface MigrateResult {
  /** The files this run applied, as <module id>/<file name>, in the order it applied them. */
  readonly applied: readonly string[];
}

/**
 * Applies the migration files of every catalog module in catalog order (ADR 0006). Each module's
 * schema is owned by the NOLOGIN role nm_mod_<sql name>, which nm_owner creates and may SET to,
 * and each file runs in a transaction of its own under SET LOCAL ROLE of that role. Applied files
 * are recorded in northmes_meta.migration.
 */
export async function migrate({ ownerUrl, catalog }: MigrateOptions): Promise<MigrateResult> {
  const client = new Client({ connectionString: ownerUrl });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query('create schema northmes_meta');
    await client.query(
      `create table northmes_meta.migration (
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
      await client.query(`create role ${role} nologin`);
      // A CREATEROLE creator gets ADMIN on the role it creates, but neither SET nor INHERIT.
      // SET lets nm_owner give the role a schema and run files as it; nm_owner keeps none of
      // its rights.
      await client.query(`grant ${role} to current_user with set true, inherit false`);
      await client.query(`create schema ${client.escapeIdentifier(sql)} authorization ${role}`);
      for (const file of readMigrationFiles(migrationsDir)) {
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
