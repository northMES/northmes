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

const fields = 'id code name version archivedAt';

const createMutation = `mutation ($input: CoreCreateArticleInput!) {
  coreCreateArticle(input: $input) { ${fields} }
}`;

const archiveMutation = `mutation ($input: CoreArchiveArticleInput!) {
  coreArchiveArticle(input: $input) { ${fields} }
}`;

const restoreMutation = `mutation ($input: CoreRestoreArticleInput!) {
  coreRestoreArticle(input: $input) { ${fields} }
}`;

const updateMutation = `mutation ($input: CoreUpdateArticleInput!) {
  coreUpdateArticle(input: $input) { ${fields} }
}`;

const articleQuery = `query ($id: ID!) { coreArticle(id: $id) { ${fields} } }`;

const articlesQuery = `query ($includeArchived: Boolean) {
  coreArticles(includeArchived: $includeArchived) { totalCount edges { node { code archivedAt } } }
}`;

interface Article {
  id: string;
  code: string;
  name: string;
  version: number;
  archivedAt: string | null;
}

interface ArticlesAnswer {
  coreArticles: {
    totalCount: number;
    edges: { node: Pick<Article, 'code' | 'archivedAt'> }[];
  };
}

/** An ISO 8601 instant, as the DateTime scalar writes it. */
const isoInstant = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);

describe('coreArchiveArticle and coreRestoreArticle', () => {
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

  /** Creates an article through coreCreateArticle and returns it. */
  async function create(client: GqlClient, code: string, name: string): Promise<Article> {
    const answer = await client.send<{ coreCreateArticle: Article }>(createMutation, {
      input: { id: randomUUIDv7(), code, name },
    });
    if (!answer.data) throw new Error(`the create failed: ${JSON.stringify(answer.errors)}`);
    return answer.data.coreCreateArticle;
  }

  /** Archives an article through coreArchiveArticle and returns it. */
  async function archive(client: GqlClient, article: Article): Promise<Article> {
    const answer = await client.send<{ coreArchiveArticle: Article }>(archiveMutation, {
      input: { id: article.id, expectedVersion: article.version },
    });
    if (!answer.data) throw new Error(`the archive failed: ${JSON.stringify(answer.errors)}`);
    return answer.data.coreArchiveArticle;
  }

  /** The article with `id` as coreArticle reads it. */
  async function readArticle(client: GqlClient, id: string): Promise<Article | null | undefined> {
    const answer = await client.send<{ coreArticle: Article | null }>(articleQuery, { id });
    return answer.data?.coreArticle;
  }

  it('E06-S06 a new article is not archived', async () => {
    const client = await clientAt(given.plant());

    const article = await create(client, 'BR-140', 'Wall bracket');

    expect(article.archivedAt).toBeNull();
  });

  it('E06-S06 coreArchiveArticle sets archivedAt and bumps the version, and coreArticle still reads the article', async () => {
    const client = await clientAt(given.plant());
    const article = await create(client, 'BR-150', 'Wall bracket, wide');

    const answer = await client.send(archiveMutation, {
      input: { id: article.id, expectedVersion: 1 },
    });

    const archived = { ...article, version: 2, archivedAt: isoInstant };
    expect(answer).toEqual({ status: 200, data: { coreArchiveArticle: archived } });
    expect(await readArticle(client, article.id)).toEqual(archived);
  });

  it('E06-S06 coreArticles hides archived articles unless includeArchived is true', async () => {
    const client = await clientAt(given.plant());
    await create(client, 'CW-220', 'Caster wheel');
    await archive(client, await create(client, 'CW-230', 'Caster wheel, braked'));

    const active = await client.send<ArticlesAnswer>(articlesQuery, {});
    const all = await client.send<ArticlesAnswer>(articlesQuery, { includeArchived: true });

    expect(active.data?.coreArticles).toEqual({
      totalCount: 1,
      edges: [{ node: { code: 'CW-220', archivedAt: null } }],
    });
    expect(all.data?.coreArticles).toEqual({
      totalCount: 2,
      edges: [
        { node: { code: 'CW-220', archivedAt: null } },
        { node: { code: 'CW-230', archivedAt: isoInstant } },
      ],
    });
  });

  it('E06-S06 coreRestoreArticle clears archivedAt, bumps the version and lists the article again', async () => {
    const client = await clientAt(given.plant());
    const archived = await archive(client, await create(client, 'HG-110', 'Cabinet hinge'));

    const answer = await client.send(restoreMutation, {
      input: { id: archived.id, expectedVersion: 2 },
    });

    const restored = { ...archived, version: 3, archivedAt: null };
    expect(answer).toEqual({ status: 200, data: { coreRestoreArticle: restored } });
    const listed = await client.send<ArticlesAnswer>(articlesQuery, {});
    expect(listed.data?.coreArticles.edges).toEqual([
      { node: { code: 'HG-110', archivedAt: null } },
    ]);
  });

  it('E06-S06 coreUpdateArticle of an archived article returns core.archived and changes nothing', async () => {
    const client = await clientAt(given.plant());
    const archived = await archive(client, await create(client, 'SB-500', 'Shelf board'));

    const answer = await client.send(updateMutation, {
      input: { id: archived.id, expectedVersion: 2, code: 'SB-501', name: 'Shelf board, oak' },
    });

    expect(answer).toMatchObject({
      status: 200,
      data: null,
      errors: [
        {
          message: `Article SB-500 is archived, and an archived article cannot be changed until it is restored`,
          path: ['coreUpdateArticle'],
          extensions: { code: 'PRECONDITION', errorCode: 'core.archived' },
        },
      ],
    });
    expect(await readArticle(client, archived.id)).toEqual(archived);
  });

  it('E06-S06 coreArchiveArticle of an archived article returns core.archived and changes nothing', async () => {
    const client = await clientAt(given.plant());
    const archived = await archive(client, await create(client, 'PN-305', 'Side panel'));

    const answer = await client.send(archiveMutation, {
      input: { id: archived.id, expectedVersion: 2 },
    });

    expect(answer).toMatchObject({
      data: null,
      errors: [{ extensions: { code: 'PRECONDITION', errorCode: 'core.archived' } }],
    });
    expect(await readArticle(client, archived.id)).toEqual(archived);
  });

  it('E06-S06 coreRestoreArticle of an article that is not archived returns core.not_archived and changes nothing', async () => {
    const client = await clientAt(given.plant());
    const article = await create(client, 'PN-310', 'Side panel, left');

    const answer = await client.send(restoreMutation, {
      input: { id: article.id, expectedVersion: 1 },
    });

    expect(answer).toMatchObject({
      data: null,
      errors: [
        {
          message: 'Article PN-310 is not archived, so there is nothing to restore',
          extensions: { code: 'PRECONDITION', errorCode: 'core.not_archived' },
        },
      ],
    });
    expect(await readArticle(client, article.id)).toEqual(article);
  });

  it('E06-S06 coreArchiveArticle with a stale expectedVersion returns core.version_conflict and changes nothing', async () => {
    const client = await clientAt(given.plant());
    const article = await create(client, 'ZZ-001', 'Assembly screw');
    await client.send(updateMutation, {
      input: { id: article.id, expectedVersion: 1, code: 'ZZ-001', name: 'Assembly screw, M4' },
    });

    const answer = await client.send(archiveMutation, {
      input: { id: article.id, expectedVersion: 1 },
    });

    expect(answer).toMatchObject({
      data: null,
      errors: [{ extensions: { code: 'CONFLICT', errorCode: 'core.version_conflict' } }],
    });
    expect(await readArticle(client, article.id)).toMatchObject({ version: 2, archivedAt: null });
  });

  it("E06-S06 coreArchiveArticle and coreRestoreArticle of another plant's article return NOT_FOUND", async () => {
    const otherPlant = await clientAt(given.plant());
    const other = await create(otherPlant, 'WB-100', 'Wall bracket');
    const client = await clientAt(given.plant());

    for (const mutation of [archiveMutation, restoreMutation]) {
      const answer = await client.send(mutation, {
        input: { id: other.id, expectedVersion: 1 },
      });

      expect(answer).toMatchObject({
        data: null,
        errors: [
          { message: `Article ${other.id} was not found`, extensions: { code: 'NOT_FOUND' } },
        ],
      });
    }
    expect(await readArticle(otherPlant, other.id)).toEqual(other);
  });
});
