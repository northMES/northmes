// SPDX-License-Identifier: MIT
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, inject } from 'vitest';
import { withClient } from './client.ts';
import { type CommandContext, type CommandTransaction, runCommand } from './db-command.ts';

/** Where the container started by the global setup listens, as the superuser. */
export interface PgConnection {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * The passwords of the login roles that the server's global setup bootstraps into the container
 * (ADR 0006), for the roles a test database hands out.
 */
export interface RolePasswords {
  owner: string;
  app: string;
}

/**
 * What the global setup reads once from the server as its superuser, for the harness checks of the
 * server itself. Tests never log in as the superuser, and nm_app sees neither the server's own time
 * zone, which its role setting replaces, nor the data directory.
 */
export interface PgServerFacts {
  /** The server's TimeZone setting. */
  timeZone: string;
  dataDirectory: string;
  /** The text of the container's /proc/mounts. */
  mounts: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    pg: PgConnection;
    pgServer: PgServerFacts;
    /** The image the container started from, as read from infra/pg-image.json. */
    pgImage: string;
    pgRolePasswords: RolePasswords;
    /** The template that the server's global setup migrated, which useTestDatabase clones. */
    pgTemplate: string;
  }
}

/**
 * A database of one test file. Tests never connect as the superuser, which bypasses row-level
 * security (ADR 0041).
 */
export interface TestDatabase {
  /** Logs in as nm_app, the runtime role with DML rights only. */
  appUrl: string;
  /** Logs in as nm_owner, the migration role, for tests at the database seam. */
  ownerUrl: string;
  databaseName: string;
  /**
   * Writes fixtures: runs fn in one transaction as nm_app with the context's scopes as both scope
   * sets, and commits it (ADR 0041).
   */
  command<Result>(
    context: CommandContext,
    fn: (tx: CommandTransaction) => Promise<Result>,
  ): Promise<Result>;
}

/**
 * The empty template that the harness's global setup creates. The server's global setup clones it
 * into the template that holds the migrated modules, which useTestDatabase clones.
 */
export const emptyTemplateDatabase = 'nm_template';

function connectionStringFor(pg: PgConnection, databaseName: string): string {
  const credentials = `${encodeURIComponent(pg.user)}:${encodeURIComponent(pg.password)}`;
  return `postgres://${credentials}@${pg.host}:${pg.port}/${encodeURIComponent(databaseName)}`;
}

export interface TestDatabaseOptions {
  /**
   * The template to clone. It defaults to the template that the server's global setup migrated. A
   * test of migrate itself clones emptyTemplateDatabase, so the database holds only what that test
   * applies.
   */
  readonly template?: string;
}

/**
 * Gives the calling test file a database of its own on the container that the global setup
 * started. The database exists from `beforeAll` to `afterAll`.
 */
export function useTestDatabase(options: TestDatabaseOptions = {}): TestDatabase {
  const pg: PgConnection | undefined = inject('pg');
  const passwords: RolePasswords | undefined = inject('pgRolePasswords');
  const template: string | undefined = options.template ?? inject('pgTemplate');
  if (!pg || !passwords || !template) {
    throw new Error(
      'useTestDatabase() needs the global setups of @northmes/testing and apps/backend, which only the integration project runs. Name the file *.int.test.ts.',
    );
  }
  // biome-ignore lint/style/noProcessEnv: Vitest sets VITEST_POOL_ID for each worker; it names no configuration.
  const databaseName = `t_${process.env.VITEST_POOL_ID ?? 0}_${randomBytes(6).toString('hex')}`;

  beforeAll(async () => {
    await withClient(pg, async (client) => {
      const name = client.escapeIdentifier(databaseName);
      await client.query(`create database ${name} template ${client.escapeIdentifier(template)}`);
      // A clone does not copy the database privileges of its template, so the CREATE that
      // bootstrap grants nm_owner on the template is granted again (ADR 0006).
      await client.query(`grant create on database ${name} to nm_owner`);
    });
  });

  afterAll(async () => {
    await withClient(pg, async (client) => {
      const name = client.escapeIdentifier(databaseName);
      await client.query(`drop database if exists ${name} with (force)`);
    });
  });

  const appUrl = connectionStringFor(
    { ...pg, user: 'nm_app', password: passwords.app },
    databaseName,
  );
  return {
    appUrl,
    ownerUrl: connectionStringFor(
      { ...pg, user: 'nm_owner', password: passwords.owner },
      databaseName,
    ),
    databaseName,
    command: (context, fn) => runCommand(appUrl, context, fn),
  };
}
