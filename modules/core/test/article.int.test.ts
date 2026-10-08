// SPDX-License-Identifier: AGPL-3.0-or-later
import { query, useTestDatabase } from '@northmes/testing';
import { describe, expect, it } from 'vitest';

/** Who owns core.article and which of its columns nm_ext may reference by foreign key. */
interface ArticleGrants {
  owner: string;
  referencesId: boolean;
  referencesCode: boolean;
}

// The table is looked up by name in the catalog, because a regclass cast needs USAGE on the core
// schema, which nm_owner does not hold.
const articleGrantsQuery = `select pg_get_userbyid(c.relowner) as owner,
  has_column_privilege('nm_ext', c.oid, 'id', 'REFERENCES') as "referencesId",
  has_column_privilege('nm_ext', c.oid, 'code', 'REFERENCES') as "referencesCode"
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'core' and c.relname = 'article'`;

describe('core.article', () => {
  const db = useTestDatabase();

  it('E02-S04 core.article is owned by nm_mod_core and grants references (id) to nm_ext', async () => {
    const grants = await query<ArticleGrants>(db.ownerUrl, articleGrantsQuery);

    expect(grants).toEqual([{ owner: 'nm_mod_core', referencesId: true, referencesCode: false }]);
  });
});
