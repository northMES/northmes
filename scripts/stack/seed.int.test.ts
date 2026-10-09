import { hostFactory } from '@northmes/backend/testing';
import { createTestApp, gqlClient, query, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { devAdmin, seed, seedScopes } from './seed.mjs';

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

  it("E05-S05 the dev admin signs in with the seed's password and reads the seed plant's production orders", async () => {
    const signedIn = await fetch(`${url}/api/auth/sign-in/username`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: devAdmin.username, password: devAdmin.password }),
    });
    const sessionToken = signedIn.headers.get('set-auth-token');
    const { token } = (await (
      await fetch(`${url}/api/auth/token`, { headers: { authorization: `Bearer ${sessionToken}` } })
    ).json()) as { token: string };

    const answer = await gqlClient(url, {
      headers: { authorization: `Bearer ${token}`, 'x-northmes-plant': seedScopes.plant },
    }).send<{ planningProductionOrders: { number: string }[] }>(
      '{ planningProductionOrders { number } }',
    );

    expect(signedIn.status).toBe(200);
    expect(answer.data?.planningProductionOrders.map(({ number }) => number)).toEqual([
      'DEV-1001',
      'DEV-1002',
      'DEV-1003',
      'DEV-1004',
    ]);
  });

  it('E05-S05 a second run of the seed adds no scope, role or assignment', async () => {
    const counts = () =>
      query(
        db.appUrl,
        `select (select count(*)::int from core.scope) as scopes,
                (select count(*)::int from core.role) as roles,
                (select count(*)::int from core.role_assignment) as assignments`,
      );
    const before = await counts();

    await seed({ appUrl: db.appUrl, ownerUrl: db.ownerUrl });

    expect(before).toEqual([{ scopes: 2, roles: 1, assignments: 1 }]);
    expect(await counts()).toEqual(before);
  });
});
