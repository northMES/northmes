// SPDX-License-Identifier: AGPL-3.0-or-later
import { getMigrations } from 'better-auth/db/migration';
import {
  type DatabaseIntrospector,
  type Dialect,
  DummyDriver,
  type Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { AUTH_SCHEMA, authOptions } from './auth-options.ts';

/**
 * A Postgres dialect that sends nothing: every statement returns no rows, so Better Auth's
 * introspection finds an empty database and plans every table.
 */
export const emptyPostgres: Dialect = {
  createAdapter: () => new PostgresAdapter(),
  createDriver: () => new DummyDriver(),
  createIntrospector: (db: Kysely<unknown>): DatabaseIntrospector => new PostgresIntrospector(db),
  createQueryCompiler: () => new PostgresQueryCompiler(),
};

/**
 * The grants that follow Better Auth's tables: Better Auth's own pool logs in as nm_auth and reads
 * and writes every table of the schema. nm_app gets nothing (ADR 0010).
 */
const grants = `grant usage on schema ${AUTH_SCHEMA} to nm_auth;
grant select, insert, update, delete on all tables in schema ${AUTH_SCHEMA} to nm_auth;
`;

/**
 * The SQL of Better Auth's whole schema for the options NorthMES runs with, compiled without a
 * database, followed by nm_auth's grants. migrate creates the auth schema owned by core's owner
 * role, so the statement that would create it is left out.
 */
export async function authMigrationSql(): Promise<string> {
  const options = authOptions({
    dialect: emptyPostgres,
    baseURL: 'http://127.0.0.1:1',
    // The schema does not depend on the secret.
    secret: 'northmes-auth-migration-compile-only',
    webOrigins: [],
  });
  const { compileMigrations } = await getMigrations(options);
  const statements = (await compileMigrations())
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '' && !/^create schema /i.test(statement));
  return `${statements.map((statement) => `${statement};`).join('\n\n')}\n\n${grants}`;
}
