// SPDX-License-Identifier: AGPL-3.0-or-later
import { type Grant, givenCompany, hostFactory, signIn } from '@northmes/backend/testing';
import {
  createTestApp,
  type GqlClient,
  gqlClient,
  type TestApp,
  useTestDatabase,
} from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const rolesQuery = `{
  coreRoles {
    id key name origin moduleId permissions version
    holders { scope { kind name } user { username } }
  }
}`;

interface RoleAnswer {
  id: string;
  key: string;
  name: string;
  origin: 'MODULE' | 'CUSTOM';
  moduleId: string | null;
  permissions: string[];
  version: number;
  holders: { scope: { kind: string; name: string }; user: { username: string } }[];
}

const catalogQuery = `{
  corePermissionCatalog {
    moduleId
    resources { resource permissions { key action installed } }
  }
}`;

interface CatalogAnswer {
  corePermissionCatalog: {
    moduleId: string;
    resources: {
      resource: string;
      permissions: { key: string; action: string; installed: boolean }[];
    }[];
  }[];
}

describe('the roles of a company and the permission catalog', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core', 'planning'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /** A client signed in as a fresh user with these grants, at the plant with this slug. */
  async function clientWith(
    grants: readonly Grant[],
    plant: string,
  ): Promise<GqlClient & { username: string }> {
    if (!testApp) throw new Error('the test app did not start');
    const { authorization, username } = await signIn(testApp.app, db.ownerUrl, grants);
    const client = gqlClient(await testApp.app.getUrl(), {
      headers: { authorization, 'x-northmes-plant': plant },
    });
    return Object.assign(client, { username });
  }

  it("E05-S06 coreRoles lists the default roles of the installed modules and the company's custom roles, each with its permissions", async () => {
    const { company, slugs } = await givenCompany(db.ownerUrl, { name: 'Acme AB' });
    const client = await clientWith(
      [{ scopeId: company, permissions: ['core.role:read'] }],
      slugs[0] ?? '',
    );

    const answer = await client.send<{ coreRoles: RoleAnswer[] }>(rolesQuery);

    expect(answer.errors).toBeUndefined();
    const roles = answer.data?.coreRoles ?? [];
    expect(
      roles
        .filter(({ origin }) => origin === 'MODULE')
        .map(({ key, name, moduleId, version }) => ({ key, name, moduleId, version })),
    ).toEqual([
      { key: 'core-company-admin', name: 'Company admin', moduleId: 'core', version: 1 },
      { key: 'planning-planner', name: 'Planner', moduleId: 'planning', version: 1 },
      { key: 'planning-viewer', name: 'Viewer', moduleId: 'planning', version: 1 },
    ]);
    expect(roles.find(({ key }) => key === 'planning-viewer')?.permissions).toEqual([
      'core.article:read',
      'planning.productionOrder:read',
    ]);
    expect(roles.find(({ key }) => key === 'core-company-admin')?.permissions).toContain(
      'core.role:manage',
    );
    // signIn gave the reader a custom role of the company that holds core.role:read.
    expect(
      roles
        .filter(({ origin }) => origin === 'CUSTOM')
        .map(({ permissions, moduleId, holders }) => ({ permissions, moduleId, holders })),
    ).toEqual([
      {
        permissions: ['core.role:read'],
        moduleId: null,
        holders: [{ scope: { kind: 'COMPANY', name: 'Acme AB' }, user: { username: client.username } }],
      },
    ]);
  });

  it("E05-S06 a role's holders are those at the company and at the request's plant, never at a sibling plant", async () => {
    const { company, plants, slugs } = await givenCompany(db.ownerUrl, {
      plantNames: ['Plant A', 'Plant B'],
    });
    const [plantA = '', plantB = ''] = plants;
    const atA = await clientWith(
      [
        { scopeId: plantA, permissions: ['core.role:read', 'core.article:read'] },
        { scopeId: plantB, permissions: ['core.role:read', 'core.article:read'] },
      ],
      slugs[0] ?? '',
    );

    const answer = await atA.send<{ coreRoles: RoleAnswer[] }>(rolesQuery);

    const held = (answer.data?.coreRoles ?? []).filter(({ holders }) => holders.length > 0);
    expect(held.map(({ holders }) => holders)).toEqual([
      [{ scope: { kind: 'PLANT', name: 'Plant A' }, user: { username: atA.username } }],
    ]);
    expect(company).not.toBe('');
  });

  it('E05-S06 coreRoles needs core.role:read at the plant', async () => {
    const { plants, slugs } = await givenCompany(db.ownerUrl);
    const client = await clientWith(
      [{ scopeId: plants[0] ?? '', permissions: ['core.article:read'] }],
      slugs[0] ?? '',
    );

    const answer = await client.send(rolesQuery);

    expect(answer.data).toBeNull();
    expect(answer.errors?.map(({ extensions }) => extensions)).toEqual([
      { code: 'FORBIDDEN', errorCode: 'core.forbidden' },
    ]);
  });

  it('E05-S06 corePermissionCatalog lists every permission of the catalog, grouped by module and resource', async () => {
    const { plants, slugs } = await givenCompany(db.ownerUrl);
    const client = await clientWith(
      [{ scopeId: plants[0] ?? '', permissions: ['core.role:read'] }],
      slugs[0] ?? '',
    );

    const answer = await client.send<CatalogAnswer>(catalogQuery);

    expect(answer.errors).toBeUndefined();
    const modules = answer.data?.corePermissionCatalog ?? [];
    expect(modules.map(({ moduleId }) => moduleId)).toEqual(['core', 'planning']);
    expect(modules[1]).toEqual({
      moduleId: 'planning',
      resources: [
        {
          resource: 'planning.productionOrder',
          permissions: [
            { key: 'planning.productionOrder:read', action: 'read', installed: true },
            { key: 'planning.productionOrder:release', action: 'release', installed: true },
          ],
        },
      ],
    });
    expect(modules[0]?.resources.map(({ resource }) => resource)).toEqual([
      'core.article',
      'core.role',
      'core.roleAssignment',
      'core.user',
    ]);
  });
});
