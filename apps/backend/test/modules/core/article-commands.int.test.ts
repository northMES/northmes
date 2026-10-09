// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUIDv7 } from 'node:crypto';
import { hostFactory, signInAt } from '@northmes/backend/testing';
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

  it('E06-S06 coreCreateArticle without x-northmes-plant returns FORBIDDEN without an errorCode', async () => {
    if (!testApp) throw new Error('the test app did not start');
    const { authorization } = await signInAt(testApp.app, db.ownerUrl, given.plant());
    const client = gqlClient(await testApp.app.getUrl(), { headers: { authorization } });

    const answer = await client.send(createMutation, {
      input: { id: randomUUIDv7(), code: 'PN-305', name: 'Side panel' },
    });

    expect(answer).toMatchObject({
      status: 200,
      data: null,
      errors: [
        {
          message: 'The request names no plant, so it cannot create an article',
          extensions: { code: 'FORBIDDEN' },
        },
      ],
    });
    expect(answer.errors?.[0]?.extensions).not.toHaveProperty('errorCode');
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
});
