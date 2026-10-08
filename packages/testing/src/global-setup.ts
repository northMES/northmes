// SPDX-License-Identifier: MIT
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';
import { withClient } from './client.ts';
import { emptyTemplateDatabase, type PgConnection, type PgServerFacts } from './database.ts';
import { startPostgres } from './postgres-server.ts';

/** Creates the empty template, which carries a marker table into every clone. */
async function createTemplate(connection: PgConnection): Promise<void> {
  await withClient(connection, async (client) => {
    await client.query(`create database ${client.escapeIdentifier(emptyTemplateDatabase)}`);
  });
  // The client closes before the first clone: Postgres refuses to copy a database in use.
  await withClient({ ...connection, database: emptyTemplateDatabase }, async (client) => {
    await client.query('create table nm_marker (id integer primary key)');
  });
  // A flagged template can be cloned by any role that may create databases. Postgres refuses to
  // drop a flagged database, so a cleanup that drops the template must first set is_template to false.
  await withClient(connection, async (client) => {
    await client.query(
      `alter database ${client.escapeIdentifier(emptyTemplateDatabase)} is_template true`,
    );
  });
}

/** Reads the server facts that only the superuser may see (pg_read_file needs it). */
function readServerFacts(connection: PgConnection): Promise<PgServerFacts> {
  return withClient(connection, async (client) => {
    const { rows } = await client.query<PgServerFacts>(
      `select current_setting('TimeZone') as "timeZone",
              current_setting('data_directory') as "dataDirectory",
              pg_read_file('/proc/mounts') as mounts`,
    );
    const [facts] = rows;
    if (!facts) throw new Error('The server returned no settings');
    return facts;
  });
}

/**
 * Starts the one Postgres container of a test run (see startPostgres), creates the empty template,
 * which the server's global setup migrates a copy of, and reads the server facts that the harness
 * checks. The run also gets a temporary directory for state its test files share, such as the
 * outcome of the one server build that bootBuilt runs.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const { image, connection, stop } = await startPostgres();
  let serverFacts: PgServerFacts;
  try {
    await createTemplate(connection);
    serverFacts = await readServerFacts(connection);
  } catch (error) {
    // Vitest runs only the teardown that setup returns, so stop the container here. A failing stop
    // must not hide the error that made setup fail.
    await stop().catch(() => {});
    throw error;
  }
  const runDir = mkdtempSync(join(tmpdir(), 'northmes-run-'));
  project.provide('pg', connection);
  project.provide('pgImage', image);
  project.provide('pgServer', serverFacts);
  project.provide('runDir', runDir);

  return async () => {
    rmSync(runDir, { recursive: true, force: true });
    await stop();
  };
}
