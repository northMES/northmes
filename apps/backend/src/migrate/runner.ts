// SPDX-License-Identifier: AGPL-3.0-or-later
import { type ModuleNames, moduleNames } from '@northmes/sdk';
import { Client } from 'pg';
import type { CatalogEntry } from '../catalog/check-catalog.ts';
import { fileProblems, type MigrationFile, readMigrationFiles } from './files.ts';
import { MigrationError } from './migration-error.ts';

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
 * A catalog module's migration files, and the sha256 that northmes_meta.migration holds for each
 * file it applied.
 */
interface ModuleFiles {
  readonly names: ModuleNames;
  /** The further schemas its owner role owns, which CatalogEntry.schemas names. */
  readonly schemas: readonly string[];
  readonly files: readonly MigrationFile[];
  /** The recorded sha256 by file name. */
  readonly recorded: ReadonlyMap<string, string>;
}

/**
 * Applies the migration files of every catalog module in catalog order (ADR 0006). Each module's
 * schema is owned by the NOLOGIN role nm_mod_<sql name>, which nm_owner creates and may SET to,
 * and each file runs in a transaction of its own under SET LOCAL ROLE of that role. Applied files
 * are recorded in northmes_meta.migration. A run holds the migration advisory lock of the
 * database throughout, so concurrent runs apply each file once.
 *
 * The run checks the files of every module before it applies any, and throws a MigrationError
 * that lists every problem when an applied file's sha256 changed, two files of a module share a
 * timestamp prefix or a file lacks its expand or contract marker.
 */
export async function migrate({ ownerUrl, catalog }: MigrateOptions): Promise<MigrateResult> {
  const client = new Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    await takeMigrationLock(client);
    await createMigrationTable(client);
    const modules = await readModuleFiles(client, catalog);
    const problems = modules.flatMap((module) => [
      ...changedFiles(module),
      ...fileProblems(module.names.id, module.files),
    ]);
    if (problems.length > 0) throw new MigrationError(problems);
    const applied: string[] = [];
    for (const { names, schemas, files, recorded } of modules) {
      const pending = files.filter((file) => !recorded.has(file.name));
      for (const [index, file] of pending.entries()) {
        await applyFile(client, names, file, { createOwner: index === 0, schemas });
        applied.push(`${names.id}/${file.name}`);
      }
    }
    await syncPermissionCatalog(client, catalog);
    return { applied };
  } finally {
    await client.end();
  }
}

/** Reads every catalog module's files and the records northmes_meta.migration holds for them. */
async function readModuleFiles(
  client: Client,
  catalog: readonly CatalogEntry[],
): Promise<ModuleFiles[]> {
  const { rows } = await client.query<{ module: string; name: string; sha256: string }>(
    'select module, name, sha256 from northmes_meta.migration',
  );
  return catalog.map(({ manifest, migrationsDir, schemas = [] }) => {
    const names = moduleNames(manifest.id);
    const recorded = new Map(
      rows.filter((row) => row.module === names.id).map((row) => [row.name, row.sha256]),
    );
    return { names, schemas, files: readMigrationFiles(migrationsDir), recorded };
  });
}

/** A problem for each applied file whose sha256 differs from the one recorded when it applied. */
function changedFiles({ names, files, recorded }: ModuleFiles): string[] {
  return files
    .filter((file) => recorded.has(file.name) && recorded.get(file.name) !== file.sha256)
    .map(
      (file) =>
        `${names.id}/${file.name} changed after it was applied; put the change in a new migration file`,
    );
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

/** Creates northmes_meta.migration, which nm_owner owns, unless it exists, and lets nm_app read it. */
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
  // Boot step 5 reads the records as nm_app (ADR 0002).
  await client.query('grant usage on schema northmes_meta to nm_app');
  await client.query('grant select on northmes_meta.migration to nm_app');
}

/**
 * Creates the module's NOLOGIN owner role and its schema unless they exist, and lets nm_app and
 * nm_ext use the schema. The further schemas that `schemas` names are created owned by the same
 * role. It runs in the transaction of the module's first pending file, and
 * leaves that transaction under SET LOCAL ROLE of the owner role. Roles belong to the server, so
 * the role may come from a run on another database; the grants are given again either way.
 */
async function createOwnerRoleAndSchema(
  client: Client,
  names: ModuleNames,
  schemas: readonly string[],
): Promise<void> {
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
  // A further schema gets no grant here: its module's migration files decide who may use it, as
  // core's do for auth, which nm_app may not use (ADR 0010).
  for (const further of schemas) {
    await client.query(
      `create schema if not exists ${client.escapeIdentifier(further)} authorization ${role}`,
    );
  }
  // Only the schema's owner may grant on it, since nm_owner inherits none of its rights. The
  // module's migration files grant nm_app its rights on each table.
  await client.query(`set local role ${role}`);
  await client.query(`grant usage on schema ${schema} to nm_app`);
  // A foreign key into the schema also needs USAGE on it. The table's own REFERENCES grant still
  // decides whether a key may point at it (ADR 0006).
  await client.query(`grant usage on schema ${schema} to nm_ext`);
}

/**
 * Applies one file and records it in one transaction. The record is written as nm_owner, and the
 * file runs under SET LOCAL ROLE of the module's owner role. With createOwner, which the module's
 * first pending file sets, the same transaction first creates the owner role and the schema, so a
 * refused first file leaves neither behind. A file that fails leaves its transaction open, and
 * closing the connection rolls it back with its record. The failure is a MigrationError that names
 * the module, the file and the owner role it ran as, because Postgres refuses a statement on
 * another module's schema with the role's rights.
 */
async function applyFile(
  client: Client,
  names: ModuleNames,
  file: MigrationFile,
  { createOwner, schemas }: { readonly createOwner: boolean; readonly schemas: readonly string[] },
): Promise<void> {
  try {
    await client.query('begin');
    await client.query(
      'insert into northmes_meta.migration (module, name, sha256) values ($1, $2, $3)',
      [names.id, file.name, file.sha256],
    );
    if (createOwner) await createOwnerRoleAndSchema(client, names, schemas);
    await client.query(`set local role ${client.escapeIdentifier(names.ownerRole)}`);
    await client.query(file.sql);
    await client.query('commit');
  } catch (error) {
    throw new MigrationError([
      `${names.id}/${file.name} failed as ${names.ownerRole} and was rolled back: ${(error as Error).message}`,
    ]);
  }
}

/** Every permission key of the catalog's manifests, as `<resource>:<action>`, with its module. */
function permissionKeys(catalog: readonly CatalogEntry[]): { key: string; module: string }[] {
  return catalog.flatMap(({ manifest }) =>
    Object.entries(manifest.permissions ?? {}).flatMap(([resource, actions]) =>
      actions.map((action) => ({ key: `${resource}:${action}`, module: manifest.id })),
    ),
  );
}

/**
 * Writes the permission catalog, core.permission, from the permissions that the catalog's modules
 * declare (ADR 0010): each declared key is installed, and a key that no installed module declares
 * any more stays with installed false, so a role that holds it keeps it. It runs in one transaction
 * as core's owner role, and does nothing on a database without core.permission, such as one that
 * only fixture modules migrate.
 */
async function syncPermissionCatalog(
  client: Client,
  catalog: readonly CatalogEntry[],
): Promise<void> {
  const { rows } = await client.query<{ exists: boolean }>(
    // nm_owner has no USAGE on core, so the table is looked up in the catalog, not by to_regclass.
    `select exists (
       select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'core' and c.relname = 'permission'
     ) as exists`,
  );
  if (!rows[0]?.exists) return;
  const keys = permissionKeys(catalog);
  await client.query('begin');
  try {
    await client.query(`set local role ${client.escapeIdentifier(moduleNames('core').ownerRole)}`);
    await client.query(
      `insert into core.permission (key, module_id, installed)
       select key, module_id, true from unnest($1::text[], $2::text[]) as p (key, module_id)
       on conflict (key) do update set module_id = excluded.module_id, installed = true`,
      [keys.map(({ key }) => key), keys.map(({ module }) => module)],
    );
    await client.query('update core.permission set installed = false where key <> all ($1::text[])', [
      keys.map(({ key }) => key),
    ]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw new MigrationError([
      `The permission catalog could not be written as ${moduleNames('core').ownerRole}: ${(error as Error).message}`,
    ]);
  }
}
