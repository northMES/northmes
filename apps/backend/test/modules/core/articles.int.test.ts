// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  givenArticles,
  givenCompany,
  hostFactory,
  queryAsCore,
  signIn,
  signInAt,
  statementsDuring,
} from '@northmes/backend/testing';
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
  orderBy?: { field: 'CODE' | 'NAME' | 'UPDATED_AT'; direction?: 'ASC' | 'DESC' }[];
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

  /**
   * A GraphQL client for the test app, signed in as a user who holds every permission at `plant`,
   * that names `plant` in x-northmes-plant.
   */
  async function clientAt(plant: string): Promise<GqlClient> {
    if (!testApp) throw new Error('the test app did not start');
    const headers = await signInAt(testApp.app, db.ownerUrl, plant);
    return gqlClient(await testApp.app.getUrl(), { headers });
  }

  /** Writes the articles at `plant`, in their order. */
  async function writeArticles(plant: string, articles: readonly { code: string; name: string }[]) {
    await givenArticles(
      db.ownerUrl,
      articles.map(({ code, name }) => ({ code, name, plants: [plant] })),
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

  /** The codes of each page, walking forward from the first page in pages of `first`. */
  async function walkForward(client: GqlClient, args: ListArgs & { first: number }) {
    const pages: string[][] = [];
    let after: string | undefined;
    for (;;) {
      const answer = await list(client, { ...args, after });
      expect(answer.errors).toBeUndefined();
      const connection = answer.data?.coreArticles;
      if (!connection) throw new Error('coreArticles answered no data');
      expect(connection.pageInfo.hasPreviousPage).toBe(after !== undefined);
      pages.push(connection.edges.map(({ node }) => node.code));
      if (!connection.pageInfo.hasNextPage) return pages;
      after = connection.pageInfo.endCursor ?? undefined;
    }
  }

  /** The codes of each page, walking backward from the last page in pages of `last`. */
  async function walkBackward(client: GqlClient, args: ListArgs & { last: number }) {
    const pages: string[][] = [];
    let before: string | undefined;
    for (;;) {
      const answer = await list(client, { ...args, before });
      expect(answer.errors).toBeUndefined();
      const connection = answer.data?.coreArticles;
      if (!connection) throw new Error('coreArticles answered no data');
      expect(connection.pageInfo.hasNextPage).toBe(before !== undefined);
      pages.unshift(connection.edges.map(({ node }) => node.code));
      if (!connection.pageInfo.hasPreviousPage) return pages;
      before = connection.pageInfo.startCursor ?? undefined;
    }
  }

  /** The order of the catalog's codes under each orderBy, written out by hand. */
  const orders: { orderBy: NonNullable<ListArgs['orderBy']>; codes: string[] }[] = [
    {
      orderBy: [{ field: 'CODE' }],
      codes: ['AX-300', 'BR-140', 'CW-220', 'HG-110', 'HG-120', 'PN-305', 'ZZ-001'],
    },
    {
      orderBy: [{ field: 'CODE', direction: 'DESC' }],
      codes: ['ZZ-001', 'PN-305', 'HG-120', 'HG-110', 'CW-220', 'BR-140', 'AX-300'],
    },
    {
      orderBy: [{ field: 'NAME' }],
      codes: ['ZZ-001', 'HG-110', 'HG-120', 'CW-220', 'AX-300', 'PN-305', 'BR-140'],
    },
    {
      orderBy: [{ field: 'NAME', direction: 'DESC' }],
      codes: ['BR-140', 'PN-305', 'AX-300', 'CW-220', 'HG-120', 'HG-110', 'ZZ-001'],
    },
    {
      orderBy: [{ field: 'NAME' }, { field: 'CODE', direction: 'DESC' }],
      codes: ['ZZ-001', 'HG-120', 'HG-110', 'CW-220', 'AX-300', 'PN-305', 'BR-140'],
    },
  ];

  /** The codes in pages of three. */
  function inPagesOfThree(codes: readonly string[]): string[][] {
    return [codes.slice(0, 3), codes.slice(3, 6), codes.slice(6)];
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

  it('E06-S02 paging forward walks every article once in the order of each orderBy', async () => {
    const client = await catalogPlant();

    for (const { orderBy, codes } of orders) {
      expect(await walkForward(client, { first: 3, orderBy }), JSON.stringify(orderBy)).toEqual(
        inPagesOfThree(codes),
      );
    }
  });

  it('E06-S02 paging backward with last and before walks every article once in the order of each orderBy', async () => {
    const client = await catalogPlant();

    for (const { orderBy, codes } of orders) {
      // The last page is full, so the first page holds the remainder.
      expect(await walkBackward(client, { last: 3, orderBy }), JSON.stringify(orderBy)).toEqual([
        codes.slice(0, 1),
        codes.slice(1, 4),
        codes.slice(4),
      ]);
    }
  });

  it('E06-S02 a cursor from a forward page pages backward from that article, and back again', async () => {
    const client = await catalogPlant();
    const firstPage = await list(client, { first: 4 });
    const fourth = firstPage.data?.coreArticles.edges[3]?.cursor;

    const before = await list(client, { last: 2, before: fourth });
    const after = await list(client, {
      first: 2,
      after: before.data?.coreArticles.pageInfo.endCursor ?? undefined,
    });

    expect(before.data?.coreArticles.edges.map(({ node }) => node.code)).toEqual([
      'BR-140',
      'CW-220',
    ]);
    expect(before.data?.coreArticles.pageInfo).toMatchObject({
      hasPreviousPage: true,
      hasNextPage: true,
    });
    expect(after.data?.coreArticles.edges.map(({ node }) => node.code)).toEqual([
      'HG-110',
      'HG-120',
    ]);
  });

  it('E06-S02 search finds articles by a part of their code or name, ignoring case and outer spaces, and totalCount counts the matches', async () => {
    const client = await catalogPlant();
    /** The codes and totalCount that search finds. */
    const found = async (search: string) => {
      const answer = await list(client, { search });
      expect(answer.errors, search).toBeUndefined();
      const connection = answer.data?.coreArticles;
      return [connection?.edges.map(({ node }) => node.code), connection?.totalCount];
    };

    expect(await found('hg-1')).toEqual([['HG-110', 'HG-120'], 2]);
    expect(await found('  HINGE ')).toEqual([['HG-110', 'HG-120'], 2]);
    expect(await found('ca')).toEqual([['CW-220', 'HG-110', 'HG-120'], 3]);
    // % and _ match themselves, not any text.
    expect(await found('%')).toEqual([[], 0]);
    expect(await found('_')).toEqual([[], 0]);
    expect(await found('   ')).toEqual([catalog.map(({ code }) => code), 7]);
  });

  it('E06-S02 coreArticles counts the articles only when a query selects totalCount', async () => {
    const client = await catalogPlant();
    if (!testApp) throw new Error('the test app did not start');
    const app = testApp.app;
    /** The statements of one coreArticles request that count rows. */
    const countsOf = async (selection: string) => {
      const { result, statements } = await statementsDuring(app, () =>
        client.send(`{ coreArticles(first: 2) { ${selection} } }`),
      );
      expect(result.errors).toBeUndefined();
      return statements.filter((statement) => statement.includes('count(*)'));
    };

    expect(await countsOf('edges { node { code } }')).toHaveLength(0);
    expect(await countsOf('totalCount edges { node { code } }')).toHaveLength(1);
  });

  /** The errorCode of each error of an answer. */
  function errorCodes(answer: { errors?: readonly { extensions?: Record<string, unknown> }[] }) {
    return answer.errors?.map(({ extensions }) => [extensions?.code, extensions?.errorCode]);
  }

  it('E06-S02 a cursor from another orderBy, or one coreArticles did not write, is refused with core.list.invalid_cursor', async () => {
    const client = await catalogPlant();
    const byCode = await list(client, { first: 2 });
    const cursor = byCode.data?.coreArticles.pageInfo.endCursor ?? undefined;
    const notAnId = Buffer.from(JSON.stringify([1, 'code.AL,id.AL', 'BR-140', 'x'])).toString(
      'base64url',
    );

    for (const args of [
      { first: 2, after: cursor, orderBy: [{ field: 'NAME' as const }] },
      {
        last: 2,
        before: cursor,
        orderBy: [{ field: 'CODE' as const, direction: 'DESC' as const }],
      },
      { first: 2, after: 'not-a-cursor' },
      { first: 2, after: notAnId },
    ]) {
      const answer = await list(client, args);

      expect(answer.data, JSON.stringify(args)).toBeNull();
      expect(errorCodes(answer), JSON.stringify(args)).toEqual([
        ['BAD_USER_INPUT', 'core.list.invalid_cursor'],
      ]);
    }
  });

  it('E06-S02 a page size outside 1 to 100, after with before, a repeated sort field and a search over 100 characters are refused with core.list.bad_argument', async () => {
    const client = await catalogPlant();
    const cursor = (await list(client, { first: 1 })).data?.coreArticles.pageInfo.endCursor;
    if (!cursor) throw new Error('the first page has no cursor');

    for (const args of [
      { first: 0 },
      { first: 101 },
      { last: 0 },
      { last: 101 },
      { after: cursor, before: cursor },
      {
        orderBy: [
          { field: 'NAME' as const },
          { field: 'NAME' as const, direction: 'DESC' as const },
        ],
      },
      { search: 'x'.repeat(101) },
    ]) {
      const answer = await list(client, args);

      expect(answer.data, JSON.stringify(args)).toBeNull();
      expect(errorCodes(answer), JSON.stringify(args)).toEqual([
        ['BAD_USER_INPUT', 'core.list.bad_argument'],
      ]);
    }
    // 100 characters are allowed, as are 100 rows.
    expect((await list(client, { first: 100, search: 'x'.repeat(100) })).errors).toBeUndefined();
  });
  /** Writes the articles at `plant` with the time of their last change, in their order. */
  async function writeChangedArticles(
    plant: string,
    articles: readonly { code: string; name: string; updatedAt: string }[],
  ) {
    await givenArticles(
      db.ownerUrl,
      articles.map(({ code, name, updatedAt }) => ({
        code,
        name,
        plants: [plant],
        updatedAt: new Date(updatedAt),
      })),
    );
  }

  it('E06-S06 orderBy UPDATED_AT DESC lists the most recently changed article first, with the code order breaking no tie but the id, and pages through the list', async () => {
    const plant = given.plant();
    await writeChangedArticles(plant, [
      { code: 'AX-300', name: 'Shelf board', updatedAt: '2026-10-01T07:55:00Z' },
      { code: 'BR-140', name: 'Wall bracket', updatedAt: '2026-10-05T14:07:00Z' },
      { code: 'CW-220', name: 'Caster wheel', updatedAt: '2026-10-04T07:12:00Z' },
      { code: 'HG-110', name: 'Cabinet hinge', updatedAt: '2026-10-04T07:12:00Z' },
      { code: 'PN-305', name: 'Side panel', updatedAt: '2026-09-28T15:45:00.123456Z' },
    ]);
    const client = await clientAt(plant);
    const newestFirst = ['BR-140', 'HG-110', 'CW-220', 'AX-300', 'PN-305'];

    expect(
      await walkForward(client, {
        first: 2,
        orderBy: [{ field: 'UPDATED_AT', direction: 'DESC' }],
      }),
    ).toEqual([newestFirst.slice(0, 2), newestFirst.slice(2, 4), newestFirst.slice(4)]);
    expect(
      await walkBackward(client, {
        last: 2,
        orderBy: [{ field: 'UPDATED_AT', direction: 'DESC' }],
      }),
    ).toEqual([newestFirst.slice(0, 1), newestFirst.slice(1, 3), newestFirst.slice(3)]);
    expect(await walkForward(client, { first: 3, orderBy: [{ field: 'UPDATED_AT' }] })).toEqual([
      ['PN-305', 'AX-300', 'CW-220'],
      ['HG-110', 'BR-140'],
    ]);
  });

  it('E06-S06 an article carries updatedAt, the time of its last change, which every update moves on', async () => {
    const plant = given.plant();
    await writeChangedArticles(plant, [
      { code: 'AX-300', name: 'Shelf board', updatedAt: '2026-10-01T07:55:00Z' },
    ]);
    const client = await clientAt(plant);
    const updatedAt = async () => {
      const answer = await client.send<{
        coreArticles: { edges: { node: { updatedAt: string } }[] };
      }>('{ coreArticles { edges { node { updatedAt } } } }');
      expect(answer.errors).toBeUndefined();
      return answer.data?.coreArticles.edges[0]?.node.updatedAt;
    };
    expect(await updatedAt()).toBe('2026-10-01T07:55:00.000Z');

    await queryAsCore(
      db.ownerUrl,
      `update core.article set name = 'Shelf board 600'
        where id in (select article_id from core.article_plant where plant_id = $1)`,
      [plant],
    );

    expect(Date.parse((await updatedAt()) ?? '')).toBeGreaterThan(
      Date.parse('2026-10-01T07:55:00Z'),
    );
  });

  it('E06-S06 a user without core.article:read at the plant gets FORBIDDEN with core.forbidden from coreArticles and coreArticle, and no article', async () => {
    if (!testApp) throw new Error('the test app did not start');
    const { plants, slugs } = await givenCompany(db.ownerUrl);
    const plant = plants[0] ?? '';
    await writeArticles(plant, [{ code: 'AX-300', name: 'Shelf board' }]);
    const { authorization } = await signIn(testApp.app, db.ownerUrl, [
      { scopeId: plant, permissions: ['core.user:read'] },
    ]);
    const client = gqlClient(await testApp.app.getUrl(), {
      headers: { authorization, 'x-northmes-plant': slugs[0] ?? '' },
    });
    const [row] = await queryAsCore<{ id: string }>(
      db.ownerUrl,
      'select id from core.article where edit_scope_id = $1',
      [plant],
    );

    const list = await client.send('{ coreArticles { edges { node { code } } } }');
    const one = await client.send('query One($id: ID!) { coreArticle(id: $id) { code } }', {
      id: row?.id,
    });

    expect(list.data).toBeNull();
    expect(errorCodes(list)).toEqual([['FORBIDDEN', 'core.forbidden']]);
    expect(one.data?.coreArticle ?? null).toBeNull();
    expect(errorCodes(one)).toEqual([['FORBIDDEN', 'core.forbidden']]);
  });
});
