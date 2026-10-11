// SPDX-License-Identifier: AGPL-3.0-or-later
import { givenArticle, givenCompany, hostFactory, signIn } from '@northmes/backend/testing';
import { createTestApp, gqlClient, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const companiesQuery = '{ coreCompanies { id name plants { id slug name } } }';

const articleCodes = '{ coreArticles(orderBy: { field: CODE }) { edges { node { code } } } }';

const updateMutation = `mutation ($input: CoreUpdateArticleInput!) {
  coreUpdateArticle(input: $input) { id code name version }
}`;

const articleQuery = 'query ($id: ID!) { coreArticle(id: $id) { code name version } }';

/** A planner's permissions on articles: read and change them. */
const planner = ['core.article:read', 'core.article:update'];

describe('companies, plants and the request plant', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  function app() {
    if (!testApp) throw new Error('the test app did not start');
    return testApp.app;
  }

  /** Sends one operation with the user's JWT, and with x-northmes-plant when plant is given. */
  async function send<Data>(
    authorization: string,
    plant: string | undefined,
    document: string,
    variables?: Record<string, unknown>,
  ) {
    const headers: Record<string, string> = { authorization };
    if (plant !== undefined) headers['x-northmes-plant'] = plant;
    return gqlClient(await app().getUrl(), { headers }).send<Data>(document, variables);
  }

  /** Writes one article assigned to the plant `plant` and returns its id. */
  function articleAt(plant: string, code: string): Promise<string> {
    return givenArticle(db.ownerUrl, { code, name: code, plants: [plant] });
  }

  it('E05-S03 coreCompanies lists the plants a user can open from its role assignments, grouped by company and sorted by name', async () => {
    const zeta = await givenCompany(db.ownerUrl, {
      name: 'Zeta Works',
      plantNames: ['Weld shop', 'Assembly'],
    });
    const alpha = await givenCompany(db.ownerUrl, {
      name: 'Alpha Metals',
      plantNames: ['North', 'South'],
    });
    await givenCompany(db.ownerUrl, { name: 'Another company' });
    const user = await signIn(app(), db.ownerUrl, [
      { scopeId: zeta.company, permissions: ['core.article:read'] },
      { scopeId: alpha.plants[1] ?? '', permissions: ['core.article:read'] },
    ]);

    const answer = await send(user.authorization, undefined, companiesQuery);

    expect(answer).toEqual({
      status: 200,
      data: {
        coreCompanies: [
          {
            id: alpha.company,
            name: 'Alpha Metals',
            plants: [{ id: alpha.plants[1], slug: alpha.slugs[1], name: 'South' }],
          },
          {
            id: zeta.company,
            name: 'Zeta Works',
            plants: [
              { id: zeta.plants[1], slug: zeta.slugs[1], name: 'Assembly' },
              { id: zeta.plants[0], slug: zeta.slugs[0], name: 'Weld shop' },
            ],
          },
        ],
      },
    });
  });

  it('E05-S03 a request at a plant the user can open lists all of its plants, not only the request plant', async () => {
    const { company, plants, slugs } = await givenCompany(db.ownerUrl, {
      name: 'Two plants',
      plantNames: ['Plant A', 'Plant B'],
    });
    const user = await signIn(app(), db.ownerUrl, [{ scopeId: company, permissions: planner }]);

    const answer = await send<{ coreCompanies: { plants: { id: string }[] }[] }>(
      user.authorization,
      slugs[1],
      companiesQuery,
    );

    expect(answer.data?.coreCompanies.flatMap((each) => each.plants.map(({ id }) => id))).toEqual(
      plants,
    );
  });

  it('E05-S03 x-northmes-plant naming a plant the user holds no role at, or no plant at all, is FORBIDDEN with core.plant_forbidden and no data', async () => {
    const { plants, slugs } = await givenCompany(db.ownerUrl, { plants: 2 });
    const other = await givenCompany(db.ownerUrl);
    const user = await signIn(app(), db.ownerUrl, [
      { scopeId: plants[0] ?? '', permissions: planner },
    ]);

    const answers = await Promise.all(
      [slugs[1], other.slugs[0], 'no-such-plant'].map((plant) =>
        send(user.authorization, plant, articleCodes),
      ),
    );

    for (const [index, answer] of answers.entries()) {
      // The request fails before any field runs, so the answer holds no data (GraphQL spec 7.1.2).
      expect(answer.data, `answer ${index}`).toBeUndefined();
      expect(answer.errors, `answer ${index}`).toMatchObject([
        { extensions: { code: 'FORBIDDEN', errorCode: 'core.plant_forbidden' } },
      ]);
    }
    // The answer for a plant of another company and for no plant at all read the same.
    expect(answers[1]?.errors?.[0]?.message).toBe(
      answers[2]?.errors?.[0]?.message.replace('no-such-plant', other.slugs[0] ?? ''),
    );
  });

  it('E05-S04 a request reads the articles of the company assigned to its own plant or to All plants, never those of another plant where the user holds a role', async () => {
    const { company, plants, slugs } = await givenCompany(db.ownerUrl, { plants: 2 });
    const [plantA = '', plantB = ''] = plants;
    await givenArticle(db.ownerUrl, { code: 'CO-1', name: 'CO-1', company, allPlants: true });
    await articleAt(plantA, 'PA-1');
    await articleAt(plantB, 'PB-1');
    const user = await signIn(app(), db.ownerUrl, [
      { scopeId: plantA, permissions: planner },
      { scopeId: plantB, permissions: planner },
    ]);

    const atA = await send<{ coreArticles: { edges: { node: { code: string } }[] } }>(
      user.authorization,
      slugs[0],
      articleCodes,
    );
    const withoutPlant = await send(user.authorization, undefined, articleCodes);

    expect(atA.data?.coreArticles.edges.map(({ node }) => node.code)).toEqual(['CO-1', 'PA-1']);
    // Without a plant, coreArticles needs the company it reads, so it reads nothing (ADR 0066).
    expect(withoutPlant.data).toBeNull();
    expect(withoutPlant.errors?.[0]?.extensions?.errorCode).toBe('core.forbidden');
  });

  it('E05-S04 a request writes only its own plant: an article at another plant where the user may write is FORBIDDEN and keeps its version', async () => {
    const { plants, slugs } = await givenCompany(db.ownerUrl, { plants: 2 });
    const [plantA = '', plantB = ''] = plants;
    const articleB = await articleAt(plantB, 'PB-2');
    const user = await signIn(app(), db.ownerUrl, [
      { scopeId: plantA, permissions: planner },
      { scopeId: plantB, permissions: planner },
    ]);

    const atA = await send(user.authorization, slugs[0], updateMutation, {
      input: { id: articleB, expectedVersion: 1, code: 'PB-2', name: 'Changed at A' },
    });
    const atB = await send(user.authorization, slugs[1], articleQuery, { id: articleB });

    expect(atA).toMatchObject({
      data: null,
      errors: [{ extensions: { code: 'FORBIDDEN', errorCode: 'core.forbidden' } }],
    });
    expect(atB.data).toEqual({ coreArticle: { code: 'PB-2', name: 'PB-2', version: 1 } });
  });
});
