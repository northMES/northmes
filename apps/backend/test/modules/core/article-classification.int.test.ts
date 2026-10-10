// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUIDv7 } from 'node:crypto';
import { hostFactory, queryAsCore, signInAt } from '@northmes/backend/testing';
import {
  createTestApp,
  type GqlClient,
  given,
  gqlClient,
  type TestApp,
  useTestDatabase,
} from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const fields = 'id stockUnit note source createdAt updatedAt version';

const createMutation = `mutation ($input: CoreCreateArticleInput!) {
  coreCreateArticle(input: $input) { ${fields} }
}`;

const updateMutation = `mutation ($input: CoreUpdateArticleInput!) {
  coreUpdateArticle(input: $input) { ${fields} }
}`;

const upsertMutation = `mutation ($input: CoreUpsertArticleInput!) {
  coreUpsertArticle(input: $input) { ${fields} }
}`;

const articleQuery = `query ($id: ID!) { coreArticle(id: $id) { ${fields} } }`;

interface Article {
  id: string;
  stockUnit: string;
  note: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

interface Answer<Field extends string> {
  readonly data?: Record<Field, Article | null> | null;
  readonly errors?: readonly { message: string; extensions?: Record<string, unknown> }[];
}

describe("an article's stock unit, note, source and creation time", () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /** A client signed in as a user who holds every permission at a new plant, at that plant. */
  async function client(): Promise<GqlClient> {
    if (!testApp) throw new Error('the test app did not start');
    const headers = await signInAt(testApp.app, db.ownerUrl, given.plant());
    return gqlClient(await testApp.app.getUrl(), { headers });
  }

  async function create(gql: GqlClient, input: Record<string, unknown>) {
    const id = randomUUIDv7();
    const answer: Answer<'coreCreateArticle'> = await gql.send(createMutation, {
      input: { id, code: `AX-${id.slice(-6)}`, name: 'Fläns DN50 rostfri', ...input },
    });
    return { id, answer };
  }

  async function read(gql: GqlClient, id: string): Promise<Article | null | undefined> {
    const answer: Answer<'coreArticle'> = await gql.send(articleQuery, { id });
    return answer.data?.coreArticle;
  }

  it('E06-S06 a new article counts in pieces, has no note, comes from NorthMES and keeps when it was created', async () => {
    const gql = await client();
    const before = Date.now();

    const { id, answer } = await create(gql, {});

    const article = answer.data?.coreCreateArticle;
    expect(article).toMatchObject({ stockUnit: 'PIECE', note: null, source: null, version: 1 });
    expect(Date.parse(article?.createdAt ?? '')).toBeGreaterThanOrEqual(before - 1000);
    expect(article?.createdAt).toBe(article?.updatedAt);
    expect(await read(gql, id)).toEqual(article);
  });

  it('E06-S06 coreCreateArticle keeps the stock unit and the trimmed note it is given', async () => {
    const gql = await client();

    const { id } = await create(gql, {
      stockUnit: 'METRE',
      note: '  Ritning rev C gäller från vecka 2026-W41. ',
    });

    expect(await read(gql, id)).toMatchObject({
      stockUnit: 'METRE',
      note: 'Ritning rev C gäller från vecka 2026-W41.',
    });
  });

  it('E06-S06 a stock unit outside the catalog is refused on stockUnit with the form message', async () => {
    const gql = await client();

    const { answer } = await create(gql, { stockUnit: 'GALLON' });

    expect(answer.errors?.[0]?.extensions).toMatchObject({
      code: 'BAD_USER_INPUT',
      fieldErrors: [{ path: ['stockUnit'], message: 'Choose a stock unit.' }],
    });
  });

  it('E06-S06 a note longer than 2000 characters is refused on note', async () => {
    const gql = await client();

    const { answer } = await create(gql, { note: 'x'.repeat(2001) });

    expect(answer.errors?.[0]?.extensions).toMatchObject({
      code: 'BAD_USER_INPUT',
      fieldErrors: [
        { path: ['note'], message: 'Note can be at most 2000 characters. It has 2001.' },
      ],
    });
  });

  it('E06-S06 coreUpdateArticle changes the stock unit and the note, and an empty note removes it', async () => {
    const gql = await client();
    const { id, answer } = await create(gql, { note: 'Old note' });
    const code = 'AX-20410';

    const changed: Answer<'coreUpdateArticle'> = await gql.send(updateMutation, {
      input: { id, expectedVersion: 1, code, name: 'Fläns', stockUnit: 'KILOGRAM', note: 'New' },
    });
    const cleared: Answer<'coreUpdateArticle'> = await gql.send(updateMutation, {
      input: { id, expectedVersion: 2, code, name: 'Fläns', note: '  ' },
    });

    expect(changed.data?.coreUpdateArticle).toMatchObject({ stockUnit: 'KILOGRAM', note: 'New' });
    // A field the input leaves out stays as it is.
    expect(cleared.data?.coreUpdateArticle).toMatchObject({
      stockUnit: 'KILOGRAM',
      note: null,
      version: 3,
      createdAt: answer.data?.coreCreateArticle?.createdAt,
    });
  });

  it("E06-S06 coreUpsertArticle writes the integration's name as the source of an article it creates and never changes it", async () => {
    const gql = await client();
    const id = randomUUIDv7();
    const input = { id, code: 'AX-31007', name: 'Hydraulslang 12 mm', source: 'Pyramid' };

    const created: Answer<'coreUpsertArticle'> = await gql.send(upsertMutation, { input });
    const renamed: Answer<'coreUpsertArticle'> = await gql.send(upsertMutation, {
      input: { ...input, id: randomUUIDv7(), name: 'Hydraulslang 12', source: 'Monitor' },
    });

    expect(created.data?.coreUpsertArticle).toMatchObject({
      id,
      source: 'Pyramid',
      stockUnit: 'PIECE',
    });
    expect(renamed.data?.coreUpsertArticle).toMatchObject({ id, source: 'Pyramid', version: 2 });
  });

  it('E06-S06 coreUpsertArticle sets the stock unit and the note it is given, and leaves out ones it is not', async () => {
    const gql = await client();
    const id = randomUUIDv7();
    const input = { id, code: 'AX-31008', name: 'Hydraulslang 16 mm', source: 'Pyramid' };
    await gql.send(upsertMutation, {
      input: { ...input, stockUnit: 'METRE', note: 'Från Pyramid' },
    });

    const again: Answer<'coreUpsertArticle'> = await gql.send(upsertMutation, { input });

    expect(again.data?.coreUpsertArticle).toMatchObject({
      stockUnit: 'METRE',
      note: 'Från Pyramid',
      version: 1,
    });
  });

  it('E06-S06 coreUpsertArticle needs the name of the integration that sends it', async () => {
    const gql = await client();

    const answer: Answer<'coreUpsertArticle'> = await gql.send(upsertMutation, {
      input: { id: randomUUIDv7(), code: 'AX-31009', name: 'Sugslang 50 mm', source: ' ' },
    });

    expect(answer.errors?.[0]?.extensions).toMatchObject({
      code: 'BAD_USER_INPUT',
      fieldErrors: [{ path: ['source'] }],
    });
  });

  it('E06-S06 the stock unit column refuses a code outside the catalog, also from plain SQL', async () => {
    const gql = await client();
    const { id } = await create(gql, {});

    await expect(
      queryAsCore(db.ownerUrl, "update core.article set stock_unit = 'GALLON' where id = $1", [id]),
    ).rejects.toThrow(/article_stock_unit_check/);
  });
});
