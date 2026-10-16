// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic

import type { Client } from 'pg';
import { PgBoss } from 'pg-boss';

/** The schema of pg-boss's tables, the job queue of event consumers and jobs (ADR 0014). */
export const jobSchema = 'pgboss';

/**
 * Installs pg-boss's schema, or migrates it to the pinned pg-boss version, as nm_owner on
 * `ownerUrl`, and lets nm_app use it. The server's roles start pg-boss with migrate false, so only
 * northmes migrate changes the schema (ADR 0014). pg-boss runs its own statements here, in one
 * transaction under its own advisory lock; nothing else of pg-boss starts.
 */
export async function installJobQueue(client: Client, ownerUrl: string): Promise<void> {
  const boss = new PgBoss({
    connectionString: ownerUrl,
    schema: jobSchema,
    migrate: true,
    supervise: false,
    schedule: false,
    max: 1,
  });
  await boss.start();
  await boss.stop({ graceful: false });
  // nm_app sends, fetches and settles jobs, and supervision expires and deletes them. It changes
  // no table definition, so the schema's tables stay nm_owner's.
  const schema = client.escapeIdentifier(jobSchema);
  await client.query(`grant usage on schema ${schema} to nm_app`);
  await client.query(
    `grant select, insert, update, delete on all tables in schema ${schema} to nm_app`,
  );
  await client.query(`grant usage, select on all sequences in schema ${schema} to nm_app`);
  await client.query(`grant execute on all functions in schema ${schema} to nm_app`);
}
