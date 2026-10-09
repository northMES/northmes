// SPDX-License-Identifier: AGPL-3.0-or-later

import { AsyncLocalStorage } from 'node:async_hooks';
import type { ScopedDatabase } from '@northmes/sdk/data';
import { type Kysely, sql } from 'kysely';
import { currentPrincipal } from '../principal.ts';

const readOnlyRuns = new AsyncLocalStorage<true>();

/**
 * Runs fn so that every ScopedDatabase transaction it starts, also after an await, is read only:
 * Postgres refuses a write in it with 25006 (ADR 0073). The operation runner runs every query
 * operation's handler in it, so a query never writes.
 */
export function readOnly<Result>(fn: () => Promise<Result>): Promise<Result> {
  return readOnlyRuns.run(true, fn);
}

/**
 * The ScopedDatabase on a Kysely instance whose pool logs in as nm_app. Each transaction first sets
 * both scope sets of the principal that runAs names, with set_config(..., true), so they hold
 * until the transaction ends (ADR 0008). Without a principal both sets are empty, so the policies
 * let the transaction read and write nothing. Inside readOnly, the transaction is read only.
 */
export function scopedDatabase<DB>(db: Kysely<DB>): ScopedDatabase<DB> {
  return {
    async transaction(fn) {
      const principal = currentPrincipal();
      const readScopes = principal?.readScopes ?? [];
      const writeScopes = principal?.writeScopes ?? [];
      const readOnlyRun = readOnlyRuns.getStore() === true;
      return await db.transaction().execute(async (tx) => {
        // SET TRANSACTION must come before the transaction's first query.
        if (readOnlyRun) await sql`set transaction read only`.execute(tx);
        // set_config takes bind parameters, which SET LOCAL does not. The cast refuses a scope id
        // that is not a uuid.
        await sql`select set_config('northmes.read_scopes', ${readScopes}::uuid[]::text, true),
                         set_config('northmes.write_scopes', ${writeScopes}::uuid[]::text, true)`.execute(
          tx,
        );
        return fn(tx);
      });
    },
  };
}

/**
 * The ScopedDatabase of pnpm northmes migrate, which constructs no nm_app pool (ADR 0060). Every
 * transaction rejects without sending anything.
 */
export const noPoolDatabase: ScopedDatabase<never> = {
  transaction: () =>
    Promise.reject(
      new Error(
        'pnpm northmes migrate has no nm_app pool, so a ScopedDatabase transaction cannot run',
      ),
    ),
};
