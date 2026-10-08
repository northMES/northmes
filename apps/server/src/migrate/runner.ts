// SPDX-License-Identifier: AGPL-3.0-or-later
import { type ModuleNames, moduleNames } from '@northmes/sdk';
import { Client } from 'pg';
import type { CatalogEntry } from '../catalog/check-catalog.ts';
import { type MigrationFile, readMigrationFiles } from './files.ts';

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
 * How long a run waits for the migration lock that another run holds before it gives up. The
 * timeout covers the lock only, not the statements of the files.
 */
const lockTimeout = '1min';

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
  try {
    await takeMigrationLock(client);
    await createMigrationTable(client);
    const applied: string[] = [];
    for (const { manifest, migrationsDir } of catalog) {
      const names = moduleNames(manifest.id);
      await createOwnerRoleAndSchema(client, names);
      for (const file of await pendingFiles(client, names, migrationsDir)) {
        await applyFile(client, names, file);
        applied.push(`${names.id}/${file.name}`);
      }
    }
    return { applied };
  } finally {
    await client.end();
  }
}

/**
 * Takes the migration advisory lock of the database. A session lock outlives the transaction that
 * takes it and ends with the connection, so a second run waits until this one is done and then
 * finds every file applied.
 */
async function takeMigrationLock(client: Client): Promise<void> {
  await client.query(
    `begin;
     set local lock_timeout = '${lockTimeout}';
     select pg_advisory_lock(hashtextextended('northmes.migrate', 0));
     commit`,
  );
}

/** Creates northmes_meta.migration, which nm_owner owns, unless it exists. */
async function createMigrationTable(client: Client): Promise<void> {
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
}

/**
 * Creates the module's NOLOGIN owner role and its schema unless they exist, and lets nm_app and
 * nm_ext use the schema. Roles belong to the server, so the role may come from a run on another database; the
 * grants are given again either way.
 */
async function createOwnerRoleAndSchema(client: Client, names: ModuleNames): Promise<void> {
  const role = client.escapeIdentifier(names.ownerRole);
  const schema = client.escapeIdentifier(names.sql);
  const existing = await client.query('select 1 from pg_roles where rolname = $1', [
    names.ownerRole,
  ]);
  if (existing.rowCount === 0) await client.query(`create role ${role} nologin`);
  // A CREATEROLE creator gets ADMIN on the role it creates, but neither SET nor INHERIT. SET lets
  // nm_owner give the role a schema and run files as it; nm_owner keeps none of its rights.
  await client.query(`grant ${role} to current_user with set true, inherit false`);
  // The module role uses the REFERENCES grants that other modules give nm_ext (ADR 0006).
  await client.query(`grant nm_ext to ${role} with inherit true, set false`);
  await client.query(`create schema if not exists ${schema} authorization ${role}`);
  // Only the schema's owner may grant on it, since nm_owner inherits none of its rights. The
  // module's migration files grant nm_app its rights on each table.
  await client.query('begin');
  await client.query(`set local role ${role}`);
  await client.query(`grant usage on schema ${schema} to nm_app`);
  // A foreign key into the schema also needs USAGE on it. The table's own REFERENCES grant still
  // decides whether a key may point at it (ADR 0006).
  await client.query(`grant usage on schema ${schema} to nm_ext`);
  await client.query('commit');
}

/** The module's files that northmes_meta.migration has no record of, in lexical order. */
async function pendingFiles(
  client: Client,
  names: ModuleNames,
  migrationsDir: string | undefined,
): Promise<MigrationFile[]> {
  const recorded = await client.query<{ name: string }>(
    'select name from northmes_meta.migration where module = $1',
    [names.id],
  );
  const applied = new Set(recorded.rows.map((row) => row.name));
  return readMigrationFiles(migrationsDir).filter((file) => !applied.has(file.name));
}

/**
 * Applies one file and records it in one transaction. The record is written as nm_owner, and the
 * file runs under SET LOCAL ROLE of the module's owner role. A file that fails leaves its
 * transaction open, and closing the connection rolls it back with its record.
 */
async function applyFile(client: Client, names: ModuleNames, file: MigrationFile): Promise<void> {
  await client.query('begin');
  await client.query(
    'insert into northmes_meta.migration (module, name, sha256) values ($1, $2, $3)',
    [names.id, file.name, file.sha256],
  );
  await client.query(`set local role ${client.escapeIdentifier(names.ownerRole)}`);
  await client.query(file.sql);
  await client.query('commit');
}
