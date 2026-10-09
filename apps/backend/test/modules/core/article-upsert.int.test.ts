// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes, randomUUIDv7 } from 'node:crypto';
import {
  type GivenCompany,
  givenArticle,
  givenAssignment,
  givenCompany,
  hostFactory,
  queryAsCore,
  signIn,
} from '@northmes/backend/testing';
import {
  createTestApp,
  type GqlClient,
  gqlClient,
  type TestApp,
  useTestDatabase,
} from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const articleFields = 'id code name version allPlants plants { slug } archivedAt';

const upsertMutation = `mutation ($input: CoreUpsertArticleInput!) {
  coreUpsertArticle(input: $input) { ${articleFields} }
}`;

interface Article {
  id: string;
  code: string;
  name: string;
  version: number;
  allPlants: boolean;
  plants: { slug: string }[];
  archivedAt: string | null;
}

interface UpsertAnswer {
  readonly data?: { coreUpsertArticle: Article } | null;
  readonly errors?: readonly { message: string; extensions?: Record<string, unknown> }[];
}

/** The GraphQL code and errorCode of each error of an answer. */
function refusals(answer: UpsertAnswer) {
  return answer.errors?.map(({ extensions = {} }) => ({
    code: extensions.code,
    errorCode: extensions.errorCode,
  }));
}

describe('upsert of an article by its article number', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core', 'planning'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /** A company with the plants HEL and STO, by those names. */
  async function givenHelAndSto(): Promise<GivenCompany & { hel: string; sto: string }> {
    const company = await givenCompany(db.ownerUrl, { plantNames: ['HEL', 'STO'] });
    const [hel = '', sto = ''] = company.plants;
    return { ...company, hel, sto };
  }

  /**
   * A client of a fresh user who holds the default role `key` of the company at `scopeId`, at the
   * plant whose slug is `slug`, or without a plant.
   */
  async function holderOf(
    key: 'core-company-admin' | 'core-plant-admin',
    { company, scopeId, slug }: { company: string; scopeId: string; slug?: string },
  ): Promise<GqlClient> {
    if (!testApp) throw new Error('the test app did not start');
    const user = await signIn(testApp.app, db.ownerUrl, []);
    const [role] = await queryAsCore<{ id: string }>(
      db.ownerUrl,
      'select id from core.role where company_id = $1 and key = $2',
      [company, key],
    );
    if (!role) throw new Error(`the company has no role ${key}`);
    await givenAssignment(db.ownerUrl, { userId: user.userId, roleId: role.id, scopeId });
    const headers: Record<string, string> = { authorization: user.authorization };
    if (slug !== undefined) headers['x-northmes-plant'] = slug;
    return gqlClient(await testApp.app.getUrl(), { headers });
  }

  /** A Plant admin at HEL and a Company admin at the company, without a plant. */
  async function admins(place: GivenCompany & { hel: string }) {
    const [helSlug = ''] = place.slugs;
    const helAdmin = await holderOf('core-plant-admin', {
      company: place.company,
      scopeId: place.hel,
      slug: helSlug,
    });
    const companyAdmin = await holderOf('core-company-admin', {
      company: place.company,
      scopeId: place.company,
    });
    return { helAdmin, companyAdmin, helSlug };
  }

  function upsert(client: GqlClient, input: Record<string, unknown>) {
    return client.send<{ coreUpsertArticle: Article }>(upsertMutation, {
      input,
    }) as Promise<UpsertAnswer>;
  }

  /** A code no other test uses. */
  const code = (prefix: string) => `${prefix}-${randomBytes(3).toString('hex')}`;

  it('ADR0073-W3 an upsert with a new article number creates the article under its id, assigned to the request plant', async () => {
    const place = await givenHelAndSto();
    const { helAdmin, helSlug } = await admins(place);
    const id = randomUUIDv7();
    const number = code('UP');

    const answer = await upsert(helAdmin, { id, code: number, name: 'Bolt' });

    expect(answer.errors).toBeUndefined();
    expect(answer.data?.coreUpsertArticle).toMatchObject({
      id,
      code: number,
      name: 'Bolt',
      version: 1,
      allPlants: false,
      plants: [{ slug: helSlug }],
    });
  });

  it('ADR0073-W3 concurrent upserts of one new article number create it once and both answer it', async () => {
    const place = await givenHelAndSto();
    const { helAdmin } = await admins(place);
    const number = code('RACE');

    const answers = await Promise.all(
      Array.from({ length: 4 }, () =>
        upsert(helAdmin, { id: randomUUIDv7(), code: number, name: 'Bolt' }),
      ),
    );

    expect(answers.flatMap((answer) => refusals(answer) ?? [])).toEqual([]);
    const ids = new Set(answers.map((answer) => answer.data?.coreUpsertArticle.id));
    expect(ids.size).toBe(1);
  });

  it('ADR0073-W3 an upsert finds an article whose number has a letter that lowercases differently in JavaScript and Postgres', async () => {
    const place = await givenHelAndSto();
    const { helAdmin } = await admins(place);
    const number = code('İX');
    const created = await upsert(helAdmin, { id: randomUUIDv7(), code: number, name: 'Bolt' });

    const answer = await upsert(helAdmin, { id: randomUUIDv7(), code: number, name: 'Bolt M8' });

    expect(refusals(answer)).toBeUndefined();
    expect(answer.data?.coreUpsertArticle).toMatchObject({
      id: created.data?.coreUpsertArticle.id,
      name: 'Bolt M8',
    });
  });

  it('ADR0073-W3 an upsert from company settings without plants creates an unassigned article', async () => {
    const place = await givenHelAndSto();
    const { companyAdmin } = await admins(place);

    const answer = await upsert(companyAdmin, {
      id: randomUUIDv7(),
      code: code('UP'),
      name: 'Nut',
      companyId: place.company,
    });

    expect(answer.errors).toBeUndefined();
    expect(answer.data?.coreUpsertArticle).toMatchObject({ allPlants: false, plants: [] });
  });

  it('ADR0073-W3 an upsert with the same number and name answers the stored article with the same version', async () => {
    const place = await givenHelAndSto();
    const { helAdmin } = await admins(place);
    const number = code('UP');
    const id = await givenArticle(db.ownerUrl, { code: number, name: 'Bolt', plants: [place.hel] });

    const answer = await upsert(helAdmin, { id: randomUUIDv7(), code: number, name: 'Bolt' });

    expect(answer.errors).toBeUndefined();
    expect(answer.data?.coreUpsertArticle).toMatchObject({ id, name: 'Bolt', version: 1 });
  });

  it('ADR0073-W3 an upsert that finds the number without regard to case renames the article and bumps its version', async () => {
    const place = await givenHelAndSto();
    const { helAdmin } = await admins(place);
    const number = code('up');
    const id = await givenArticle(db.ownerUrl, { code: number, name: 'Bolt', plants: [place.hel] });

    const answer = await upsert(helAdmin, {
      id: randomUUIDv7(),
      code: number.toUpperCase(),
      name: 'Bolt M8',
    });

    expect(answer.errors).toBeUndefined();
    expect(answer.data?.coreUpsertArticle).toMatchObject({
      id,
      code: number,
      name: 'Bolt M8',
      version: 2,
    });
  });

  it('ADR0073-W3 a Plant admin at HEL gets core.forbidden renaming an article of HEL and STO, and the same push with the unchanged name answers the article', async () => {
    const place = await givenHelAndSto();
    const { helAdmin } = await admins(place);
    const number = code('UP');
    const id = await givenArticle(db.ownerUrl, {
      code: number,
      name: 'Bolt',
      plants: [place.hel, place.sto],
    });

    const renamed = await upsert(helAdmin, { id: randomUUIDv7(), code: number, name: 'Bolt M8' });
    const unchanged = await upsert(helAdmin, { id: randomUUIDv7(), code: number, name: 'Bolt' });

    expect(refusals(renamed)).toEqual([{ code: 'FORBIDDEN', errorCode: 'core.forbidden' }]);
    expect(unchanged.errors).toBeUndefined();
    expect(unchanged.data?.coreUpsertArticle).toMatchObject({ id, name: 'Bolt', version: 1 });
  });

  it('ADR0073-W3 an upsert with plants from a user without core.article:assign at the company gets core.forbidden', async () => {
    const place = await givenHelAndSto();
    const { helAdmin } = await admins(place);
    const [helSlug = '', stoSlug = ''] = place.slugs;
    const number = code('UP');
    await givenArticle(db.ownerUrl, { code: number, name: 'Bolt', plants: [place.hel] });

    const onExisting = await upsert(helAdmin, {
      id: randomUUIDv7(),
      code: number,
      name: 'Bolt',
      plants: [helSlug, stoSlug],
    });
    const onNew = await upsert(helAdmin, {
      id: randomUUIDv7(),
      code: code('UP'),
      name: 'Nut',
      allPlants: true,
    });

    expect(refusals(onExisting)).toEqual([{ code: 'FORBIDDEN', errorCode: 'core.forbidden' }]);
    expect(refusals(onNew)).toEqual([{ code: 'FORBIDDEN', errorCode: 'core.forbidden' }]);
  });

  it('ADR0073-W3 an upsert with other plants from a Company admin replaces the plants, and one without plants leaves them as they are', async () => {
    const place = await givenHelAndSto();
    const { companyAdmin } = await admins(place);
    const [helSlug = '', stoSlug = ''] = place.slugs;
    const number = code('UP');
    const id = await givenArticle(db.ownerUrl, { code: number, name: 'Bolt', plants: [place.hel] });

    const assigned = await upsert(companyAdmin, {
      id: randomUUIDv7(),
      code: number,
      name: 'Bolt',
      plants: [helSlug, stoSlug],
      companyId: place.company,
    });
    const kept = await upsert(companyAdmin, {
      id: randomUUIDv7(),
      code: number,
      name: 'Bolt',
      companyId: place.company,
    });

    expect(assigned.errors).toBeUndefined();
    expect(assigned.data?.coreUpsertArticle).toMatchObject({ id, version: 2 });
    expect(assigned.data?.coreUpsertArticle.plants.map(({ slug }) => slug).sort()).toEqual(
      [helSlug, stoSlug].sort(),
    );
    expect(kept.data?.coreUpsertArticle).toMatchObject({ id, version: 2 });
    expect(kept.data?.coreUpsertArticle.plants).toHaveLength(2);
  });

  it('ADR0073-W3 an upsert with a stale expectedVersion gets core.version_conflict', async () => {
    const place = await givenHelAndSto();
    const { helAdmin } = await admins(place);
    const number = code('UP');
    await givenArticle(db.ownerUrl, { code: number, name: 'Bolt', plants: [place.hel] });

    const answer = await upsert(helAdmin, {
      id: randomUUIDv7(),
      code: number,
      name: 'Bolt M8',
      expectedVersion: 7,
    });

    expect(refusals(answer)).toEqual([{ code: 'CONFLICT', errorCode: 'core.version_conflict' }]);
  });

  it('ADR0073-W3 an upsert on an archived article gets core.archived', async () => {
    const place = await givenHelAndSto();
    const { helAdmin } = await admins(place);
    const number = code('UP');
    await givenArticle(db.ownerUrl, {
      code: number,
      name: 'Bolt',
      plants: [place.hel],
      archivedAt: new Date('2026-10-01T00:00:00Z'),
    });

    const answer = await upsert(helAdmin, { id: randomUUIDv7(), code: number, name: 'Bolt' });

    expect(refusals(answer)).toEqual([{ code: 'PRECONDITION', errorCode: 'core.archived' }]);
  });

  it('ADR0073-W3 a user without core.article:create at the plant gets core.forbidden even for an unchanged article', async () => {
    const place = await givenHelAndSto();
    const [helSlug = ''] = place.slugs;
    if (!testApp) throw new Error('the test app did not start');
    const reader = await signIn(testApp.app, db.ownerUrl, [
      { scopeId: place.hel, permissions: ['core.article:read', 'core.article:update'] },
    ]);
    const client = gqlClient(await testApp.app.getUrl(), {
      headers: { authorization: reader.authorization, 'x-northmes-plant': helSlug },
    });
    const number = code('UP');
    await givenArticle(db.ownerUrl, { code: number, name: 'Bolt', plants: [place.hel] });

    const answer = await upsert(client, { id: randomUUIDv7(), code: number, name: 'Bolt' });

    expect(refusals(answer)).toEqual([{ code: 'FORBIDDEN', errorCode: 'core.forbidden' }]);
  });
});
