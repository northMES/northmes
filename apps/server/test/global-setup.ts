// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash, randomBytes } from 'node:crypto';
import { emptyTemplateDatabase, type PgConnection } from '@northmes/testing';
import { Client } from 'pg';
import type { TestProject } from 'vitest/node';
import { inRepoCatalog } from '../src/boot/boot.ts';
import type { CatalogEntry } from '../src/catalog/check-catalog.ts';
import { bootstrapRoles } from '../src/db/bootstrap.ts';
import { readMigrationFiles } from '../src/migrate/files.ts';
import { migrate } from '../src/migrate/runner.ts';

/** Logs in to a database of the container as a role. */
function urlFor(
  { host, port }: PgConnection,
  user: string,
  password: string,
  database: string,
): string {
  const credentials = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  return `postgres://${credentials}@${host}:${port}/${encodeURIComponent(database)}`;
}

/** Logs in to the empty template as the container's superuser. */
function emptyTemplateUrl(pg: PgConnection): string {
  return urlFor(pg, pg.user, pg.password, emptyTemplateDatabase);
}

export interface TemplateOptions {
  /** The container's superuser, who clones the empty template into the new one. */
  readonly superuser: PgConnection;
  /** The password of nm_owner, as which migrate runs. */
  readonly ownerPassword: string;
  /** The checked catalog whose migration files the template holds. */
  readonly catalog: readonly CatalogEntry[];
}

export interface MigratedTemplate {
  /** nm_template_ and the start of a sha256 over the catalog's migration files. */
  readonly name: string;
  /** True when a template of that name was in place, so nothing was migrated. */
  readonly reused: boolean;
}

/** The name of the template that holds the catalog's migration files as they are now. */
function templateName(catalog: readonly CatalogEntry[]): string {
  const hash = createHash('sha256');
  for (const { manifest, migrationsDir } of catalog) {
    for (const file of readMigrationFiles(migrationsDir)) {
      hash.update(`${manifest.id}/${file.name} ${file.sha256}\n`);
    }
  }
  return `nm_template_${hash.digest('hex').slice(0, 16)}`;
}

/**
 * Migrates the catalog into a template database named after a hash of its migration files, unless
 * that template is in place (ADR 0041). The template is built under a name of its own and renamed
 * once migrate is done, so a template of the final name always holds every file. migrate closes
 * its connection, because Postgres refuses to clone or rename a database in use.
 */
export async function migrateTemplate({
  superuser,
  ownerPassword,
  catalog,
}: TemplateOptions): Promise<MigratedTemplate> {
  const name = templateName(catalog);
  const client = new Client(superuser);
  await client.connect();
  try {
    const existing = await client.query('select 1 from pg_database where datname = $1', [name]);
    if (existing.rowCount !== 0) return { name, reused: true };
    const building = `${name}_${randomBytes(4).toString('hex')}`;
    const buildingId = client.escapeIdentifier(building);
    const nameId = client.escapeIdentifier(name);
    await client.query(
      `create database ${buildingId} template ${client.escapeIdentifier(emptyTemplateDatabase)}`,
    );
    // A clone does not copy the database privileges of its template (ADR 0006).
    await client.query(`grant create on database ${buildingId} to nm_owner`);
    await migrate({ ownerUrl: urlFor(superuser, 'nm_owner', ownerPassword, building), catalog });
    await client.query(`alter database ${buildingId} rename to ${nameId}`);
    await client.query(`alter database ${nameId} is_template true`);
    return { name, reused: false };
  } finally {
    await client.end();
  }
}

/**
 * The server's global setup in the integration project. It runs after the harness setup of
 * @northmes/testing has started Postgres and created the empty template. It bootstraps the database
 * roles as the container's superuser with passwords of this run, migrates the in-repo modules into
 * the template that useTestDatabase clones, and gives the tests its name and the passwords of
 * nm_app and nm_owner, the roles that useTestDatabase hands out (ADR 0041).
 */
export default async function setup(project: TestProject): Promise<void> {
  const { pg } = project.getProvidedContext();
  const passwords = {
    owner: randomBytes(32).toString('hex'),
    app: randomBytes(32).toString('hex'),
    auth: randomBytes(32).toString('hex'),
  };
  await bootstrapRoles(emptyTemplateUrl(pg), passwords);
  const catalog = await inRepoCatalog((specifier) => import(specifier));
  const { name } = await migrateTemplate({
    superuser: pg,
    ownerPassword: passwords.owner,
    catalog,
  });
  project.provide('pgTemplate', name);
  project.provide('pgRolePasswords', { owner: passwords.owner, app: passwords.app });
}
