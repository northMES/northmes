// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ScopedDatabase } from '@northmes/sdk/data';
import { type Kysely, sql } from 'kysely';
import { currentPrincipal } from '../principal.ts';

/**
 * The ScopedDatabase on a Kysely instance whose pool logs in as nm_app. Each transaction first sets
 * both scope sets of the principal that runAs names, with set_config(..., true), so they hold
 * until the transaction ends (ADR 0008). Without a principal both sets are empty, so the policies
 * let the transaction read and write nothing.
 */
export function scopedDatabase<DB>(db: Kysely<DB>): ScopedDatabase<DB> {
  return {
    async transaction(fn) {
      const principal = currentPrincipal();
      const readScopes = principal?.readScopes ?? [];
      const writeScopes = principal?.writeScopes ?? [];
      return await db.transaction().execute(async (tx) => {
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
