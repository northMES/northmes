// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
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

const fields = 'id name version translations { field locale text }';

const createMutation = `mutation ($input: CoreCreateArticleInput!) {
  coreCreateArticle(input: $input) { ${fields} }
}`;

const updateMutation = `mutation ($input: CoreUpdateArticleInput!) {
  coreUpdateArticle(input: $input) { ${fields} }
}`;

const upsertMutation = `mutation ($input: CoreUpsertArticleInput!) {
  coreUpsertArticle(input: $input) { ${fields} }
}`;

interface Translation {
  field: string;
  locale: string;
  text: string;
}

interface Article {
  id: string;
  name: string;
  version: number;
  translations: Translation[];
}

interface Answer<Field extends string> {
  readonly data?: Record<Field, Article | null> | null;
  readonly errors?: readonly { message: string; extensions?: Record<string, unknown> }[];
}

const english = { field: 'name', locale: 'en', text: 'Flange DN50 stainless' };
const german = { field: 'name', locale: 'de', text: 'Flansch DN50 Edelstahl' };

describe("an article's name translations", () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

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

  it('E06-S06 a new article has no translations unless it is given some, which it keeps in canonical form', async () => {
    const gql = await client();

    const plain = await create(gql, {});
    const translated = await create(gql, {
      translations: [{ ...english, locale: 'EN', text: ' Flange DN50 stainless ' }, german],
    });

    expect(plain.answer.data?.coreCreateArticle?.translations).toEqual([]);
    expect(translated.answer.data?.coreCreateArticle?.translations).toEqual([english, german]);
  });

  it('E06-S06 coreUpdateArticle replaces the translations it is given, an empty list removes them, and a left-out list keeps them', async () => {
    const gql = await client();
    const { id } = await create(gql, { translations: [english] });
    const base = { id, code: `AX-${id.slice(-6)}`, name: 'Fläns DN50 rostfri' };

    const replaced: Answer<'coreUpdateArticle'> = await gql.send(updateMutation, {
      input: { ...base, expectedVersion: 1, translations: [german] },
    });
    const kept: Answer<'coreUpdateArticle'> = await gql.send(updateMutation, {
      input: { ...base, expectedVersion: 2 },
    });
    const removed: Answer<'coreUpdateArticle'> = await gql.send(updateMutation, {
      input: { ...base, expectedVersion: 3, translations: [] },
    });

    expect(replaced.data?.coreUpdateArticle?.translations).toEqual([german]);
    expect(kept.data?.coreUpdateArticle?.translations).toEqual([german]);
    expect(removed.data?.coreUpdateArticle?.translations).toEqual([]);
  });

  it('E06-S06 two translations of the name into one language are refused on the second one', async () => {
    const gql = await client();

    const { answer } = await create(gql, {
      translations: [english, { ...english, text: 'Flange, stainless' }],
    });

    expect(answer.errors?.[0]?.extensions).toMatchObject({
      code: 'BAD_USER_INPUT',
      fieldErrors: [
        {
          path: ['translations', 1, 'locale'],
          message: 'The name already has a translation into this language.',
        },
      ],
    });
  });

  it('E06-S06 an article translates only its name', async () => {
    const gql = await client();

    const { answer } = await create(gql, {
      translations: [{ field: 'note', locale: 'en', text: 'Drawing rev C' }],
    });

    expect(answer.errors?.[0]?.extensions).toMatchObject({
      code: 'BAD_USER_INPUT',
      fieldErrors: [{ path: ['translations', 0, 'field'] }],
    });
  });

  it('E06-S06 coreUpsertArticle replaces the translations it is given when they differ, and leaves them when it is given none', async () => {
    const gql = await client();
    const id = randomUUIDv7();
    const input = { id, code: `AX-${id.slice(-6)}`, name: 'Hydraulslang', source: 'Pyramid' };
    await gql.send(upsertMutation, { input: { ...input, translations: [english] } });

    const same: Answer<'coreUpsertArticle'> = await gql.send(upsertMutation, {
      input: { ...input, translations: [{ ...english, locale: 'EN' }] },
    });
    const other: Answer<'coreUpsertArticle'> = await gql.send(upsertMutation, {
      input: { ...input, translations: [german] },
    });
    const none: Answer<'coreUpsertArticle'> = await gql.send(upsertMutation, { input });

    expect(same.data?.coreUpsertArticle).toMatchObject({ version: 1, translations: [english] });
    expect(other.data?.coreUpsertArticle).toMatchObject({ version: 2, translations: [german] });
    expect(none.data?.coreUpsertArticle).toMatchObject({ version: 2, translations: [german] });
  });

  it('E06-S06 the translations column holds a JSON array, also for an article written by plain SQL', async () => {
    const gql = await client();
    const { id } = await create(gql, {});

    await expect(
      queryAsCore(db.ownerUrl, `update core.article set translations = '{}' where id = $1`, [id]),
    ).rejects.toThrow(/article_translations_check/);
  });
});
