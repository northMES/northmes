// SPDX-License-Identifier: MIT
import { randomBytes } from 'node:crypto';
import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, inject } from 'vitest';

/** Where the container started by the global setup listens, as the superuser. */
export interface PgConnection {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    pg: PgConnection;
    /** The image the container started from, as read from infra/pg-image.json. */
    pgImage: string;
  }
}

export interface TestDatabase {
  connectionString: string;
  databaseName: string;
}

/** The database that every test database is cloned from. */
export const templateDatabase = 'nm_template';

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
  if (!pg) {
    throw new Error(
      'useTestDatabase() needs the global setup of @northmes/testing, which only the integration project runs. Name the file *.int.test.ts.',
    );
  }
  // biome-ignore lint/style/noProcessEnv: Vitest sets VITEST_POOL_ID for each worker; it names no configuration.
  const databaseName = `t_${process.env.VITEST_POOL_ID ?? 0}_${randomBytes(6).toString('hex')}`;

  beforeAll(async () => {
    await withClient(pg, async (client) => {
      const name = client.escapeIdentifier(databaseName);
      await client.query(`create database ${name} template ${templateDatabase}`);
    });
  });

  afterAll(async () => {
    await withClient(pg, async (client) => {
      const name = client.escapeIdentifier(databaseName);
      await client.query(`drop database if exists ${name} with (force)`);
    });
  });

  // The connection string is for the container's superuser. Database roles arrive with the
  // migration runner (E02-S02), which switches this to the app role; until then a test database
  // is reachable as a superuser.
  return { connectionString: connectionStringFor(pg, databaseName), databaseName };
}
