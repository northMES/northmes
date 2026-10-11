// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUIDv7 } from 'node:crypto';
import {
  type Grant,
  givenAssignment,
  givenCompany,
  givenUser,
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

const usersQuery = `{
  coreUsers {
    totalCount
    edges { node { username blocked roleAssignments { scope { kind name } role { name } } } }
  }
}`;

interface UsersAnswer {
  coreUsers: {
    totalCount: number;
    edges: {
      node: {
        username: string;
        blocked: boolean;
        roleAssignments: { scope: { kind: string; name: string }; role: { name: string } | null }[];
      };
    }[];
  };
}

const userQuery = `query ($id: ID!) {
  coreUser(id: $id) {
    username
    effectivePermissions {
      permission { key }
      grantedBy { scope { name } role { name } }
    }
  }
}`;

interface UserAnswer {
  coreUser: {
    username: string;
    effectivePermissions: {
      permission: { key: string };
      grantedBy: { scope: { name: string }; role: { name: string } | null }[];
    }[];
  } | null;
}

describe('the users of a company and their access', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core', 'planning'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /** A fresh signed-in user with these grants, and a client of theirs at the plant `plant`. */
  async function signedIn(
    grants: readonly Grant[],
    plant: string,
  ): Promise<{ client: GqlClient; userId: string; username: string }> {
    if (!testApp) throw new Error('the test app did not start');
    const { authorization, userId, username } = await signIn(testApp.app, db.ownerUrl, grants);
    const client = gqlClient(await testApp.app.getUrl(), {
      headers: { authorization, 'x-northmes-plant': plant },
    });
    return { client, userId, username };
  }

  it("E05-S08 coreUsers lists the company's users with their roles at the company and at the request's plant, and no user of another company", async () => {
    const { company, plants, slugs } = await givenCompany(db.ownerUrl, {
      name: 'Acme AB',
      plantNames: ['Plant A', 'Plant B'],
    });
    const [plantA = '', plantB = ''] = plants;
    const reader = await signedIn(
      [{ scopeId: company, permissions: ['core.user:read', 'core.role:read'] }],
      slugs[0] ?? '',
    );
    const atBoth = await signedIn(
      [
        { scopeId: plantA, permissions: ['core.article:read'] },
        { scopeId: plantB, permissions: ['core.article:read'] },
      ],
      slugs[0] ?? '',
    );
    const other = await givenCompany(db.ownerUrl);
    const elsewhere = await signedIn(
      [{ scopeId: other.company, permissions: ['core.article:read'] }],
      other.slugs[0] ?? '',
    );

    const answer = await reader.client.send<UsersAnswer>(usersQuery);

    expect(answer.errors).toBeUndefined();
    const nodes = answer.data?.coreUsers.edges.map(({ node }) => node) ?? [];
    expect(answer.data?.coreUsers.totalCount).toBe(2);
    expect(nodes.map(({ username }) => username).sort()).toEqual(
      [reader.username, atBoth.username].sort(),
    );
    expect(nodes.map(({ username }) => username)).not.toContain(elsewhere.username);
    expect(nodes.find(({ username }) => username === atBoth.username)).toEqual({
      username: atBoth.username,
      blocked: false,
      roleAssignments: [{ scope: { kind: 'PLANT', name: 'Plant A' }, role: expect.anything() }],
    });
    expect(nodes.find(({ username }) => username === reader.username)?.roleAssignments).toEqual([
      { scope: { kind: 'COMPANY', name: 'Acme AB' }, role: expect.anything() },
    ]);
  });

  /**
   * Acme AB with an admin who reads, creates and blocks users, and three users the admin created:
   * Anna Berg (zeta.berg), who holds Plant admin at the plant, Bo Sjö (alpha.sjo), who is blocked,
   * and Cia Ek (mid.ek), who holds no role. Each username ends in the same tag of this call, since a
   * username is never given twice.
   */
  async function listedUsers() {
    const { company, plants, slugs } = await givenCompany(db.ownerUrl, { name: 'Acme AB' });
    const admin = await signedIn(
      [
        {
          scopeId: company,
          permissions: ['core.user:read', 'core.user:create', 'core.user:block', 'core.role:read'],
        },
      ],
      slugs[0] ?? '',
    );
    const tag = randomUUIDv7().slice(-6);
    const create = async (name: string, handle: string) => {
      const username = `${handle}_${tag}`;
      const answer = await admin.client.send<{ coreCreateUser: { user: { id: string } } }>(
        `mutation ($input: CoreCreateUserInput!) { coreCreateUser(input: $input) { user { id } } }`,
        { input: { id: randomUUIDv7(), name, username, email: `${username}@example.test` } },
      );
      return answer.data?.coreCreateUser.user.id ?? '';
    };
    const anna = await create('Anna Berg', 'zeta.berg');
    const bo = await create('Bo Sjö', 'alpha.sjo');
    await create('Cia Ek', 'mid.ek');
    const [{ id: plantAdmin } = { id: '' }] = await queryAsCore<{ id: string }>(
      db.ownerUrl,
      `select id from core.role where company_id = $1 and key = 'core-plant-admin'`,
      [company],
    );
    await givenAssignment(db.ownerUrl, {
      userId: anna,
      roleId: plantAdmin,
      scopeId: plants[0] ?? '',
    });
    await admin.client.send(
      `mutation ($input: CoreBlockUserInput!) { coreBlockUser(input: $input) { id } }`,
      { input: { id: bo } },
    );
    return { admin, plantAdmin, tag };
  }

  /**
   * The usernames of coreUsers with these arguments, in the list's order, without the admin and
   * without the tag.
   */
  async function usernames(client: GqlClient, args: string, admin: string) {
    const answer = await client.send<{
      coreUsers: { totalCount: number; edges: { node: { username: string } }[] };
    }>(`{ coreUsers(${args}) { totalCount edges { node { username } } } }`);
    if (!answer.data) throw new Error(JSON.stringify(answer.errors));
    return answer.data.coreUsers.edges
      .map(({ node }) => node.username)
      .filter((username) => username !== admin)
      .map((username) => username.replace(/_[0-9a-f]{6}$/, ''));
  }

  it('E05-S08 coreUsers filters by a role and by whether the user is blocked', async () => {
    const { admin, plantAdmin } = await listedUsers();

    expect(await usernames(admin.client, `roleId: "${plantAdmin}"`, admin.username)).toEqual([
      'zeta.berg',
    ]);
    expect(await usernames(admin.client, 'blocked: true', admin.username)).toEqual(['alpha.sjo']);
    expect(await usernames(admin.client, 'blocked: false', admin.username)).toEqual([
      'zeta.berg',
      'mid.ek',
    ]);
  });

  it("E05-S08 coreUsers filtered by a role at a plant lists the role's holders at the plant and at its company, and no holder only at another plant", async () => {
    const { company, plants, slugs } = await givenCompany(db.ownerUrl, {
      plantNames: ['Plant A', 'Plant B'],
    });
    const [plantA = '', plantB = ''] = plants;
    const reader = await signedIn(
      [{ scopeId: plantA, permissions: ['core.user:read', 'core.role:read'] }],
      slugs[0] ?? '',
    );
    const [{ id: plantAdmin } = { id: '' }] = await queryAsCore<{ id: string }>(
      db.ownerUrl,
      `select id from core.role where company_id = $1 and key = 'core-plant-admin'`,
      [company],
    );
    const holderAt = async (scopeId: string) => {
      const userId = await givenUser(db.ownerUrl, []);
      await givenAssignment(db.ownerUrl, { userId, roleId: plantAdmin, scopeId });
      return userId;
    };
    const atPlantA = await holderAt(plantA);
    const atCompany = await holderAt(company);
    await holderAt(plantB);

    const answer = await reader.client.send<{
      coreUsers: { totalCount: number; edges: { node: { id: string } }[] };
    }>(`{ coreUsers(roleId: "${plantAdmin}") { totalCount edges { node { id } } } }`);

    expect(answer.errors).toBeUndefined();
    expect(answer.data?.coreUsers.edges.map(({ node }) => node.id).sort()).toEqual(
      [atPlantA, atCompany].sort(),
    );
    expect(answer.data?.coreUsers.totalCount).toBe(2);
  });

  it('E05-S08 coreUsers sorts by name, the default, and by username either way', async () => {
    const { admin } = await listedUsers();

    expect(await usernames(admin.client, 'first: 25', admin.username)).toEqual([
      'zeta.berg',
      'alpha.sjo',
      'mid.ek',
    ]);
    expect(await usernames(admin.client, 'orderBy: [{ field: USERNAME }]', admin.username)).toEqual(
      ['alpha.sjo', 'mid.ek', 'zeta.berg'],
    );
    expect(
      await usernames(
        admin.client,
        'orderBy: [{ field: USERNAME, direction: DESC }]',
        admin.username,
      ),
    ).toEqual(['zeta.berg', 'mid.ek', 'alpha.sjo']);
  });

  it('E05-S08 coreUsers needs core.user:read at the plant', async () => {
    const { plants, slugs } = await givenCompany(db.ownerUrl);
    const { client } = await signedIn(
      [{ scopeId: plants[0] ?? '', permissions: ['core.role:read'] }],
      slugs[0] ?? '',
    );

    const answer = await client.send(usersQuery);

    expect(answer.data).toBeNull();
    expect(answer.errors?.map(({ extensions }) => extensions)).toEqual([
      { code: 'FORBIDDEN', errorCode: 'core.forbidden' },
    ]);
  });

  it('E05-S08 a reader of users without core.role:read gets each role as null with core.forbidden', async () => {
    const { plants, slugs } = await givenCompany(db.ownerUrl);
    const { client } = await signedIn(
      [{ scopeId: plants[0] ?? '', permissions: ['core.user:read'] }],
      slugs[0] ?? '',
    );

    const answer = await client.send<UsersAnswer>(usersQuery);

    const [node] = answer.data?.coreUsers.edges.map((edge) => edge.node) ?? [];
    expect(node?.roleAssignments).toEqual([{ scope: expect.anything(), role: null }]);
    expect(answer.errors?.map(({ path, extensions }) => ({ path, extensions }))).toEqual([
      {
        path: ['coreUsers', 'edges', 0, 'node', 'roleAssignments', 0, 'role'],
        extensions: { code: 'FORBIDDEN', errorCode: 'core.forbidden' },
      },
    ]);
  });

  it("E05-S06 coreUser lists every installed permission with the roles that grant it at the request's plant, and none for a permission no role grants", async () => {
    const { company, plants, slugs } = await givenCompany(db.ownerUrl, {
      name: 'Acme AB',
      plantNames: ['Plant A'],
    });
    const [plantA = ''] = plants;
    const reader = await signedIn(
      [{ scopeId: company, permissions: ['core.user:read', 'core.role:read'] }],
      slugs[0] ?? '',
    );
    const person = await signedIn(
      [{ scopeId: plantA, permissions: ['core.article:read', 'core.article:update'] }],
      slugs[0] ?? '',
    );

    const answer = await reader.client.send<UserAnswer>(userQuery, { id: person.userId });

    expect(answer.errors).toBeUndefined();
    const permissions = answer.data?.coreUser?.effectivePermissions ?? [];
    expect(permissions.map(({ permission }) => permission.key)).toContain(
      'planning.productionOrder:release',
    );
    const granted = permissions.filter(({ grantedBy }) => grantedBy.length > 0);
    expect(
      granted.map(({ permission, grantedBy }) => ({ key: permission.key, grantedBy })),
    ).toEqual([
      {
        key: 'core.article:read',
        grantedBy: [{ scope: { name: 'Plant A' }, role: { name: expect.any(String) } }],
      },
      {
        key: 'core.article:update',
        grantedBy: [{ scope: { name: 'Plant A' }, role: { name: expect.any(String) } }],
      },
    ]);
  });

  it('E05-S08 coreUser is null for a user of another company', async () => {
    const { plants, slugs } = await givenCompany(db.ownerUrl);
    const reader = await signedIn(
      [{ scopeId: plants[0] ?? '', permissions: ['core.user:read', 'core.role:read'] }],
      slugs[0] ?? '',
    );
    const other = await givenCompany(db.ownerUrl);
    const elsewhere = await signedIn(
      [{ scopeId: other.company, permissions: ['core.article:read'] }],
      other.slugs[0] ?? '',
    );

    const answer = await reader.client.send<UserAnswer>(userQuery, { id: elsewhere.userId });

    expect(answer).toMatchObject({ data: { coreUser: null } });
    expect(answer.errors).toBeUndefined();
  });
});
