// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUIDv7 } from 'node:crypto';
import {
  type Grant,
  givenAssignment,
  givenCompany,
  hostFactory,
  signIn,
} from '@northmes/backend/testing';
import { createTestApp, gqlClient, query, type TestApp, useTestDatabase } from '@northmes/testing';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const assignmentFields = 'id scope { kind name } user { id username } role { name }';

const assignMutation = `mutation ($input: CoreAssignRoleInput!) {
  coreAssignRole(input: $input) { ${assignmentFields} }
}`;

const removeMutation = `mutation ($input: CoreRemoveRoleAssignmentInput!) {
  coreRemoveRoleAssignment(input: $input) { ${assignmentFields} }
}`;

const createRoleMutation = `mutation ($input: CoreCreateRoleInput!) {
  coreCreateRole(input: $input) { id }
}`;

const userQuery = `query ($id: ID!) {
  coreUser(id: $id) { roleAssignments { id scope { name } role { name } } }
}`;

interface Assignment {
  id: string;
  scope: { kind: string; name: string };
  user: { id: string; username: string };
  role: { name: string };
}

/** What an assigner needs besides the permissions of the role they hand out. */
const assigner = ['core.roleAssignment:manage', 'core.role:read', 'core.user:read'];

describe('coreAssignRole and coreRemoveRoleAssignment', () => {
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
  async function signedIn(grants: readonly Grant[], plant: string) {
    if (!testApp) throw new Error('the test app did not start');
    const user = await signIn(testApp.app, db.ownerUrl, grants);
    const client = gqlClient(await testApp.app.getUrl(), {
      headers: { authorization: user.authorization, 'x-northmes-plant': plant },
    });
    return { ...user, client };
  }

  /**
   * A company with Plant A and Plant B, its company admin at Plant A, who makes the role Shift
   * lead (core.article:read, core.article:update), and Sara, a user of the company who reads
   * articles at Plant A.
   */
  async function company() {
    const given = await givenCompany(db.ownerUrl, {
      name: 'Acme AB',
      plantNames: ['Plant A', 'Plant B'],
    });
    const [plantA = '', plantB = ''] = given.plants;
    const [slugA = '', slugB = ''] = given.slugs;
    const admin = await signedIn(
      [
        {
          scopeId: given.company,
          permissions: [
            ...assigner,
            'core.role:manage',
            'core.article:read',
            'core.article:update',
          ],
        },
      ],
      slugA,
    );
    const created = await admin.client.send<{ coreCreateRole: { id: string } }>(
      createRoleMutation,
      {
        input: {
          id: randomUUIDv7(),
          name: 'Shift lead',
          permissions: ['core.article:read', 'core.article:update'],
        },
      },
    );
    const roleId = created.data?.coreCreateRole.id ?? '';
    const sara = await signedIn([{ scopeId: plantA, permissions: ['core.article:read'] }], slugA);
    return { ...given, plantA, plantB, slugA, slugB, admin, roleId, sara };
  }

  /** The errorCode and details of an answer's errors. */
  function refusals(answer: { readonly errors?: readonly { extensions?: unknown }[] }) {
    return answer.errors?.map(({ extensions }) => {
      const { code, errorCode, details } = extensions as Record<string, unknown>;
      return { code, errorCode, ...(details ? { details } : {}) };
    });
  }

  it("E05-S06 coreAssignRole gives a user a role at the request's plant, a retry returns the first assignment, and the user's roles list it", async () => {
    const { admin, roleId, sara, plantA } = await company();
    const input = { id: randomUUIDv7(), userId: sara.userId, roleId, scopeId: plantA };

    const answer = await admin.client.send<{ coreAssignRole: Assignment }>(assignMutation, {
      input,
    });
    const retry = await admin.client.send<{ coreAssignRole: Assignment }>(assignMutation, {
      input,
    });
    const again = await admin.client.send(assignMutation, {
      input: { ...input, id: randomUUIDv7() },
    });
    const roles = await admin.client.send<{
      coreUser: { roleAssignments: { id: string; role: { name: string } }[] };
    }>(userQuery, { id: sara.userId });

    expect(answer.errors).toBeUndefined();
    expect(answer.data?.coreAssignRole).toEqual({
      id: input.id,
      scope: { kind: 'PLANT', name: 'Plant A' },
      user: { id: sara.userId, username: sara.username },
      role: { name: 'Shift lead' },
    });
    expect(retry.data?.coreAssignRole).toEqual(answer.data?.coreAssignRole);
    expect(refusals(again)).toEqual([
      {
        code: 'CONFLICT',
        errorCode: 'core.role_already_assigned',
        details: { assignmentId: input.id },
      },
    ]);
    expect(roles.data?.coreUser.roleAssignments).toContainEqual({
      id: input.id,
      scope: { name: 'Plant A' },
      role: { name: 'Shift lead' },
    });
  });

  it('E05-S06 assigning a role is refused with core.role_not_held when the assigner lacks one of its permissions at that scope', async () => {
    const { roleId, sara, plantA, slugA } = await company();
    const plantAdmin = await signedIn(
      [{ scopeId: plantA, permissions: [...assigner, 'core.article:read'] }],
      slugA,
    );

    const answer = await plantAdmin.client.send(assignMutation, {
      input: { id: randomUUIDv7(), userId: sara.userId, roleId, scopeId: plantA },
    });

    expect(refusals(answer)).toEqual([
      {
        code: 'FORBIDDEN',
        errorCode: 'core.role_not_held',
        details: { scopeId: plantA, missingPermissions: ['core.article:update'] },
      },
    ]);
  });

  it('E05-S06 a plant admin who holds every permission of the role at the plant assigns it there, but not at the company', async () => {
    const { company: companyId, roleId, sara, plantA, slugA } = await company();
    const plantAdmin = await signedIn(
      [
        {
          scopeId: plantA,
          permissions: [...assigner, 'core.article:read', 'core.article:update'],
        },
      ],
      slugA,
    );

    const atPlant = await plantAdmin.client.send(assignMutation, {
      input: { id: randomUUIDv7(), userId: sara.userId, roleId, scopeId: plantA },
    });
    const atCompany = await plantAdmin.client.send(assignMutation, {
      input: { id: randomUUIDv7(), userId: sara.userId, roleId, scopeId: companyId },
    });

    expect(atPlant.errors).toBeUndefined();
    expect(refusals(atCompany)).toEqual([{ code: 'FORBIDDEN', errorCode: 'core.forbidden' }]);
  });

  it("E05-S06 holding the role's permissions at the company grants assigning it at a plant, but not at a plant other than the request's", async () => {
    const { admin, roleId, sara, plantA, plantB } = await company();

    const atPlantA = await admin.client.send(assignMutation, {
      input: { id: randomUUIDv7(), userId: sara.userId, roleId, scopeId: plantA },
    });
    const atPlantB = await admin.client.send(assignMutation, {
      input: { id: randomUUIDv7(), userId: sara.userId, roleId, scopeId: plantB },
    });

    expect(atPlantA.errors).toBeUndefined();
    expect(refusals(atPlantB)).toEqual([{ code: 'FORBIDDEN', errorCode: 'core.forbidden' }]);
  });

  it('E05-S06 a role or a user of another company is not found', async () => {
    const { admin, roleId, sara, plantA } = await company();
    const other = await company();

    const otherRole = await admin.client.send(assignMutation, {
      input: { id: randomUUIDv7(), userId: sara.userId, roleId: other.roleId, scopeId: plantA },
    });
    const otherUser = await admin.client.send(assignMutation, {
      input: { id: randomUUIDv7(), userId: other.sara.userId, roleId, scopeId: plantA },
    });

    expect(otherRole.errors?.map(({ extensions }) => extensions?.code)).toEqual(['NOT_FOUND']);
    expect(otherUser.errors?.map(({ extensions }) => extensions?.code)).toEqual(['NOT_FOUND']);
  });

  it("E05-S06 coreRemoveRoleAssignment takes the role away, and the user's next request is refused", async () => {
    const { admin, sara } = await company();
    const saraArticles = () => sara.client.send('{ coreArticles { totalCount } }');
    const before = await saraArticles();
    const roles = await admin.client.send<{
      coreUser: { roleAssignments: { id: string }[] };
    }>(userQuery, { id: sara.userId });
    const [assignment] = roles.data?.coreUser.roleAssignments ?? [];

    const answer = await admin.client.send<{ coreRemoveRoleAssignment: Assignment }>(
      removeMutation,
      { input: { id: assignment?.id, reason: 'Moved to Plant B' } },
    );
    const after = await saraArticles();
    const again = await admin.client.send(removeMutation, { input: { id: assignment?.id } });

    expect(before.errors).toBeUndefined();
    expect(answer.errors).toBeUndefined();
    expect(answer.data?.coreRemoveRoleAssignment).toMatchObject({
      id: assignment?.id,
      scope: { kind: 'PLANT', name: 'Plant A' },
      user: { id: sara.userId },
    });
    expect(after.errors?.map(({ extensions }) => extensions)).toEqual([
      { code: 'FORBIDDEN', errorCode: 'core.plant_forbidden' },
    ]);
    expect(again.errors?.map(({ extensions }) => extensions?.code)).toEqual(['NOT_FOUND']);
  });

  it('E05-S06 removing an assignment is refused with core.role_not_held when the remover lacks a permission of its role there', async () => {
    const { admin, roleId, sara, plantA, slugA } = await company();
    const assigned = await admin.client.send<{ coreAssignRole: Assignment }>(assignMutation, {
      input: { id: randomUUIDv7(), userId: sara.userId, roleId, scopeId: plantA },
    });
    const plantAdmin = await signedIn(
      [{ scopeId: plantA, permissions: [...assigner, 'core.article:read'] }],
      slugA,
    );

    const answer = await plantAdmin.client.send(removeMutation, {
      input: { id: assigned.data?.coreAssignRole.id },
    });

    expect(refusals(answer)).toEqual([
      {
        code: 'FORBIDDEN',
        errorCode: 'core.role_not_held',
        details: { scopeId: plantA, missingPermissions: ['core.article:update'] },
      },
    ]);
  });

  it('E05-S06 a plant admin cannot remove an assignment at the company, and an assignment at another plant is not found', async () => {
    const { company: companyId, admin, roleId, sara, plantA, plantB, slugA } = await company();
    const atCompany = await admin.client.send<{ coreAssignRole: Assignment }>(assignMutation, {
      input: { id: randomUUIDv7(), userId: sara.userId, roleId, scopeId: companyId },
    });
    const atPlantB = await givenAssignment(db.ownerUrl, {
      userId: sara.userId,
      roleId,
      scopeId: plantB,
    });
    const plantAdmin = await signedIn(
      [
        {
          scopeId: plantA,
          permissions: [...assigner, 'core.article:read', 'core.article:update'],
        },
      ],
      slugA,
    );

    const companyRemoval = await plantAdmin.client.send(removeMutation, {
      input: { id: atCompany.data?.coreAssignRole.id },
    });
    const plantBRemoval = await admin.client.send(removeMutation, { input: { id: atPlantB } });

    expect(refusals(companyRemoval)).toEqual([
      { code: 'FORBIDDEN', errorCode: 'core.forbidden' },
    ]);
    expect(plantBRemoval.errors?.map(({ extensions }) => extensions?.code)).toEqual([
      'NOT_FOUND',
    ]);
  });

  it('E05-S06 an assignment waits for a change to its role that is in flight, and the grant rule reads the role as that change left it', async () => {
    const { roleId, sara, plantA, slugA } = await company();
    const plantAdmin = await signedIn(
      [
        {
          scopeId: plantA,
          permissions: [...assigner, 'core.article:read', 'core.article:update'],
        },
      ],
      slugA,
    );
    // A change to the role, as coreUpdateRole makes it: it holds the role's lock while it adds a
    // permission that the plant admin does not hold.
    const change = new Client({ connectionString: db.ownerUrl });
    await change.connect();
    try {
      await change.query('begin');
      await change.query('set local role nm_mod_core');
      await change.query(
        `select pg_advisory_xact_lock(hashtextextended('core.role:' || $1::text, 0))`,
        [roleId],
      );
      await change.query(
        `update core.role set permissions = array_append(permissions, 'core.article:archive')
          where id = $1`,
        [roleId],
      );

      const pending = plantAdmin.client.send(assignMutation, {
        input: { id: randomUUIDv7(), userId: sara.userId, roleId, scopeId: plantA },
      });
      await vi.waitFor(
        async () => {
          const waiting = await query(
            db.ownerUrl,
            `select pid from pg_locks
              where locktype = 'advisory' and not granted
                and database = (select oid from pg_database where datname = current_database())`,
          );
          expect(waiting).toHaveLength(1);
        },
        { timeout: 2000, interval: 50 },
      );
      await change.query('commit');
      const answer = await pending;

      expect(refusals(answer)).toEqual([
        {
          code: 'FORBIDDEN',
          errorCode: 'core.role_not_held',
          details: { scopeId: plantA, missingPermissions: ['core.article:archive'] },
        },
      ]);
    } finally {
      await change.end();
    }
  });
});
