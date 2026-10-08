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
  /**
   * The server's log so far, read from the container's output. A line reaches it with a delay, so a
   * test waits for a line it knows will come before it checks what the log lacks.
   */
  logs(): Promise<string>;
  stop(): Promise<void>;
}

export interface StartPostgresOptions {
  /** Server settings on top of serverArgs, such as the log settings of a test that reads logs(). */
  readonly settings?: Readonly<Record<string, string>>;
}

/**
 * Starts a Postgres container from the image in infra/pg-image.json. The data directory is a tmpfs
 * mount: the image keeps it in /var/lib/postgresql/<major>/docker, under the image's volume at
 * /var/lib/postgresql, so the mount covers it and the data lives in memory and goes with the
 * container. The server runs without durability (see serverArgs). The superuser is postgres, as in
 * the official image and in production, where northmes db bootstrap logs in with that name. Its
 * password and the database name are random for each server, so no server shares a credential with
 * another.
 *
 * The global setup starts the one server of a test run with it. A test file starts a server of its
 * own only for what a cloned database cannot isolate: server-wide state such as the database roles,
 * server settings and the server log, and work that needs the superuser, which tests never log in
 * as on the run's server (ADR 0041).
 */
export async function startPostgres({
  settings = {},
}: StartPostgresOptions = {}): Promise<PostgresServer> {
  const { image } = JSON.parse(readFileSync(imageFile, 'utf8')) as { image: string };
  const { password, database } = newRunCredentials();
  const container = await new PostgreSqlContainer(image)
    .withUsername('postgres')
    .withPassword(password)
    .withDatabase(database)
    // biome-ignore lint/style/noProcessEnv: NM_TEST_PG_TZ picks the time zone leg of a test run, not app configuration.
    .withCommand(serverArgs(process.env, settings))
    .withTmpFs({ '/var/lib/postgresql': 'rw' })
    .start();
  // The log stream opens on the first logs() call and follows the container from its start.
  let log: Promise<{ text: string }> | undefined;
  const followLog = async () => {
    const stream = await container.logs();
    const collected = { text: '' };
    stream.on('data', (chunk: string) => {
      collected.text += chunk;
    });
    // An unhandled stream error would end the Vitest worker, so the error goes into the log text.
    stream.on('error', (error) => {
      collected.text += `\n[log stream failed: ${error.message}]\n`;
    });
    return collected;
  };
  return {
    image,
    connection: {
      host: container.getHost(),
      port: container.getPort(),
      user: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
    },
    logs: async () => {
      log ??= followLog();
      return (await log).text;
    },
    stop: async () => {
      await container.stop();
    },
  };
}
