// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { newRunCredentials } from './credentials.ts';
import type { PgConnection } from './database.ts';
import { serverArgs } from './server-settings.ts';

const imageFile = new URL('../../../infra/pg-image.json', import.meta.url);

/** A started Postgres server and how to reach it as its superuser. */
export interface PostgresServer {
  /** The image the container started from, as read from infra/pg-image.json. */
  image: string;
  connection: PgConnection;
  stop(): Promise<void>;
}

/**
 * Starts a Postgres container from the image in infra/pg-image.json. The data directory is a tmpfs
 * mount: the image keeps it in /var/lib/postgresql/<major>/docker, under the image's volume at
 * /var/lib/postgresql, so the mount covers it and the data lives in memory and goes with the
 * container. The server runs without durability (see serverArgs). The superuser password and the
 * database name are random for each server, so no server shares a credential with another.
 */
export async function startPostgres(): Promise<PostgresServer> {
  const { image } = JSON.parse(readFileSync(imageFile, 'utf8')) as { image: string };
  const { password, database } = newRunCredentials();
  const container = await new PostgreSqlContainer(image)
    .withPassword(password)
    .withDatabase(database)
    // biome-ignore lint/style/noProcessEnv: NM_TEST_PG_TZ picks the time zone leg of a test run, not app configuration.
    .withCommand(serverArgs(process.env))
    .withTmpFs({ '/var/lib/postgresql': 'rw' })
    .start();
  return {
    image,
    connection: {
      host: container.getHost(),
      port: container.getPort(),
      user: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
    },
    stop: async () => {
      await container.stop();
    },
  };
}
