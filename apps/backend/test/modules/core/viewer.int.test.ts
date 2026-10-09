// SPDX-License-Identifier: AGPL-3.0-or-later
import { type Grant, givenCompany, hostFactory, signIn } from '@northmes/backend/testing';
import { createTestApp, gqlClient, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const viewerQuery = '{ coreViewer { userId plantPermissions companyPermissions } }';

interface ViewerAnswer {
  coreViewer: { userId: string; plantPermissions: string[]; companyPermissions: string[] };
}

describe('the signed-in user at the request plant', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /** Sends coreViewer as a fresh user with these grants, at the plant with this slug or none. */
  async function viewerWith(grants: readonly Grant[], plant: string | undefined) {
    if (!testApp) throw new Error('the test app did not start');
    const { authorization, userId } = await signIn(testApp.app, db.ownerUrl, grants);
    const client = gqlClient(await testApp.app.getUrl(), {
      headers: { authorization, ...(plant === undefined ? {} : { 'x-northmes-plant': plant }) },
    });
    return { userId, answer: await client.send<ViewerAnswer>(viewerQuery) };
  }

  it('E05-S06 coreViewer lists what the user holds at the plant, from roles there and at its company, and at the company alone', async () => {
    const { company, plants, slugs } = await givenCompany(db.ownerUrl, {
      plantNames: ['Plant A', 'Plant B'],
    });
    const [plantA = '', plantB = ''] = plants;

    const { userId, answer } = await viewerWith(
      [
        { scopeId: company, permissions: ['core.role:read'] },
        { scopeId: plantA, permissions: ['core.user:read', 'core.role:read'] },
        { scopeId: plantB, permissions: ['core.roleAssignment:manage'] },
      ],
      slugs[0],
    );

    expect(answer.errors).toBeUndefined();
    expect(answer.data?.coreViewer.plantPermissions).toEqual(['core.role:read', 'core.user:read']);
    expect(answer.data?.coreViewer.companyPermissions).toEqual(['core.role:read']);
    expect(answer.data?.coreViewer.userId).toBe(userId);
  });

  it('E05-S06 coreViewer needs a plant', async () => {
    const { company } = await givenCompany(db.ownerUrl);

    const { answer } = await viewerWith(
      [{ scopeId: company, permissions: ['core.role:read'] }],
      undefined,
    );

    expect(answer.data).toBeNull();
    expect(answer.errors?.[0]?.extensions?.errorCode).toBe('core.forbidden');
  });
});
