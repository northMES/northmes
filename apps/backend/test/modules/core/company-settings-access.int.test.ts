// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUIDv7 } from 'node:crypto';
import { type Grant, givenCompany, hostFactory, signIn } from '@northmes/backend/testing';
import {
  createTestApp,
  type GqlClient,
  gqlClient,
  type TestApp,
  useTestDatabase,
} from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Every permission of core, as a Company admin holds them at the company. */
const companyAdmin = [
  'core.article:read',
  'core.role:manage',
  'core.role:read',
  'core.roleAssignment:manage',
  'core.user:block',
  'core.user:create',
  'core.user:read',
];

const usersQuery = `query ($companyId: ID) {
  coreUsers(companyId: $companyId) {
    totalCount
    edges { node { username roleAssignments { scope { kind name } role { name } } } }
  }
}`;

interface UsersAnswer {
  coreUsers: {
    totalCount: number;
    edges: {
      node: {
        username: string;
        roleAssignments: { scope: { kind: string; name: string }; role: { name: string } | null }[];
      };
    }[];
  };
}

const userQuery = `query ($id: ID!, $companyId: ID) {
  coreUser(id: $id, companyId: $companyId) {
    username
    roleAssignments { scope { name } role { name } }
    effectivePermissions { permission { key } grantedBy { scope { name } } }
  }
}`;

interface UserAnswer {
  coreUser: {
    username: string;
    roleAssignments: { scope: { name: string }; role: { name: string } | null }[];
    effectivePermissions: {
      permission: { key: string };
      grantedBy: { scope: { name: string } }[];
    }[];
  } | null;
}

const rolesQuery = `query ($companyId: ID) {
  coreRoles(companyId: $companyId) { id name holders { scope { name } user { username } } }
  corePermissionCatalog(companyId: $companyId) { moduleId }
}`;

interface RolesAnswer {
  coreRoles: {
    id: string;
    name: string;
    holders: { scope: { name: string }; user: { username: string } }[];
  }[];
  corePermissionCatalog: { moduleId: string }[];
}

const roleQuery = `query ($id: ID!, $companyId: ID) {
  coreRole(id: $id, companyId: $companyId) { name holders { scope { name } } }
}`;

const viewerQuery = `query ($companyId: ID) {
  coreViewer(companyId: $companyId) { plantPermissions companyPermissions }
}`;

const createUserMutation = `mutation ($input: CoreCreateUserInput!) {
  coreCreateUser(input: $input) { user { id username } }
}`;

const createRoleMutation = `mutation ($input: CoreCreateRoleInput!) {
  coreCreateRole(input: $input) { id name }
}`;

const updateRoleMutation = `mutation ($input: CoreUpdateRoleInput!) {
  coreUpdateRole(input: $input) { name version }
}`;

const deleteRoleMutation = `mutation ($input: CoreDeleteRoleInput!) {
  coreDeleteRole(input: $input) { id }
}`;

const assignMutation = `mutation ($input: CoreAssignRoleInput!) {
  coreAssignRole(input: $input) { id scope { kind name } role { name } }
}`;

const removeMutation = `mutation ($input: CoreRemoveRoleAssignmentInput!) {
  coreRemoveRoleAssignment(input: $input) { id }
}`;

const blockMutation = `mutation ($input: CoreBlockUserInput!) {
  coreBlockUser(input: $input) { blocked }
}`;

const unblockMutation = `mutation ($input: CoreUnblockUserInput!) {
  coreUnblockUser(input: $input) { blocked }
}`;

const plantAssignmentsQuery = `{
  corePlantRoleAssignments { scope { kind name } user { username } role { name } }
}`;

interface PlantAssignmentsAnswer {
  corePlantRoleAssignments: {
    scope: { kind: string; name: string };
    user: { username: string };
    role: { name: string } | null;
  }[];
}

/** The errorCode of each error of an answer. */
function errorCodes(answer: { readonly errors?: readonly { extensions?: unknown }[] }) {
  return answer.errors?.map(({ extensions }) => (extensions as { errorCode?: string }).errorCode);
}

describe('access in company settings, without x-northmes-plant', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core', 'planning'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /** A fresh signed-in user with these grants, and a client of theirs at `plant` or at none. */
  async function signedIn(
    grants: readonly Grant[],
    plant?: string,
  ): Promise<{ client: GqlClient; userId: string; username: string }> {
    if (!testApp) throw new Error('the test app did not start');
    const { authorization, userId, username } = await signIn(testApp.app, db.ownerUrl, grants);
    const headers: Record<string, string> = { authorization };
    if (plant !== undefined) headers['x-northmes-plant'] = plant;
    const client = gqlClient(await testApp.app.getUrl(), { headers });
    return { client, userId, username };
  }

  /** Acme AB with Plant A and Plant B, its Company admin, and Sara, who reads articles at each plant. */
  async function acme() {
    const given = await givenCompany(db.ownerUrl, {
      name: 'Acme AB',
      plantNames: ['Plant A', 'Plant B'],
    });
    const [plantA = '', plantB = ''] = given.plants;
    const admin = await signedIn([{ scopeId: given.company, permissions: companyAdmin }]);
    const sara = await signedIn([
      { scopeId: plantA, permissions: ['core.article:read'] },
      { scopeId: plantB, permissions: ['core.article:read'] },
    ]);
    return { ...given, plantA, plantB, admin, sara };
  }

  it("E04-S02 coreUsers with a companyId lists the company's users with their roles at the company and at every plant", async () => {
    const { company, admin, sara } = await acme();
    await givenCompany(db.ownerUrl);

    const answer = await admin.client.send<UsersAnswer>(usersQuery, { companyId: company });

    expect(answer.errors).toBeUndefined();
    expect(answer.data?.coreUsers.totalCount).toBe(2);
    const node = answer.data?.coreUsers.edges.find((edge) => edge.node.username === sara.username);
    expect(node?.node.roleAssignments.map(({ scope }) => scope)).toEqual([
      { kind: 'PLANT', name: 'Plant A' },
      { kind: 'PLANT', name: 'Plant B' },
    ]);
    expect(node?.node.roleAssignments.every(({ role }) => role !== null)).toBe(true);
  });

  it('E04-S02 coreUsers in company settings needs core.user:read at the company: a role at every plant is not enough', async () => {
    const { company, plantA, plantB } = await acme();
    const reader = await signedIn([
      { scopeId: plantA, permissions: ['core.user:read', 'core.role:read'] },
      { scopeId: plantB, permissions: ['core.user:read', 'core.role:read'] },
    ]);

    const answer = await reader.client.send(usersQuery, { companyId: company });

    expect(answer.data).toBeNull();
    expect(errorCodes(answer)).toEqual(['core.forbidden']);
  });

  it('E04-S02 coreUsers without x-northmes-plant needs a companyId, and the id of another company is FORBIDDEN', async () => {
    const { admin } = await acme();
    const other = await givenCompany(db.ownerUrl);

    const withoutCompany = await admin.client.send(usersQuery, {});
    const elsewhere = await admin.client.send(usersQuery, { companyId: other.company });

    expect(errorCodes(withoutCompany)).toEqual(['core.forbidden']);
    expect(errorCodes(elsewhere)).toEqual(['core.forbidden']);
  });

  it('E04-S02 coreUser with a companyId reads the roles at the company and at every plant, and what the user can do at the company', async () => {
    const { company, admin, sara } = await acme();

    const answer = await admin.client.send<UserAnswer>(userQuery, {
      id: sara.userId,
      companyId: company,
    });
    const own = await admin.client.send<UserAnswer>(userQuery, {
      id: admin.userId,
      companyId: company,
    });

    expect(answer.errors).toBeUndefined();
    expect(answer.data?.coreUser?.roleAssignments.map(({ scope }) => scope.name)).toEqual([
      'Plant A',
      'Plant B',
    ]);
    // A role at a plant grants nothing at the company.
    const grantedBy = (data: UserAnswer | null | undefined, key: string) =>
      data?.coreUser?.effectivePermissions.find(({ permission }) => permission.key === key)
        ?.grantedBy;
    expect(grantedBy(answer.data, 'core.article:read')).toEqual([]);
    expect(grantedBy(own.data, 'core.user:read')).toEqual([{ scope: { name: 'Acme AB' } }]);
  });

  it('E04-S02 coreRoles, coreRole and corePermissionCatalog with a companyId read the roles of the company and their holders at every plant', async () => {
    const { company, admin, sara } = await acme();

    const answer = await admin.client.send<RolesAnswer>(rolesQuery, { companyId: company });

    expect(answer.errors).toBeUndefined();
    const holders = answer.data?.coreRoles.flatMap(({ holders: list }) =>
      list.filter(({ user }) => user.username === sara.username).map(({ scope }) => scope.name),
    );
    expect(holders?.sort()).toEqual(['Plant A', 'Plant B']);
    expect(answer.data?.corePermissionCatalog.map(({ moduleId }) => moduleId)).toContain('core');

    const held = answer.data?.coreRoles.find(({ holders: list }) =>
      list.some(({ user }) => user.username === sara.username),
    );
    const role = await admin.client.send<{ coreRole: { name: string } | null }>(roleQuery, {
      id: held?.id,
      companyId: company,
    });
    expect(role.data?.coreRole?.name).toBe(held?.name);
  });

  it('E04-S02 coreViewer with a companyId lists what the user holds at the company and nothing at a plant', async () => {
    const { company, admin, plantA } = await acme();
    const plantRole = await signedIn([
      { scopeId: company, permissions: ['core.role:read'] },
      { scopeId: plantA, permissions: ['core.user:read'] },
    ]);

    const answer = await admin.client.send<{
      coreViewer: { plantPermissions: string[]; companyPermissions: string[] };
    }>(viewerQuery, { companyId: company });
    const partial = await plantRole.client.send<{
      coreViewer: { plantPermissions: string[]; companyPermissions: string[] };
    }>(viewerQuery, { companyId: company });

    expect(answer.data?.coreViewer).toEqual({
      plantPermissions: [],
      companyPermissions: companyAdmin,
    });
    expect(partial.data?.coreViewer.companyPermissions).toEqual(['core.role:read']);
  });

  it('E04-S02 a Company admin creates a user and a role, assigns the role at a plant, removes it, and blocks and unblocks the user from company settings', async () => {
    const { company, plantB, admin } = await acme();

    const created = await admin.client.send<{
      coreCreateUser: { user: { id: string; username: string } };
    }>(createUserMutation, {
      input: {
        id: randomUUIDv7(),
        companyId: company,
        username: `karin_${randomUUIDv7().slice(-6)}`,
        name: 'Karin Dahl',
        email: `karin_${randomUUIDv7().slice(-6)}@example.test`,
      },
    });
    expect(created.errors).toBeUndefined();
    const userId = created.data?.coreCreateUser.user.id ?? '';

    const role = await admin.client.send<{ coreCreateRole: { id: string; name: string } }>(
      createRoleMutation,
      {
        input: {
          id: randomUUIDv7(),
          companyId: company,
          name: 'Shift lead',
          permissions: ['core.article:read'],
        },
      },
    );
    expect(role.errors).toBeUndefined();
    const roleId = role.data?.coreCreateRole.id ?? '';

    const renamed = await admin.client.send<{ coreUpdateRole: { name: string; version: number } }>(
      updateRoleMutation,
      {
        input: {
          id: roleId,
          expectedVersion: 1,
          name: 'Shift leader',
          permissions: ['core.article:read'],
        },
      },
    );
    expect(renamed.data?.coreUpdateRole).toEqual({ name: 'Shift leader', version: 2 });

    const assigned = await admin.client.send<{
      coreAssignRole: { id: string; scope: { kind: string; name: string }; role: { name: string } };
    }>(assignMutation, {
      input: { id: randomUUIDv7(), companyId: company, userId, roleId, scopeId: plantB },
    });
    expect(assigned.errors).toBeUndefined();
    expect(assigned.data?.coreAssignRole.scope).toEqual({ kind: 'PLANT', name: 'Plant B' });

    const removed = await admin.client.send(removeMutation, {
      input: { id: assigned.data?.coreAssignRole.id },
    });
    expect(removed.errors).toBeUndefined();

    const deleted = await admin.client.send(deleteRoleMutation, {
      input: { id: roleId, expectedVersion: 2 },
    });
    expect(deleted.errors).toBeUndefined();

    const blocked = await admin.client.send<{ coreBlockUser: { blocked: boolean } }>(
      blockMutation,
      { input: { id: userId, companyId: company } },
    );
    const unblocked = await admin.client.send<{ coreUnblockUser: { blocked: boolean } }>(
      unblockMutation,
      { input: { id: userId, companyId: company } },
    );
    expect(blocked.data?.coreBlockUser.blocked).toBe(true);
    expect(unblocked.data?.coreUnblockUser.blocked).toBe(false);
  });

  it('E04-S02 from company settings a role is assigned only at the company or one of its plants, and a Plant admin creates no user', async () => {
    const { company, admin, sara, plantA } = await acme();
    const other = await givenCompany(db.ownerUrl);
    const roles = await admin.client.send<RolesAnswer>(rolesQuery, { companyId: company });
    const roleId = roles.data?.coreRoles[0]?.id;
    const plantAdmin = await signedIn([{ scopeId: plantA, permissions: companyAdmin }]);

    const elsewhere = await admin.client.send(assignMutation, {
      input: {
        id: randomUUIDv7(),
        companyId: company,
        userId: sara.userId,
        roleId,
        scopeId: other.plants[0],
      },
    });
    const created = await plantAdmin.client.send(createUserMutation, {
      input: {
        id: randomUUIDv7(),
        companyId: company,
        username: `erik_${randomUUIDv7().slice(-6)}`,
        name: 'Erik Lind',
        email: `erik_${randomUUIDv7().slice(-6)}@example.test`,
      },
    });

    expect(errorCodes(elsewhere)).toEqual(['core.forbidden']);
    expect(errorCodes(created)).toEqual(['core.forbidden']);
  });

  it('E04-S02 corePlantRoleAssignments lists the role assignments at the request plant only, by the holder name', async () => {
    const { company, plantA, plantB, slugs } = await acme();
    const reader = await signedIn(
      [{ scopeId: plantA, permissions: ['core.user:read', 'core.role:read'] }],
      slugs[0],
    );
    const atB = await signedIn([{ scopeId: plantB, permissions: ['core.article:read'] }]);
    await signedIn([{ scopeId: company, permissions: ['core.article:read'] }]);

    const answer = await reader.client.send<PlantAssignmentsAnswer>(plantAssignmentsQuery);

    expect(answer.errors).toBeUndefined();
    const rows = answer.data?.corePlantRoleAssignments ?? [];
    expect(rows.every(({ scope }) => scope.kind === 'PLANT' && scope.name === 'Plant A')).toBe(
      true,
    );
    expect(rows.map(({ user }) => user.username)).not.toContain(atB.username);
    expect(rows.map(({ user }) => user.username)).toContain(reader.username);
    const names = rows.map(({ user }) => user.username);
    expect(names).toEqual([...names].sort());
  });

  it('E04-S02 corePlantRoleAssignments needs core.user:read at the plant', async () => {
    const { plantA, slugs } = await acme();
    const reader = await signedIn(
      [{ scopeId: plantA, permissions: ['core.article:read'] }],
      slugs[0],
    );

    const answer = await reader.client.send(plantAssignmentsQuery);

    expect(errorCodes(answer)).toEqual(['core.forbidden']);
  });
});
