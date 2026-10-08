// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUIDv7 } from 'node:crypto';
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

  /** A GraphQL client for the test app that names `plant` in x-northmes-plant. */
  async function clientAt(plant: string): Promise<GqlClient> {
    if (!testApp) throw new Error('the test app did not start');
    return gqlClient(await testApp.app.getUrl(), { headers: { 'x-northmes-plant': plant } });
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
});
