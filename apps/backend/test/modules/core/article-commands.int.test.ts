// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUIDv7 } from 'node:crypto';
import {
  type Grant,
  givenArticle,
  givenCompany,
  hostFactory,
  signIn,
  signInAt,
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

const createMutation = `mutation ($input: CoreCreateArticleInput!) {
  coreCreateArticle(input: $input) { id code name version }
}`;

const updateMutation = `mutation ($input: CoreUpdateArticleInput!) {
  coreUpdateArticle(input: $input) { id code name version }
}`;

const articleQuery = 'query ($id: ID!) { coreArticle(id: $id) { id code name version } }';

interface Article {
  id: string;
  code: string;
  name: string;
  version: number;
}

describe('coreCreateArticle and coreUpdateArticle', () => {
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

  /** The article with `id` as coreArticle reads it. */
  async function readArticle(client: GqlClient, id: string): Promise<Article | null | undefined> {
    const answer = await client.send<{ coreArticle: Article | null }>(articleQuery, { id });
    return answer.data?.coreArticle;
  }

  it('E06-S06 coreCreateArticle creates an article at the plant with the trimmed code and name and version 1', async () => {
    const client = await clientAt(given.plant());
    const id = randomUUIDv7();

    const answer = await client.send(createMutation, {
      input: { id, code: '  BR-140 ', name: ' Wall bracket ' },
    });

    const article = { id, code: 'BR-140', name: 'Wall bracket', version: 1 };
    expect(answer).toEqual({ status: 200, data: { coreCreateArticle: article } });
    expect(await readArticle(client, id)).toEqual(article);
  });

  it('E06-S06 a retried coreCreateArticle with the same id returns the first article and creates no second one', async () => {
    const client = await clientAt(given.plant());
    const id = randomUUIDv7();
    await client.send(createMutation, { input: { id, code: 'CW-220', name: 'Caster wheel' } });

    const retry = await client.send(createMutation, {
      input: { id, code: 'CW-221', name: 'Caster wheel, retried' },
    });

    const first = { id, code: 'CW-220', name: 'Caster wheel', version: 1 };
    expect(retry).toEqual({ status: 200, data: { coreCreateArticle: first } });
    const listed = await client.send<{ coreArticles: { totalCount: number } }>(
      '{ coreArticles { totalCount } }',
    );
    expect(listed.data?.coreArticles.totalCount).toBe(1);
  });

  /** The error of a code that another article at the plant uses (ADR 0009, ADR 0012). */
  const codeTaken = (path: string) => ({
    message: 'The code is already taken.',
    path: [path],
    extensions: {
      code: 'CONFLICT',
      errorCode: 'core.code_taken',
      fieldErrors: [
        { path: ['code'], message: 'The code is already taken.', code: 'core.code_taken' },
      ],
    },
  });

  it('E06-S06 coreCreateArticle with a code that another article at the plant uses, in any case, returns core.code_taken on code', async () => {
    const plant = given.plant();
    const client = await clientAt(plant);
    await client.send(createMutation, {
      input: { id: randomUUIDv7(), code: 'HG-110', name: 'Cabinet hinge' },
    });
    const id = randomUUIDv7();

    const answer = await client.send(createMutation, {
      input: { id, code: 'hg-110', name: 'Cabinet hinge, left' },
    });

    expect(answer).toMatchObject({
      status: 200,
      data: null,
      errors: [codeTaken('coreCreateArticle')],
    });
    expect(await readArticle(client, id)).toBeNull();
    // Another plant may use the code.
    const otherPlant = await clientAt(given.plant());
    const other = await otherPlant.send(createMutation, {
      input: { id: randomUUIDv7(), code: 'HG-110', name: 'Cabinet hinge' },
    });
    expect(other.errors).toBeUndefined();
  });

  it('E06-S06 coreCreateArticle with a blank code and a name over 200 characters returns BAD_USER_INPUT with fieldErrors on both', async () => {
    const client = await clientAt(given.plant());

    const answer = await client.send(createMutation, {
      input: { id: randomUUIDv7(), code: '   ', name: 'N'.repeat(201) },
    });

    expect(answer).toMatchObject({
      status: 200,
      data: null,
      errors: [
        {
          path: ['coreCreateArticle'],
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [
              { path: ['code'], code: 'too_small', message: expect.any(String) },
              { path: ['name'], code: 'too_big', message: expect.any(String) },
            ],
          },
        },
      ],
    });
  });

  it('E06-S06 coreCreateArticle without x-northmes-plant returns FORBIDDEN with errorCode core.plant_forbidden', async () => {
    if (!testApp) throw new Error('the test app did not start');
    const { authorization } = await signInAt(testApp.app, db.ownerUrl, given.plant());
    const client = gqlClient(await testApp.app.getUrl(), { headers: { authorization } });

    const answer = await client.send(createMutation, {
      input: { id: randomUUIDv7(), code: 'PN-305', name: 'Side panel' },
    });

    // coreCreateArticle is not plant-free, so the operation runs no field (ADR 0066).
    expect(answer.data).toBeUndefined();
    expect(answer.errors).toMatchObject([
      {
        message: 'The request names no plant. Choose one of your plants.',
        extensions: { code: 'FORBIDDEN', errorCode: 'core.plant_forbidden' },
      },
    ]);
  });

  /** Creates an article through coreCreateArticle and returns it. */
  async function create(client: GqlClient, code: string, name: string): Promise<Article> {
    const answer = await client.send<{ coreCreateArticle: Article }>(createMutation, {
      input: { id: randomUUIDv7(), code, name },
    });
    if (!answer.data) throw new Error(`the create failed: ${JSON.stringify(answer.errors)}`);
    return answer.data.coreCreateArticle;
  }

  it('E06-S06 coreUpdateArticle changes the code and name and bumps the version', async () => {
    const client = await clientAt(given.plant());
    const { id } = await create(client, 'SB-500', 'Shelf board');

    const answer = await client.send(updateMutation, {
      input: { id, expectedVersion: 1, code: ' SB-501 ', name: 'Shelf board, oak ' },
    });

    const article = { id, code: 'SB-501', name: 'Shelf board, oak', version: 2 };
    expect(answer).toEqual({ status: 200, data: { coreUpdateArticle: article } });
    expect(await readArticle(client, id)).toEqual(article);
  });

  it('E06-S06 coreUpdateArticle with a stale expectedVersion returns core.version_conflict and changes nothing', async () => {
    const client = await clientAt(given.plant());
    const { id } = await create(client, 'SB-600', 'Shelf board');
    await client.send(updateMutation, {
      input: { id, expectedVersion: 1, code: 'SB-600', name: 'Shelf board, pine' },
    });

    const answer = await client.send(updateMutation, {
      input: { id, expectedVersion: 1, code: 'SB-601', name: 'Shelf board, birch' },
    });

    expect(answer).toMatchObject({
      status: 200,
      data: null,
      errors: [
        {
          message: `Article ${id} is at version 2, and the change was made on version 1`,
          path: ['coreUpdateArticle'],
          extensions: { code: 'CONFLICT', errorCode: 'core.version_conflict' },
        },
      ],
    });
    expect(await readArticle(client, id)).toEqual({
      id,
      code: 'SB-600',
      name: 'Shelf board, pine',
      version: 2,
    });
  });

  it("E06-S06 coreUpdateArticle of an unknown id or another plant's article returns NOT_FOUND without an errorCode", async () => {
    const otherPlant = await clientAt(given.plant());
    const { id: otherId } = await create(otherPlant, 'WB-100', 'Wall bracket');
    const client = await clientAt(given.plant());

    for (const id of [randomUUIDv7(), otherId]) {
      const answer = await client.send(updateMutation, {
        input: { id, expectedVersion: 1, code: 'WB-101', name: 'Wall bracket, wide' },
      });

      expect(answer).toMatchObject({
        status: 200,
        data: null,
        errors: [
          {
            message: `Article ${id} was not found`,
            path: ['coreUpdateArticle'],
            extensions: { code: 'NOT_FOUND' },
          },
        ],
      });
      expect(answer.errors?.[0]?.extensions).not.toHaveProperty('errorCode');
    }
    expect(await readArticle(otherPlant, otherId)).toMatchObject({ code: 'WB-100', version: 1 });
  });

  it('E06-S06 coreUpdateArticle to a code that another article at the plant uses returns core.code_taken on code and changes nothing', async () => {
    const client = await clientAt(given.plant());
    await create(client, 'CW-300', 'Caster wheel');
    const article = await create(client, 'CW-301', 'Caster wheel, braked');

    const answer = await client.send(updateMutation, {
      input: { id: article.id, expectedVersion: 1, code: 'cw-300', name: 'Caster wheel, braked' },
    });

    expect(answer).toMatchObject({
      status: 200,
      data: null,
      errors: [codeTaken('coreUpdateArticle')],
    });
    expect(await readArticle(client, article.id)).toEqual(article);
    // The article may keep its own code in another case.
    const recased = await client.send(updateMutation, {
      input: { id: article.id, expectedVersion: 1, code: 'cw-301', name: 'Caster wheel, braked' },
    });
    expect(recased.errors).toBeUndefined();
  });

  /**
   * A GraphQL client for the test app, signed in as a user whose roles grant `grants`, that names
   * the plant with slug `plantSlug` in x-northmes-plant.
   */
  async function clientWith(plantSlug: string, grants: readonly Grant[]): Promise<GqlClient> {
    if (!testApp) throw new Error('the test app did not start');
    const { authorization } = await signIn(testApp.app, db.ownerUrl, grants);
    return gqlClient(await testApp.app.getUrl(), {
      headers: { authorization, 'x-northmes-plant': plantSlug },
    });
  }

  /** The refusal of coreUpdateArticle on article `id` by a user without core.article:update there. */
  const updateForbidden = (id: string) => ({
    status: 200,
    data: null,
    errors: [
      {
        message: `You need core.article:update at the scope of Article ${id}`,
        path: ['coreUpdateArticle'],
        extensions: { code: 'FORBIDDEN', errorCode: 'core.forbidden' },
      },
    ],
  });

  it('E05-S06 a user who holds core.article:update at the company updates an article at a plant below it', async () => {
    const { company, plants, slugs } = await givenCompany(db.ownerUrl);
    const [plant = ''] = plants;
    const [slug = ''] = slugs;
    const { id } = await create(await clientAt(plant), 'LG-100', 'Leveling foot');
    const companyEditor = await clientWith(slug, [
      { scopeId: company, permissions: ['core.article:read', 'core.article:update'] },
    ]);

    const answer = await companyEditor.send(updateMutation, {
      input: { id, expectedVersion: 1, code: 'LG-101', name: 'Leveling foot, M10' },
    });

    expect(answer).toEqual({
      status: 200,
      data: { coreUpdateArticle: { id, code: 'LG-101', name: 'Leveling foot, M10', version: 2 } },
    });
  });

  it('E05-S06 a user whose role at the plant creates articles but does not update them gets FORBIDDEN core.forbidden, and the article stays as it was', async () => {
    const { plants, slugs } = await givenCompany(db.ownerUrl);
    const [plant = ''] = plants;
    const [slug = ''] = slugs;
    const planner = await clientAt(plant);
    const { id } = await create(planner, 'DR-200', 'Drawer runner');
    // core.article:create is a write permission, so row-level security lets this user write at
    // the plant; only the permission step refuses the update.
    const creator = await clientWith(slug, [
      { scopeId: plant, permissions: ['core.article:read', 'core.article:create'] },
    ]);

    const answer = await creator.send(updateMutation, {
      input: { id, expectedVersion: 1, code: 'DR-201', name: 'Drawer runner, soft close' },
    });

    expect(answer).toMatchObject(updateForbidden(id));
    expect(await readArticle(planner, id)).toEqual({
      id,
      code: 'DR-200',
      name: 'Drawer runner',
      version: 1,
    });
  });

  it('E05-S06 a user who holds core.article:update at a sibling plant gets FORBIDDEN core.forbidden on an article at the other plant', async () => {
    const { plants, slugs } = await givenCompany(db.ownerUrl, { plants: 2 });
    const [plantA = '', plantB = ''] = plants;
    const [slugA = ''] = slugs;
    const planner = await clientAt(plantA);
    const { id } = await create(planner, 'KN-300', 'Cabinet knob');
    // The user reads articles at plant A and updates them at plant B only.
    const plantBEditor = await clientWith(slugA, [
      { scopeId: plantA, permissions: ['core.article:read'] },
      { scopeId: plantB, permissions: ['core.article:read', 'core.article:update'] },
    ]);

    const answer = await plantBEditor.send(updateMutation, {
      input: { id, expectedVersion: 1, code: 'KN-301', name: 'Cabinet knob, brass' },
    });

    expect(answer).toMatchObject(updateForbidden(id));
    expect(await readArticle(planner, id)).toMatchObject({ code: 'KN-300', version: 1 });
  });

  /** Writes an article of `company` assigned to All plants, so its edit scope is the company. */
  function writeCompanyArticle(company: string, code: string, name: string): Promise<string> {
    return givenArticle(db.ownerUrl, { code, name, company, allPlants: true });
  }

  it('E05-S06 a plant planner who updates articles at the plant gets FORBIDDEN core.forbidden on an article of All plants, whose edit scope is the company, which the planner reads', async () => {
    const { company, plants, slugs } = await givenCompany(db.ownerUrl);
    const [plant = ''] = plants;
    const [slug = ''] = slugs;
    const id = await writeCompanyArticle(company, 'FR-500', 'Frame rail');
    const plantPlanner = await clientWith(slug, [
      { scopeId: plant, permissions: ['core.article:read', 'core.article:update'] },
    ]);
    expect(await readArticle(plantPlanner, id)).toMatchObject({ code: 'FR-500', version: 1 });

    const answer = await plantPlanner.send(updateMutation, {
      input: { id, expectedVersion: 1, code: 'FR-501', name: 'Frame rail, long' },
    });

    expect(answer).toMatchObject(updateForbidden(id));
    expect(await readArticle(plantPlanner, id)).toMatchObject({ code: 'FR-500', version: 1 });
  });

  it('E05-S06 a user without core.article:create at the plant gets FORBIDDEN core.forbidden from coreCreateArticle', async () => {
    const { plants, slugs } = await givenCompany(db.ownerUrl);
    const [plant = ''] = plants;
    const [slug = ''] = slugs;
    const editor = await clientWith(slug, [
      { scopeId: plant, permissions: ['core.article:read', 'core.article:update'] },
    ]);

    const answer = await editor.send(createMutation, {
      input: { id: randomUUIDv7(), code: 'HK-400', name: 'Coat hook' },
    });

    expect(answer).toMatchObject({
      status: 200,
      data: null,
      errors: [
        {
          message: `You need core.article:create at scope ${plant}`,
          path: ['coreCreateArticle'],
          extensions: { code: 'FORBIDDEN', errorCode: 'core.forbidden' },
        },
      ],
    });
    const listed = await editor.send<{ coreArticles: { totalCount: number } }>(
      '{ coreArticles { totalCount } }',
    );
    expect(listed.data?.coreArticles.totalCount).toBe(0);
  });
});
