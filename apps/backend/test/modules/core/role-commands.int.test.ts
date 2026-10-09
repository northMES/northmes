// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUIDv7 } from 'node:crypto';
import {
  type Grant,
  givenAssignment,
  givenCompany,
  hostFactory,
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

const fields = 'id key name origin permissions version';

const createMutation = `mutation ($input: CoreCreateRoleInput!) {
  coreCreateRole(input: $input) { ${fields} }
}`;

const updateMutation = `mutation ($input: CoreUpdateRoleInput!) {
  coreUpdateRole(input: $input) { ${fields} }
}`;

const deleteMutation = `mutation ($input: CoreDeleteRoleInput!) {
  coreDeleteRole(input: $input) { id name }
}`;

const rolesQuery = `{ coreRoles { ${fields} } }`;

interface Role {
  id: string;
  key: string;
  name: string;
  origin: 'MODULE' | 'CUSTOM';
  permissions: string[];
  version: number;
}

/** Every permission a company admin needs to edit roles and read them. */
const roleAdmin = ['core.role:manage', 'core.role:read'];

describe('coreCreateRole, coreUpdateRole and coreDeleteRole', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core', 'planning'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /** A fresh signed-in user with no role, whom a test gives roles. */
  async function someone(): Promise<string> {
    if (!testApp) throw new Error('the test app did not start');
    return (await signIn(testApp.app, db.ownerUrl, [])).userId;
  }

  /** A client of a fresh user with these grants, at the plant with this slug. */
  async function clientWith(grants: readonly Grant[], plant: string): Promise<GqlClient> {
    if (!testApp) throw new Error('the test app did not start');
    const { authorization } = await signIn(testApp.app, db.ownerUrl, grants);
    return gqlClient(await testApp.app.getUrl(), {
      headers: { authorization, 'x-northmes-plant': plant },
    });
  }

  /** A company with two plants and a client of its company admin at the first plant. */
  async function companyAdmin() {
    const company = await givenCompany(db.ownerUrl, { plantNames: ['Plant A', 'Plant B'] });
    const client = await clientWith(
      [{ scopeId: company.company, permissions: [...roleAdmin, 'planning.productionOrder:read'] }],
      company.slugs[0] ?? '',
    );
    return { ...company, client };
  }

  /** Creates a custom role through coreCreateRole and returns it. */
  async function createRole(
    client: GqlClient,
    name: string,
    permissions: readonly string[],
  ): Promise<Role> {
    const answer = await client.send<{ coreCreateRole: Role }>(createMutation, {
      input: { id: randomUUIDv7(), name, permissions },
    });
    if (!answer.data) throw new Error(`the create failed: ${JSON.stringify(answer.errors)}`);
    return answer.data.coreCreateRole;
  }

  /** The errorCode and fieldErrors of an answer's errors. */
  function refusals(answer: { readonly errors?: readonly { extensions?: unknown }[] }) {
    return answer.errors?.map(({ extensions }) => {
      const { errorCode, code, fieldErrors } = extensions as Record<string, unknown>;
      return { code, errorCode, ...(fieldErrors ? { fieldErrors } : {}) };
    });
  }

  it('E05-S06 coreCreateRole creates a custom role of the company with its permissions sorted once each, and a retry returns the first role', async () => {
    const { client } = await companyAdmin();
    const input = {
      id: randomUUIDv7(),
      name: '  Night planner ',
      permissions: ['planning.productionOrder:read', 'core.article:read', 'core.article:read'],
    };

    const first = await client.send<{ coreCreateRole: Role }>(createMutation, { input });
    const retry = await client.send<{ coreCreateRole: Role }>(createMutation, { input });
    const roles = await client.send<{ coreRoles: Role[] }>(rolesQuery);

    expect(first.errors).toBeUndefined();
    expect(first.data?.coreCreateRole).toEqual({
      id: input.id,
      key: expect.stringMatching(/^custom-/),
      name: 'Night planner',
      origin: 'CUSTOM',
      permissions: ['core.article:read', 'planning.productionOrder:read'],
      version: 1,
    });
    expect(retry.data?.coreCreateRole).toEqual(first.data?.coreCreateRole);
    expect(roles.data?.coreRoles.filter(({ name }) => name === 'Night planner')).toHaveLength(1);
  });

  it('E05-S06 coreCreateRole refuses a name a role of the company has, ignoring case, and a permission the catalog does not hold', async () => {
    const { client } = await companyAdmin();
    await createRole(client, 'Shift lead', ['core.article:read']);

    const taken = await client.send(createMutation, {
      input: { id: randomUUIDv7(), name: 'shift LEAD', permissions: [] },
    });
    const defaultName = await client.send(createMutation, {
      input: { id: randomUUIDv7(), name: 'Planner', permissions: [] },
    });
    const unknown = await client.send(createMutation, {
      input: { id: randomUUIDv7(), name: 'Kanban', permissions: ['kanban.board:read'] },
    });

    const nameTaken = {
      code: 'CONFLICT',
      errorCode: 'core.role_name_taken',
      fieldErrors: [
        {
          path: ['name'],
          message: 'A role of this company has that name. Choose another name.',
          code: 'core.role_name_taken',
        },
      ],
    };
    expect(refusals(taken)).toEqual([nameTaken]);
    expect(refusals(defaultName)).toEqual([nameTaken]);
    expect(refusals(unknown)).toEqual([
      {
        code: 'BAD_USER_INPUT',
        errorCode: 'core.unknown_permission',
        fieldErrors: [
          {
            path: ['permissions'],
            message: 'kanban.board:read is not a permission of an installed module.',
            code: 'core.unknown_permission',
          },
        ],
      },
    ]);
  });

  it('E05-S06 a plant admin, who holds core.role:manage at the plant only, can neither create nor update a role of the company', async () => {
    const { client: admin, plants, slugs } = await companyAdmin();
    const role = await createRole(admin, 'Shift lead', ['core.article:read']);
    const plantAdmin = await clientWith(
      [{ scopeId: plants[0] ?? '', permissions: roleAdmin }],
      slugs[0] ?? '',
    );

    const created = await plantAdmin.send(createMutation, {
      input: { id: randomUUIDv7(), name: 'Plant role', permissions: [] },
    });
    const updated = await plantAdmin.send(updateMutation, {
      input: { id: role.id, expectedVersion: 1, name: 'Shift lead', permissions: [] },
    });

    expect(refusals(created)).toEqual([{ code: 'FORBIDDEN', errorCode: 'core.forbidden' }]);
    expect(refusals(updated)).toEqual([{ code: 'FORBIDDEN', errorCode: 'core.forbidden' }]);
  });

  it('E05-S06 coreUpdateRole changes the name and the permissions and bumps the version, and a stale version is refused', async () => {
    const { client } = await companyAdmin();
    const role = await createRole(client, 'Shift lead', ['core.article:read']);

    const answer = await client.send<{ coreUpdateRole: Role }>(updateMutation, {
      input: {
        id: role.id,
        expectedVersion: 1,
        name: 'Shift leader',
        permissions: ['planning.productionOrder:read'],
        reason: 'Shift leads plan the night shift',
      },
    });
    const stale = await client.send(updateMutation, {
      input: { id: role.id, expectedVersion: 1, name: 'Shift lead', permissions: [] },
    });

    expect(answer.errors).toBeUndefined();
    expect(answer.data?.coreUpdateRole).toMatchObject({
      name: 'Shift leader',
      permissions: ['planning.productionOrder:read'],
      version: 2,
    });
    expect(refusals(stale)).toEqual([{ code: 'CONFLICT', errorCode: 'core.version_conflict' }]);
  });

  it('E05-S06 a default role is refused for update and delete with core.role_not_custom', async () => {
    const { client } = await companyAdmin();
    const roles = await client.send<{ coreRoles: Role[] }>(rolesQuery);
    const planner = roles.data?.coreRoles.find(({ key }) => key === 'planning-planner');
    if (!planner) throw new Error('the company has no Planner role');

    const updated = await client.send(updateMutation, {
      input: { id: planner.id, expectedVersion: planner.version, name: 'Planner', permissions: [] },
    });
    const deleted = await client.send(deleteMutation, {
      input: { id: planner.id, expectedVersion: planner.version },
    });

    expect(refusals(updated)).toEqual([
      { code: 'PRECONDITION', errorCode: 'core.role_not_custom' },
    ]);
    expect(refusals(deleted)).toEqual([
      { code: 'PRECONDITION', errorCode: 'core.role_not_custom' },
    ]);
  });

  it('E05-S06 adding a permission to a role is refused when the editor lacks it at a plant where the role is assigned', async () => {
    const { client, plants } = await companyAdmin();
    const [, plantB = ''] = plants;
    const role = await createRole(client, 'Shift lead', ['core.article:read']);
    // The editor holds core.role:manage at the company, but not planning.productionOrder:release.
    await givenAssignment(db.ownerUrl, {
      userId: await someone(),
      roleId: role.id,
      scopeId: plantB,
    });

    const answer = await client.send(updateMutation, {
      input: {
        id: role.id,
        expectedVersion: 1,
        name: 'Shift lead',
        permissions: ['core.article:read', 'planning.productionOrder:release'],
      },
    });

    expect(answer.errors?.map(({ extensions }) => extensions)).toEqual([
      {
        code: 'FORBIDDEN',
        errorCode: 'core.role_not_held',
        details: { scopeId: plantB, missingPermissions: ['planning.productionOrder:release'] },
      },
    ]);
  });

  it('E05-S06 coreDeleteRole deletes a custom role nobody holds, and refuses one that is held with core.role_in_use', async () => {
    const { client, company } = await companyAdmin();
    const unheld = await createRole(client, 'Report checker', ['core.article:read']);
    const held = await createRole(client, 'Shift lead', ['core.article:read']);
    await givenAssignment(db.ownerUrl, {
      userId: await someone(),
      roleId: held.id,
      scopeId: company,
    });

    const deleted = await client.send<{ coreDeleteRole: { id: string; name: string } }>(
      deleteMutation,
      { input: { id: unheld.id, expectedVersion: 1 } },
    );
    const inUse = await client.send(deleteMutation, {
      input: { id: held.id, expectedVersion: 1 },
    });
    const roles = await client.send<{ coreRoles: Role[] }>(rolesQuery);

    expect(deleted.data?.coreDeleteRole).toEqual({ id: unheld.id, name: 'Report checker' });
    expect(refusals(inUse)).toEqual([{ code: 'PRECONDITION', errorCode: 'core.role_in_use' }]);
    expect(roles.data?.coreRoles.map(({ name }) => name)).not.toContain('Report checker');
  });
});
