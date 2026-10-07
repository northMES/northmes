// SPDX-License-Identifier: MIT
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
  }
}

export interface TestDatabase {
  connectionString: string;
  databaseName: string;
}

function connectionStringFor(pg: PgConnection, databaseName: string): string {
  const credentials = `${encodeURIComponent(pg.user)}:${encodeURIComponent(pg.password)}`;
  return `postgres://${credentials}@${pg.host}:${pg.port}/${encodeURIComponent(databaseName)}`;
}

async function asAdmin(pg: PgConnection, run: (client: Client) => Promise<void>): Promise<void> {
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
  const databaseName = 'nm_test';

  beforeAll(async () => {
    await asAdmin(pg, async (client) => {
      await client.query(`create database ${client.escapeIdentifier(databaseName)}`);
    });
  });

  afterAll(async () => {
    await asAdmin(pg, async (client) => {
      await client.query(`drop database ${client.escapeIdentifier(databaseName)} with (force)`);
    });
  });

  return { connectionString: connectionStringFor(pg, databaseName), databaseName };
}
