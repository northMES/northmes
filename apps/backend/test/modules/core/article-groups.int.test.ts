// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { randomUUIDv7 } from 'node:crypto';
import {
  type GivenCompany,
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

const groupFields = 'id code name version archivedAt';

const createGroup = `mutation ($input: CoreCreateArticleGroupInput!) {
  coreCreateArticleGroup(input: $input) { ${groupFields} }
}`;

const updateGroup = `mutation ($input: CoreUpdateArticleGroupInput!) {
  coreUpdateArticleGroup(input: $input) { ${groupFields} }
}`;

const archiveGroup = `mutation ($input: CoreArchiveArticleGroupInput!) {
  coreArchiveArticleGroup(input: $input) { ${groupFields} }
}`;

const restoreGroup = `mutation ($input: CoreRestoreArticleGroupInput!) {
  coreRestoreArticleGroup(input: $input) { ${groupFields} }
}`;

const listGroups = `query ($includeArchived: Boolean) {
  coreArticleGroups(includeArchived: $includeArchived, orderBy: [{ field: CODE, direction: ASC }]) {
    totalCount
    edges { node { code name } }
  }
}`;

const createArticle = `mutation ($input: CoreCreateArticleInput!) {
  coreCreateArticle(input: $input) { id version articleGroup { id code name } }
}`;

const updateArticle = `mutation ($input: CoreUpdateArticleInput!) {
  coreUpdateArticle(input: $input) { id version articleGroup { id code name } }
}`;

interface Group {
  id: string;
  code: string;
  name: string;
  version: number;
  archivedAt: string | null;
}

interface Answer {
  readonly data?: Record<string, unknown> | null;
  readonly errors?: readonly { message: string; extensions?: Record<string, unknown> }[];
}

/** The GraphQL code and errorCode of an answer's first error. */
function refusal(answer: Answer) {
  const extensions = answer.errors?.[0]?.extensions ?? {};
  return { code: extensions.code, errorCode: extensions.errorCode };
}

const forbidden = { code: 'FORBIDDEN', errorCode: 'core.forbidden' };

const groupQuery = `query ($id: ID!) { coreArticleGroup(id: $id) { ${groupFields} } }`;

describe('article groups', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /**
   * A client of a fresh user who holds the default role `key` at `scopeId`, at plant `slug`, or in
   * company settings without a slug.
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

  /** A company with one plant and a Company admin and a Plant admin at that plant. */
  async function givenPlace(): Promise<
    GivenCompany & { companyAdmin: GqlClient; plantAdmin: GqlClient }
  > {
    const place = await givenCompany(db.ownerUrl);
    const [plant = '', slug = ''] = [place.plants[0], place.slugs[0]];
    return {
      ...place,
      companyAdmin: await holderOf('core-company-admin', {
        company: place.company,
        scopeId: place.company,
        slug,
      }),
      plantAdmin: await holderOf('core-plant-admin', {
        company: place.company,
        scopeId: plant,
        slug,
      }),
    };
  }

  async function create(client: GqlClient, code: string, name: string) {
    const answer: Answer = await client.send(createGroup, {
      input: { id: randomUUIDv7(), code, name },
    });
    return { answer, group: answer.data?.coreCreateArticleGroup as Group | undefined };
  }

  it('E06-S06 a Company admin creates an article group of the company, which every plant lists by code', async () => {
    const { companyAdmin, plantAdmin } = await givenPlace();

    const { group } = await create(companyAdmin, ' FL ', ' Flanges ');
    await create(companyAdmin, 'CO', 'Consumables');
    const listed: Answer = await plantAdmin.send(listGroups);

    expect(group).toMatchObject({ code: 'FL', name: 'Flanges', version: 1, archivedAt: null });
    expect(listed.data?.coreArticleGroups).toEqual({
      totalCount: 2,
      edges: [
        { node: { code: 'CO', name: 'Consumables' } },
        { node: { code: 'FL', name: 'Flanges' } },
      ],
    });
  });

  it('E06-S06 a Plant admin may not create an article group, which belongs to the company', async () => {
    const { plantAdmin } = await givenPlace();

    const { answer } = await create(plantAdmin, 'HO', 'Hoses');

    expect(refusal(answer)).toEqual(forbidden);
  });

  it('E06-S06 a user with core.article:read only gets FORBIDDEN with core.forbidden from coreArticleGroups and coreArticleGroup, and no group', async () => {
    if (!testApp) throw new Error('the test app did not start');
    const place = await givenPlace();
    const { group } = await create(place.companyAdmin, 'FL', 'Flanges');
    const [plant = '', slug = ''] = [place.plants[0], place.slugs[0]];
    const { authorization } = await signIn(testApp.app, db.ownerUrl, [
      { scopeId: plant, permissions: ['core.article:read'] },
    ]);
    const reader = gqlClient(await testApp.app.getUrl(), {
      headers: { authorization, 'x-northmes-plant': slug },
    });

    const listed: Answer = await reader.send(listGroups);
    const one: Answer = await reader.send(groupQuery, { id: group?.id });

    expect(listed.data).toBeNull();
    expect(refusal(listed)).toEqual(forbidden);
    expect(one.data?.coreArticleGroup ?? null).toBeNull();
    expect(refusal(one)).toEqual(forbidden);
  });

  it("E06-S06 a plant lists the groups of its company only, and another company's group is null by id", async () => {
    const acme = await givenPlace();
    const other = await givenPlace();
    await create(acme.companyAdmin, 'FL', 'Flanges');
    const { group: foreign } = await create(other.companyAdmin, 'HO', 'Hoses');
    await create(other.companyAdmin, 'SH', 'Shafts');

    const listed: Answer = await acme.plantAdmin.send(listGroups);
    const byId: Answer = await acme.plantAdmin.send(groupQuery, { id: foreign?.id });

    expect(listed.data?.coreArticleGroups).toEqual({
      totalCount: 1,
      edges: [{ node: { code: 'FL', name: 'Flanges' } }],
    });
    expect(byId.errors).toBeUndefined();
    expect(byId.data).toEqual({ coreArticleGroup: null });
  });

  it('E06-S06 a Plant admin gets core.forbidden on update, archive and restore of a group, which stays as it was', async () => {
    const { companyAdmin, plantAdmin } = await givenPlace();
    const { group } = await create(companyAdmin, 'HS', 'Housings');
    const id = group?.id ?? '';

    const renamed: Answer = await plantAdmin.send(updateGroup, {
      input: { id, expectedVersion: 1, code: 'HS', name: 'Housings, cast' },
    });
    const archived: Answer = await plantAdmin.send(archiveGroup, {
      input: { id, expectedVersion: 1 },
    });
    const restored: Answer = await plantAdmin.send(restoreGroup, {
      input: { id, expectedVersion: 1 },
    });
    const after: Answer = await companyAdmin.send(groupQuery, { id });

    expect([renamed, archived, restored].map(refusal)).toEqual([forbidden, forbidden, forbidden]);
    expect(after.data?.coreArticleGroup).toEqual({
      id,
      code: 'HS',
      name: 'Housings',
      version: 1,
      archivedAt: null,
    });
  });

  it('E06-S06 a code that another group of the company uses, in any case, is core.code_taken on code', async () => {
    const { companyAdmin } = await givenPlace();
    await create(companyAdmin, 'SH', 'Shafts');

    const { answer } = await create(companyAdmin, 'sh', 'Shafts, hardened');

    expect(refusal(answer)).toEqual({ code: 'CONFLICT', errorCode: 'core.code_taken' });
  });

  it('E06-S06 a group is renamed, archived out of the list and restored into it, its version growing with each change', async () => {
    const { companyAdmin } = await givenPlace();
    const { group } = await create(companyAdmin, 'HS', 'Housings');
    const id = group?.id ?? '';

    const renamed: Answer = await companyAdmin.send(updateGroup, {
      input: { id, expectedVersion: 1, code: 'HS', name: 'Housings, cast' },
    });
    const archived: Answer = await companyAdmin.send(archiveGroup, {
      input: { id, expectedVersion: 2 },
    });
    const hidden: Answer = await companyAdmin.send(listGroups);
    const shown: Answer = await companyAdmin.send(listGroups, { includeArchived: true });
    const restored: Answer = await companyAdmin.send(restoreGroup, {
      input: { id, expectedVersion: 3 },
    });

    expect(renamed.data?.coreUpdateArticleGroup).toMatchObject({ name: 'Housings, cast' });
    expect(archived.data?.coreArchiveArticleGroup).toMatchObject({ version: 3 });
    expect(hidden.data?.coreArticleGroups).toMatchObject({ totalCount: 0 });
    expect(shown.data?.coreArticleGroups).toMatchObject({ totalCount: 1 });
    expect(restored.data?.coreRestoreArticleGroup).toMatchObject({ version: 4, archivedAt: null });
  });

  it('E06-S06 an article picks a group of its company, which it answers as an object, and an empty group removes it', async () => {
    const { companyAdmin } = await givenPlace();
    const { group } = await create(companyAdmin, 'FL', 'Flanges');
    const id = randomUUIDv7();

    const created: Answer = await companyAdmin.send(createArticle, {
      input: { id, code: 'AX-20410', name: 'Fläns', articleGroupId: group?.id },
    });
    const cleared: Answer = await companyAdmin.send(updateArticle, {
      input: { id, expectedVersion: 1, code: 'AX-20410', name: 'Fläns', articleGroupId: '' },
    });

    expect(created.data?.coreCreateArticle).toMatchObject({
      articleGroup: { id: group?.id, code: 'FL', name: 'Flanges' },
    });
    expect(cleared.data?.coreUpdateArticle).toMatchObject({ version: 2, articleGroup: null });
  });

  it('E06-S06 in company settings an article answers its group, as it does at a plant', async () => {
    const place = await givenPlace();
    const { group } = await create(place.companyAdmin, 'FL', 'Flanges');
    const id = randomUUIDv7();
    await place.companyAdmin.send(createArticle, {
      input: { id, code: 'AX-20412', name: 'Fläns', articleGroupId: group?.id },
    });
    const inSettings = await holderOf('core-company-admin', {
      company: place.company,
      scopeId: place.company,
    });

    const answer: Answer = await inSettings.send(
      `query ($id: ID!, $companyId: ID) {
        coreArticle(id: $id, companyId: $companyId) { code articleGroup { code name } }
      }`,
      { id, companyId: place.company },
    );

    expect(answer.errors).toBeUndefined();
    expect(answer.data?.coreArticle).toEqual({
      code: 'AX-20412',
      articleGroup: { code: 'FL', name: 'Flanges' },
    });
  });

  it('E06-S06 a retried create answers the article its first run made, also when its group was archived since', async () => {
    const { companyAdmin } = await givenPlace();
    const { group } = await create(companyAdmin, 'FL', 'Flanges');
    const input = {
      id: randomUUIDv7(),
      code: 'AX-20411',
      name: 'Fläns',
      articleGroupId: group?.id,
    };
    await companyAdmin.send(createArticle, { input });
    await companyAdmin.send(archiveGroup, { input: { id: group?.id, expectedVersion: 1 } });

    const retried: Answer = await companyAdmin.send(createArticle, { input });

    expect(retried.errors).toBeUndefined();
    expect(retried.data?.coreCreateArticle).toMatchObject({
      id: input.id,
      version: 1,
      articleGroup: { id: group?.id },
    });
  });

  it('E06-S06 an article cannot pick an archived group or one of another company', async () => {
    const { companyAdmin } = await givenPlace();
    const other = await givenPlace();
    const { group: archived } = await create(companyAdmin, 'OLD', 'Old group');
    await companyAdmin.send(archiveGroup, { input: { id: archived?.id, expectedVersion: 1 } });
    const { group: foreign } = await create(other.companyAdmin, 'FL', 'Flanges');

    const withArchived: Answer = await companyAdmin.send(createArticle, {
      input: { id: randomUUIDv7(), code: 'AX-1', name: 'One', articleGroupId: archived?.id },
    });
    const withForeign: Answer = await companyAdmin.send(createArticle, {
      input: { id: randomUUIDv7(), code: 'AX-2', name: 'Two', articleGroupId: foreign?.id },
    });

    expect(withArchived.errors?.[0]?.extensions).toMatchObject({
      code: 'BAD_USER_INPUT',
      fieldErrors: [
        { path: ['articleGroupId'], message: 'Choose an active article group of the company.' },
      ],
    });
    expect(withForeign.errors?.[0]?.extensions).toMatchObject({
      code: 'BAD_USER_INPUT',
      fieldErrors: [{ path: ['articleGroupId'] }],
    });
  });
});
