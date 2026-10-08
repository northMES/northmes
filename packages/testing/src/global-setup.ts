// SPDX-License-Identifier: MIT
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import { newRunCredentials } from './credentials.ts';
import { type PgConnection, templateDatabase, withClient } from './database.ts';
import { serverArgs } from './server-settings.ts';

const imageFile = new URL('../../../infra/pg-image.json', import.meta.url);

async function createTemplate(connection: PgConnection): Promise<void> {
  await withClient(connection, async (client) => {
    await client.query(`create database ${client.escapeIdentifier(templateDatabase)}`);
  });
  // The client closes before the first clone: Postgres refuses to copy a database in use.
  await withClient({ ...connection, database: templateDatabase }, async (client) => {
    await client.query('create table nm_marker (id integer primary key)');
  });
  // A flagged template can be cloned by any role that may create databases. Postgres refuses to
  // drop a flagged database, so a cleanup that drops the template must first set is_template to false.
  await withClient(connection, async (client) => {
    await client.query(
      `alter database ${client.escapeIdentifier(templateDatabase)} is_template true`,
    );
  });
}

/**
 * Starts the one Postgres container of a test run from the image in infra/pg-image.json and
 * prepares the template database that every test file clones. The data directory is a tmpfs mount:
 * the image keeps it in /var/lib/postgresql/<major>/docker, under the image's volume at
 * /var/lib/postgresql, so the mount covers it and the data lives in memory and goes with the
 * container. The server runs without durability (see serverArgs). The superuser password and the
 * database name are random for each run, so no run shares a credential with another. The run also
 * gets a temporary directory for state its test files share, such as the outcome of the one server
 * build that bootBuilt runs.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const { image } = JSON.parse(readFileSync(imageFile, 'utf8')) as { image: string };
  const { password, database } = newRunCredentials();
  const container = await new PostgreSqlContainer(image)
    .withPassword(password)
    .withDatabase(database)
    // biome-ignore lint/style/noProcessEnv: NM_TEST_PG_TZ picks the time zone leg of a test run, not app configuration.
    .withCommand(serverArgs(process.env))
    .withTmpFs({ '/var/lib/postgresql': 'rw' })
    .start();
  const stop = async () => {
    await container.stop();
  };

  const connection: PgConnection = {
    host: container.getHost(),
    port: container.getPort(),
    user: container.getUsername(),
    password: container.getPassword(),
    database: container.getDatabase(),
  };
  try {
    await createTemplate(connection);
  } catch (error) {
    // Vitest runs only the teardown that setup returns, so stop the container here. A failing stop
    // must not hide the error that made setup fail.
    await stop().catch(() => {});
    throw error;
  }
  const runDir = mkdtempSync(join(tmpdir(), 'northmes-run-'));
  project.provide('pg', connection);
  project.provide('pgImage', image);
  project.provide('runDir', runDir);

  return async () => {
    rmSync(runDir, { recursive: true, force: true });
    await stop();
  };
}
