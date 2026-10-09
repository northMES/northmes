// SPDX-License-Identifier: AGPL-3.0-or-later
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { givenCompany, hostFactory, signIn } from '@northmes/backend/testing';
import { createTestApp, gqlClient, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The root fields that core declares plant-free in release 1 (ADR 0066): those company settings
 * call without x-northmes-plant. A field that joins the list is a decision, so this list changes
 * with it.
 */
const releaseOnePlantFree = [
  'Mutation.coreArchiveArticle',
  'Mutation.coreAssignRole',
  'Mutation.coreBlockUser',
  'Mutation.coreCreateArticle',
  'Mutation.coreCreateRole',
  'Mutation.coreCreateUser',
  'Mutation.coreDeleteRole',
  'Mutation.coreRemoveRoleAssignment',
  'Mutation.coreRestoreArticle',
  'Mutation.coreSetArticlePlants',
  'Mutation.coreUnblockUser',
  'Mutation.coreUpdateArticle',
  'Mutation.coreUpdateRole',
  'Mutation.coreUpsertArticle',
  'Query.coreArticle',
  'Query.coreArticles',
  'Query.coreCompanies',
  'Query.corePermissionCatalog',
  'Query.coreRole',
  'Query.coreRoles',
  'Query.coreUser',
  'Query.coreUsers',
  'Query.coreViewer',
];

describe('operations without x-northmes-plant', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core', 'planning'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  function app() {
    if (!testApp) throw new Error('the test app did not start');
    return testApp.app;
  }

  /** A client of a fresh Company admin of a fresh company, which names no plant. */
  async function companyAdmin() {
    const { company } = await givenCompany(db.ownerUrl, { name: 'Acme AB' });
    const { authorization } = await signIn(app(), db.ownerUrl, [
      { scopeId: company, permissions: ['core.article:read', 'planning.productionOrder:read'] },
    ]);
    return gqlClient(await app().getUrl(), { headers: { authorization } });
  }

  it('E04-S02 coreCompanies without x-northmes-plant answers for a signed-in user', async () => {
    const client = await companyAdmin();

    const answer = await client.send<{ coreCompanies: { name: string }[] }>(
      '{ coreCompanies { name } }',
    );

    expect(answer.errors).toBeUndefined();
    expect(answer.data?.coreCompanies.map(({ name }) => name)).toEqual(['Acme AB']);
  });

  it('E04-S02 an operation without the header that selects a field that is not plant-free fails with FORBIDDEN core.plant_forbidden and no data', async () => {
    const client = await companyAdmin();

    for (const document of [
      '{ planningProductionOrders { id } }',
      '{ coreArticles { totalCount } planningProductionOrders { id } }',
      'query Orders { ...Root } fragment Root on Query { planningProductionOrders { id } }',
    ]) {
      const answer = await client.send(document);

      expect(answer.data, document).toBeUndefined();
      expect(answer.errors, document).toMatchObject([
        {
          message: 'The request names no plant. Choose one of your plants.',
          extensions: { code: 'FORBIDDEN', errorCode: 'core.plant_forbidden' },
        },
      ]);
    }
  });

  it('E04-S02 an operation without the header that mixes a plant-free field and a planning field fails and runs neither', async () => {
    const client = await companyAdmin();

    const answer = await client.send('{ coreCompanies { name } planningProductionOrders { id } }');

    expect(answer.data).toBeUndefined();
    expect(answer.errors?.map(({ extensions }) => extensions)).toEqual([
      { code: 'FORBIDDEN', errorCode: 'core.plant_forbidden' },
    ]);
  });

  it('E04-S02 a request without a bearer token and without the header stays UNAUTHENTICATED', async () => {
    const client = gqlClient(await app().getUrl());

    const answer = await client.send('{ planningProductionOrders { id } }');

    expect(answer.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('E04-S02 the plant-free root fields equal the release 1 list', () => {
    const { schema } = app().get(GraphQLSchemaHost);
    const declared = [schema.getQueryType(), schema.getMutationType()].flatMap((type) =>
      Object.values(type?.getFields() ?? {})
        .filter(({ extensions }) => extensions.northmesPlantFree === true)
        .map(({ name }) => `${type?.name}.${name}`),
    );

    expect(declared.sort()).toEqual(releaseOnePlantFree);
  });
});
