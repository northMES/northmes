// SPDX-License-Identifier: AGPL-3.0-or-later
import { hostFactory } from '@northmes/server/testing';
import {
  createTestApp,
  given,
  gqlClient,
  query,
  type TestApp,
  useTestDatabase,
} from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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

const articlesQuery = `query Articles($own: ID!, $other: ID!) {
  own: coreArticle(id: $own) { code name }
  other: coreArticle(id: $other) { code name }
}`;

interface ArticlesAnswer {
  own: { code: string; name: string } | null;
  other: { code: string; name: string } | null;
}

describe('core.article', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  // Vitest runs the afterAll hooks of a block last registered first, so the app and its pool close
  // before useTestDatabase drops the database.
  afterAll(async () => {
    await testApp?.app.close();
  });

  /** A GraphQL client for the test app that names `plant` in x-northmes-plant. */
  async function clientAt(plant: string) {
    if (!testApp) throw new Error('the test app did not start');
    return gqlClient(await testApp.app.getUrl(), { headers: { 'x-northmes-plant': plant } });
  }

  /** Writes an article at `plant` and returns its id. */
  async function writeArticle(plant: string, code: string, name: string): Promise<string> {
    const { rows } = await db.command(
      { principal: { type: 'system', id: 'fixture' }, scopes: [plant], reason: 'fixture' },
      (tx) =>
        tx.query<{ id: string }>(
          'insert into core.article (scope_id, code, name) values ($1, $2, $3) returning id',
          [plant, code, name],
        ),
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('the article insert returned no id');
    return id;
  }

  it("E02-S04 coreArticle returns an article written at the request's plant and null for another plant's", async () => {
    const plant = given.plant();
    const otherPlant = given.plant();
    const own = await writeArticle(plant, 'BR-410', 'Wall bracket');
    const other = await writeArticle(otherPlant, 'HG-220', 'Cabinet hinge');

    const answer = await (await clientAt(plant)).send<ArticlesAnswer>(articlesQuery, {
      own,
      other,
    });

    expect(answer).toEqual({
      status: 200,
      data: { own: { code: 'BR-410', name: 'Wall bracket' }, other: null },
    });
  });

  it('E02-S04 core.article is owned by nm_mod_core and grants references (id) to nm_ext', async () => {
    const grants = await query<ArticleGrants>(db.ownerUrl, articleGrantsQuery);

    expect(grants).toEqual([{ owner: 'nm_mod_core', referencesId: true, referencesCode: false }]);
  });
});
