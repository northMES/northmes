// SPDX-License-Identifier: MIT
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';
import { type PgConnection, templateDatabase, withClient } from './database.ts';
import { startPostgres } from './postgres-server.ts';

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
 * Starts the one Postgres container of a test run (see startPostgres) and prepares the template
 * database that every test file clones. The run also gets a temporary directory for state its test
 * files share, such as the outcome of the one server build that bootBuilt runs.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const { image, connection, stop } = await startPostgres();
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
