import { hostFactory } from '@northmes/backend/testing';
import { createTestApp, gqlClient, query, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { devAdmin, seed, seedCompany, seedPlants } from './seed.mjs';

describe('the seed', () => {
  const db = useTestDatabase();
  let testApp: TestApp;
  let url: string;

  beforeAll(async () => {
    await seed({ appUrl: db.appUrl, ownerUrl: db.ownerUrl });
    testApp = await createTestApp({ modules: ['core', 'planning'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
    url = await testApp.app.getUrl();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  /** The dev admin's JWT, signed in through Better Auth with the seed's password. */
  async function adminToken(): Promise<string> {
    const signedIn = await fetch(`${url}/api/auth/sign-in/username`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: devAdmin.username, password: devAdmin.password }),
    });
    expect(signedIn.status).toBe(200);
    const sessionToken = signedIn.headers.get('set-auth-token');
    const { token } = (await (
      await fetch(`${url}/api/auth/token`, { headers: { authorization: `Bearer ${sessionToken}` } })
    ).json()) as { token: string };
    return token;
  }

  it("E05-S05 the dev admin signs in with the seed's password and reads each seed plant's production orders", async () => {
    const token = await adminToken();

    const numbersAt = async (plant: string) => {
      const answer = await gqlClient(url, {
        headers: { authorization: `Bearer ${token}`, 'x-northmes-plant': plant },
      }).send<{ planningProductionOrders: { number: string }[] }>(
        '{ planningProductionOrders { number } }',
      );
      return answer.data?.planningProductionOrders.map(({ number }) => number);
    };

    expect(await numbersAt('plant-a')).toEqual(['DEV-1001', 'DEV-1002', 'DEV-1004']);
    expect(await numbersAt('plant-b')).toEqual(['DEV-1003']);
  });

  it('E05-S03 the seed holds one company with two plants, and the dev admin can open both', async () => {
    const token = await adminToken();

    const answer = await gqlClient(url, {
      headers: { authorization: `Bearer ${token}` },
    }).send('{ coreCompanies { id name plants { id slug name } } }');

    expect(answer.data).toEqual({
      coreCompanies: [{ id: seedCompany.id, name: seedCompany.name, plants: seedPlants }],
    });
    expect(seedPlants.map(({ slug, name }) => ({ slug, name }))).toEqual([
      { slug: 'plant-a', name: 'Plant A' },
      { slug: 'plant-b', name: 'Plant B' },
    ]);
  });

  it('E05-S05 a second run of the seed adds no scope, company, plant, role or assignment', async () => {
    const counts = () =>
      query(
        db.appUrl,
        `select (select count(*)::int from core.scope) as scopes,
                (select count(*)::int from core.company) as companies,
                (select count(*)::int from core.plant) as plants,
                (select count(*)::int from core.role) as roles,
                (select count(*)::int from core.role_assignment) as assignments`,
      );
    const before = await counts();

    await seed({ appUrl: db.appUrl, ownerUrl: db.ownerUrl });

    expect(before).toEqual([{ scopes: 3, companies: 1, plants: 2, roles: 1, assignments: 1 }]);
    expect(await counts()).toEqual(before);
  });
});
