// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ScopedDatabase } from '@northmes/sdk/data';
import { type Kysely, sql } from 'kysely';
import { currentPrincipal } from '../principal.ts';

/**
 * The ScopedDatabase on a Kysely instance whose pool logs in as nm_app. Each transaction first sets
 * both scope sets of the principal that runAs names, with set_config(..., true), so they hold
 * until the transaction ends (ADR 0008).
 */
export function scopedDatabase<DB>(db: Kysely<DB>): ScopedDatabase<DB> {
  return {
    async transaction(fn) {
      const principal = currentPrincipal();
      if (!principal) throw new Error('A scoped transaction needs a principal');
      return await db.transaction().execute(async (tx) => {
        // set_config takes bind parameters, which SET LOCAL does not. The cast refuses a scope id
        // that is not a uuid.
        await sql`select set_config('northmes.read_scopes', ${principal.readScopes}::uuid[]::text, true),
                         set_config('northmes.write_scopes', ${principal.writeScopes}::uuid[]::text, true)`.execute(
          tx,
        );
        return fn(tx);
      });
    },
  };
}
