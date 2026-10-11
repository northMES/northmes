// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUIDv7 } from 'node:crypto';
import {
  givenArticle,
  givenCompany,
  hostFactory,
  queryAsCore,
  signInAt,
} from '@northmes/backend/testing';
import {
  createTestApp,
  type GqlClient,
  gqlClient,
  type TestApp,
  useTestDatabase,
} from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const filterArgs = `
  $search: String, $includeArchived: Boolean,
  $articleGroupIds: [ID], $stockUnits: [StockUnit!], $sources: [String]
`;
const filters = `
  search: $search, includeArchived: $includeArchived,
  articleGroupIds: $articleGroupIds, stockUnits: $stockUnits, sources: $sources
`;

const articlesQuery = `query (${filterArgs}) {
  coreArticles(first: 100, orderBy: [{ field: CODE }], ${filters}) {
    totalCount
    edges { node { code } }
  }
}`;

const facetsQuery = `query (${filterArgs}) {
  coreArticleFacets(${filters}) {
    total
    articleGroups { id code name count }
    stockUnits { stockUnit count }
    sources { source count }
  }
}`;

type Filters = {
  search?: string;
  includeArchived?: boolean;
  articleGroupIds?: (string | null)[];
  stockUnits?: string[];
  sources?: (string | null)[];
};

interface Facets {
  total: number;
  articleGroups: { id: string | null; code: string | null; name: string | null; count: number }[];
  stockUnits: { stockUnit: string; count: number }[];
  sources: { source: string | null; count: number }[];
}

describe('the filters of coreArticles and their counts', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;
  let gql: GqlClient;
  const groups = { hoses: randomUUIDv7(), shafts: randomUUIDv7(), housings: randomUUIDv7() };

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
    const { company, plants } = await givenCompany(db.ownerUrl, { plants: 2 });
    const [plantA = '', plantB = ''] = plants;
    for (const [id, code, name] of [
      [groups.hoses, 'HO', 'Hoses'],
      [groups.shafts, 'SH', 'Shafts'],
      [groups.housings, 'HS', 'Housings'],
    ] as const) {
      await queryAsCore(
        db.ownerUrl,
        `insert into core.article_group (id, scope_id, company_id, code, name)
         values ($1, $2, $2, $3, $4)`,
        [id, company, code, name],
      );
    }
    // Fictional articles at Plant A; one at Plant B only, which Plant A never counts.
    const articles = [
      {
        code: 'AX-31007',
        name: 'Hydraulslang 12 mm',
        group: groups.hoses,
        unit: 'METRE',
        source: 'Pyramid',
      },
      {
        code: 'AX-31008',
        name: 'Hydraulslang 16 mm',
        group: groups.hoses,
        unit: 'METRE',
        source: 'Pyramid',
      },
      {
        code: 'AX-60410',
        name: 'Axeltapp 70 h6',
        group: groups.shafts,
        unit: 'PIECE',
        source: 'Pyramid',
      },
      { code: 'AX-52001', name: 'Smörjfett EP2', group: null, unit: 'KILOGRAM', source: null },
      { code: 'AX-52003', name: 'Smörjolja ISO 68', group: null, unit: 'LITRE', source: null },
      {
        code: 'AX-52099',
        name: 'Smörjolja, archived',
        group: null,
        unit: 'LITRE',
        source: null,
        archived: true,
      },
    ];
    for (const each of articles) {
      const id = await givenArticle(db.ownerUrl, {
        code: each.code,
        name: each.name,
        plants: [plantA],
      });
      await queryAsCore(
        db.ownerUrl,
        `update core.article
            set article_group_id = $2, stock_unit = $3, source = $4,
                archived_at = case when $5 then now() end
          where id = $1`,
        [id, each.group, each.unit, each.source, each.archived === true],
      );
    }
    await givenArticle(db.ownerUrl, { code: 'BX-1', name: 'Plant B only', plants: [plantB] });
    if (!testApp) throw new Error('the test app did not start');
    gql = gqlClient(await testApp.app.getUrl(), {
      headers: await signInAt(testApp.app, db.ownerUrl, plantA),
    });
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  async function codes(variables: Filters): Promise<string[] | undefined> {
    const answer = await gql.send<{
      coreArticles: { totalCount: number; edges: { node: { code: string } }[] };
    }>(articlesQuery, variables);
    return answer.data?.coreArticles.edges.map(({ node }) => node.code);
  }

  async function facets(variables: Filters): Promise<Facets | undefined> {
    const answer = await gql.send<{ coreArticleFacets: Facets }>(facetsQuery, variables);
    return answer.data?.coreArticleFacets;
  }

  it('E06-S06 the list keeps the articles of any picked group, and a null pick keeps those of no group', async () => {
    expect(await codes({ articleGroupIds: [groups.hoses, groups.shafts] })).toEqual([
      'AX-31007',
      'AX-31008',
      'AX-60410',
    ]);
    expect(await codes({ articleGroupIds: [null, groups.shafts] })).toEqual([
      'AX-52001',
      'AX-52003',
      'AX-60410',
    ]);
  });

  it('E06-S06 the list keeps the articles of any picked stock unit and source, a null source being NorthMES, and the filters add up', async () => {
    expect(await codes({ stockUnits: ['LITRE', 'KILOGRAM'] })).toEqual(['AX-52001', 'AX-52003']);
    expect(await codes({ sources: [null] })).toEqual(['AX-52001', 'AX-52003']);
    expect(await codes({ sources: ['Pyramid'], stockUnits: ['PIECE'] })).toEqual(['AX-60410']);
  });

  it("E06-S06 the counts give every value of each filter field among the plant's active articles, the archived and other plants' left out", async () => {
    expect(await facets({})).toEqual({
      total: 5,
      articleGroups: [
        { id: groups.hoses, code: 'HO', name: 'Hoses', count: 2 },
        { id: groups.shafts, code: 'SH', name: 'Shafts', count: 1 },
        { id: null, code: null, name: null, count: 2 },
      ],
      stockUnits: [
        { stockUnit: 'PIECE', count: 1 },
        { stockUnit: 'METRE', count: 2 },
        { stockUnit: 'KILOGRAM', count: 1 },
        { stockUnit: 'LITRE', count: 1 },
      ],
      sources: [
        { source: 'Pyramid', count: 3 },
        { source: null, count: 2 },
      ],
    });
  });

  it("E06-S06 a field's counts follow the other fields' filters and the search, not its own, so its menu still offers every value", async () => {
    const counted = await facets({ articleGroupIds: [groups.hoses], search: 'slang' });

    expect(counted).toMatchObject({
      total: 2,
      articleGroups: [{ id: groups.hoses, count: 2 }],
      stockUnits: [{ stockUnit: 'METRE', count: 2 }],
      sources: [{ source: 'Pyramid', count: 2 }],
    });
    const byGroup = await facets({ stockUnits: ['METRE', 'LITRE'] });
    expect(byGroup?.articleGroups).toEqual([
      { id: groups.hoses, code: 'HO', name: 'Hoses', count: 2 },
      { id: null, code: null, name: null, count: 1 },
    ]);
    expect(byGroup?.stockUnits).toHaveLength(4);
  });

  it('E06-S06 the counts take the archived articles in with includeArchived', async () => {
    const counted = await facets({ includeArchived: true, stockUnits: ['LITRE'] });

    expect(counted?.total).toBe(2);
  });
});
