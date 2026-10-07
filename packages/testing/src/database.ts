// SPDX-License-Identifier: MIT
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
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

export async function withClient(
  pg: PgConnection,
  run: (client: Client) => Promise<void>,
): Promise<void> {
  const client = new Client(pg);
  client.on('error', () => {});
  await client.connect();
  try {
    await run(client);
  } finally {
    await client.end();
  }
}

/**
 * Gives the calling test file a database of its own on the container that the global setup
 * started. The database exists from `beforeAll` to `afterAll`.
 */
export function useTestDatabase(): TestDatabase {
  const pg = inject('pg');
  const databaseName = `t_${process.env.VITEST_POOL_ID ?? 0}_${randomBytes(6).toString('hex')}`;

  beforeAll(async () => {
    await withClient(pg, async (client) => {
      const name = client.escapeIdentifier(databaseName);
      await client.query(`create database ${name} template ${templateDatabase}`);
    });
  });

  afterAll(async () => {
    await withClient(pg, async (client) => {
      await client.query(`drop database ${client.escapeIdentifier(databaseName)} with (force)`);
    });
  });

  return { connectionString: connectionStringFor(pg, databaseName), databaseName };
}
