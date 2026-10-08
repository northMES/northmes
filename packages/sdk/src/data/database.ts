// SPDX-License-Identifier: MIT
import type { Transaction } from 'kysely';

/** The token under which the host provides the ScopedDatabase. Module code injects it. */
export const DATABASE = 'northmes:database';

/**
 * The one way module code reaches Postgres (ADR 0006, ADR 0008). The host connects as nm_app, so
 * the row-level security policies of every module table apply.
 *
 * `DB` holds the Kysely table types of the module that injects it, so a query on another module's
 * table is a type error.
 */
export interface ScopedDatabase<DB> {
  /**
   * Runs fn in one Kysely transaction. Its first statement sets northmes.read_scopes and
   * northmes.write_scopes to the scope sets of the principal that the request or job runs as,
   * transaction-local, so no scope outlives the transaction. Without a principal, such as for a
   * request without a plant, both sets are empty and the transaction reads and writes nothing. The
   * transaction commits when fn resolves and rolls back when it rejects.
   */
  transaction<Result>(fn: (tx: Transaction<DB>) => Promise<Result>): Promise<Result>;
}
