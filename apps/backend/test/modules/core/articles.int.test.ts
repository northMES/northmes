// SPDX-License-Identifier: AGPL-3.0-or-later
import { hostFactory } from '@northmes/backend/testing';
import {
  createTestApp,
  type GqlClient,
  given,
  gqlClient,
  type TestApp,
  useTestDatabase,
} from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const articlesQuery = `query Articles(
  $first: Int, $after: String, $last: Int, $before: String,
  $orderBy: [ArticleOrderBy!], $search: String
) {
  coreArticles(
    first: $first, after: $after, last: $last, before: $before, orderBy: $orderBy, search: $search
  ) {
    totalCount
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    edges { cursor node { id code name version } }
  }
}`;

interface ArticleNode {
  id: string;
  code: string;
  name: string;
  version: number;
}

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

interface ArticlesAnswer {
  coreArticles: {
    totalCount: number;
    pageInfo: PageInfo;
    edges: { cursor: string; node: ArticleNode }[];
  };
}

/** The arguments of coreArticles that a test sends. */
interface ListArgs {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
  orderBy?: { field: 'CODE' | 'NAME'; direction?: 'ASC' | 'DESC' }[];
  search?: string;
}

/**
 * Fictional articles, written in this order, so their ids grow in this order too. Their code order
 * and their name order differ, and the two hinges share a name, so the id breaks that tie.
 */
const catalog = [
  { code: 'AX-300', name: 'Shelf board' },
  { code: 'BR-140', name: 'Wall bracket' },
  { code: 'CW-220', name: 'Caster wheel' },
  { code: 'HG-110', name: 'Cabinet hinge' },
  { code: 'HG-120', name: 'Cabinet hinge' },
  { code: 'PN-305', name: 'Side panel' },
  { code: 'ZZ-001', name: 'Assembly screw' },
];

describe('coreArticles', () => {
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
  async function clientAt(plant: string): Promise<GqlClient> {
    if (!testApp) throw new Error('the test app did not start');
    return gqlClient(await testApp.app.getUrl(), { headers: { 'x-northmes-plant': plant } });
  }

  /** Writes the articles at `plant`, one statement each and in their order. */
  async function writeArticles(plant: string, articles: readonly { code: string; name: string }[]) {
    await db.command(
      { principal: { type: 'system', id: 'fixture' }, scopes: [plant], reason: 'fixture' },
      async (tx) => {
        for (const { code, name } of articles) {
          await tx.query('insert into core.article (scope_id, code, name) values ($1, $2, $3)', [
            plant,
            code,
            name,
          ]);
        }
      },
    );
  }

  /** A plant that holds the catalog, and a client that reads at it. */
  async function catalogPlant(): Promise<GqlClient> {
    const plant = given.plant();
    await writeArticles(plant, catalog);
    return clientAt(plant);
  }

  /** Sends coreArticles with `args`. */
  function list(client: GqlClient, args: ListArgs = {}) {
    return client.send<ArticlesAnswer>(articlesQuery, { ...args });
  }

  it("E06-S02 coreArticles returns the first page of the plant's articles by code with the total count", async () => {
    const client = await catalogPlant();
    // Articles at another plant stay out of the list and its count.
    await writeArticles(given.plant(), [{ code: 'AA-001', name: 'Other plant article' }]);

    const answer = await list(client, { first: 3 });

    expect(answer.errors).toBeUndefined();
    const connection = answer.data?.coreArticles;
    expect(connection?.totalCount).toBe(7);
    expect(connection?.edges.map(({ node }) => [node.code, node.name, node.version])).toEqual([
      ['AX-300', 'Shelf board', 1],
      ['BR-140', 'Wall bracket', 1],
      ['CW-220', 'Caster wheel', 1],
    ]);
    expect(connection?.pageInfo).toEqual({
      hasNextPage: true,
      hasPreviousPage: false,
      startCursor: connection?.edges[0]?.cursor,
      endCursor: connection?.edges[2]?.cursor,
    });
  });
});
