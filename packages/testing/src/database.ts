// SPDX-License-Identifier: MIT
import { randomBytes } from 'node:crypto';
import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, inject } from 'vitest';
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

declare module 'vitest' {
  export interface ProvidedContext {
    pg: PgConnection;
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

/**
 * Runs `run` on a client connected with `config` and closes the client afterwards. This is the one
 * place that builds a pg client. The error listener keeps a connection that the server terminates
 * from surfacing as an unhandled error in the worker. It records the error, and when `run` fails
 * afterwards, the recorded error is thrown, because pg only reports that the client is not queryable.
 */
export async function withClient<Result = void>(
  config: ClientConfig,
  run: (client: Client) => Promise<Result>,
): Promise<Result> {
  const client = new Client(config);
  let connectionError: Error | undefined;
  client.on('error', (error) => {
    connectionError ??= error;
  });
  await client.connect();
  try {
    return await run(client);
  } catch (error) {
    throw connectionError ?? error;
  } finally {
    await client.end();
  }
}

/** Runs one statement on the database that `connectionString` points at and returns its rows. */
export function query<Row = Record<string, unknown>>(
  connectionString: string,
  sql: string,
): Promise<Row[]> {
  return withClient(
    { connectionString },
    async (client) => (await client.query(sql)).rows as Row[],
  );
}

/**
 * Gives the calling test file a database of its own on the container that the global setup
 * started. The database exists from `beforeAll` to `afterAll`.
 */
export function useTestDatabase(): TestDatabase {
  const pg: PgConnection | undefined = inject('pg');
  const passwords: RolePasswords | undefined = inject('pgRolePasswords');
  const template: string | undefined = inject('pgTemplate');
  if (!pg || !passwords || !template) {
    throw new Error(
      'useTestDatabase() needs the global setups of @northmes/testing and apps/server, which only the integration project runs. Name the file *.int.test.ts.',
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
