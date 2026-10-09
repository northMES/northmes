// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUIDv7 } from 'node:crypto';
import { type Grant, givenCompany, hostFactory, signIn } from '@northmes/backend/testing';
import {
  createTestApp,
  type GqlClient,
  gqlClient,
  query,
  type TestApp,
  useTestDatabase,
} from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { userIdOf } from '../../../src/modules/core/core/commands/create-user.handler.ts';

const createMutation = `mutation ($input: CoreCreateUserInput!) {
  coreCreateUser(input: $input) { user { id name username blocked } temporaryPassword }
}`;

const blockMutation = `mutation ($input: CoreBlockUserInput!) {
  coreBlockUser(input: $input) { id username blocked }
}`;

const unblockMutation = `mutation ($input: CoreUnblockUserInput!) {
  coreUnblockUser(input: $input) { id username blocked }
}`;

const usersQuery = `{ coreUsers { edges { node { id username blocked roleAssignments { id } } } } }`;

interface CreatedUser {
  user: { id: string; name: string; username: string; blocked: boolean };
  temporaryPassword: string;
}

interface UsersAnswer {
  coreUsers: {
    edges: {
      node: { id: string; username: string; blocked: boolean; roleAssignments: { id: string }[] };
    }[];
  };
}

/** What a company admin holds to manage users. */
const userAdmin = ['core.user:read', 'core.user:create', 'core.user:block', 'core.role:read'];

describe('coreCreateUser, coreBlockUser and coreUnblockUser', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;
  let url = '';

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core', 'planning'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
    url = await testApp.app.getUrl();
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /** A fresh signed-in user with these grants, and a client of theirs at the plant `plant`. */
  async function signedIn(grants: readonly Grant[], plant: string) {
    if (!testApp) throw new Error('the test app did not start');
    const user = await signIn(testApp.app, db.ownerUrl, grants);
    const client = gqlClient(url, {
      headers: { authorization: user.authorization, 'x-northmes-plant': plant },
    });
    return { ...user, client };
  }

  /** A company with one plant and a client of its user admin at the plant. */
  async function company() {
    const given = await givenCompany(db.ownerUrl, { name: 'Acme AB' });
    const admin = await signedIn(
      [{ scopeId: given.company, permissions: userAdmin }],
      given.slugs[0] ?? '',
    );
    return { ...given, admin };
  }

  /** Signs in by email through Better Auth's handler and answers its status. */
  async function signInStatus(email: string, password: string): Promise<number> {
    const answer = await fetch(`${url}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return answer.status;
  }

  /** Creates a user through coreCreateUser and returns the answer's data. */
  async function createUser(client: GqlClient, input: Record<string, unknown>) {
    const answer = await client.send<{ coreCreateUser: CreatedUser }>(createMutation, { input });
    if (!answer.data) throw new Error(`the create failed: ${JSON.stringify(answer.errors)}`);
    return answer.data.coreCreateUser;
  }

  /** The errorCode and fieldErrors of an answer's errors. */
  function refusals(answer: { readonly errors?: readonly { extensions?: unknown }[] }) {
    return answer.errors?.map(({ extensions }) => {
      const { code, errorCode, fieldErrors } = extensions as Record<string, unknown>;
      return { code, errorCode, ...(fieldErrors ? { fieldErrors } : {}) };
    });
  }

  it('E05-S08 coreCreateUser creates a user of the company with a temporary password, who signs in with it and is listed without a role', async () => {
    const { admin } = await company();

    const created = await createUser(admin.client, {
      id: randomUUIDv7(),
      username: ' T.Lindqvist ',
      name: 'Tove Lindqvist',
      email: 'tove.lindqvist@example.test',
    });
    const users = await admin.client.send<UsersAnswer>(usersQuery);

    expect(created.user).toEqual({
      id: expect.any(String),
      name: 'Tove Lindqvist',
      username: 't.lindqvist',
      blocked: false,
    });
    expect(created.temporaryPassword).toMatch(/^\S{16,}$/);
    expect(await signInStatus('tove.lindqvist@example.test', created.temporaryPassword)).toBe(200);
    expect(users.data?.coreUsers.edges.map(({ node }) => node)).toContainEqual({
      id: created.user.id,
      username: 't.lindqvist',
      blocked: false,
      roleAssignments: [],
    });
  });

  it('E05-S08 coreCreateUser refuses a username that is taken and an email another user has', async () => {
    const { admin } = await company();
    await createUser(admin.client, {
      id: randomUUIDv7(),
      username: 'anna.berg',
      name: 'Anna Berg',
      email: 'anna@example.com',
    });

    const username = await admin.client.send(createMutation, {
      input: { id: randomUUIDv7(), username: 'Anna.Berg', name: 'Anna B' },
    });
    const email = await admin.client.send(createMutation, {
      input: { id: randomUUIDv7(), username: 'anna.b', name: 'Anna B', email: 'anna@example.com' },
    });

    expect(refusals(username)).toEqual([
      {
        code: 'CONFLICT',
        errorCode: 'core.username_taken',
        fieldErrors: [
          {
            path: ['username'],
            message: 'The username anna.berg is taken or was used before. Choose another username.',
            code: 'core.username_taken',
          },
        ],
      },
    ]);
    expect(refusals(email)).toEqual([
      {
        code: 'CONFLICT',
        errorCode: 'core.email_taken',
        fieldErrors: [
          {
            path: ['email'],
            message: 'Another user has this email address. Enter another one, or leave it empty.',
            code: 'core.email_taken',
          },
        ],
      },
    ]);
  });

  it('E05-S08 a retry of coreCreateUser whose first run created the user in Better Auth but failed before the company membership finishes the creation under the same id', async () => {
    const { admin } = await company();
    const id = randomUUIDv7();
    const userId = userIdOf(id);
    // What a first run leaves when it fails after Better Auth wrote the user: no password, no
    // membership and no role.
    await query(
      db.authUrl,
      `insert into auth."user" (id, name, email, "emailVerified", username, "displayUsername")
       values ('${userId}', 'Ida Holm', 'ida.holm@example.test', false, 'i.holm', 'i.holm')`,
    );

    const retried = await createUser(admin.client, {
      id,
      username: 'i.holm',
      name: 'Ida Holm',
      email: 'ida.holm@example.test',
    });
    const users = await admin.client.send<UsersAnswer>(usersQuery);

    expect(retried.user).toEqual({
      id: userId,
      name: 'Ida Holm',
      username: 'i.holm',
      blocked: false,
    });
    expect(await signInStatus('ida.holm@example.test', retried.temporaryPassword)).toBe(200);
    expect(users.data?.coreUsers.edges.map(({ node }) => node.id)).toContain(userId);
  });

  it("E05-S08 a retry of coreCreateUser after its first run finished is refused with core.user_created_password_hidden and the user's id, and keeps the first temporary password", async () => {
    const { admin } = await company();
    const input = {
      id: randomUUIDv7(),
      username: 'o.ek',
      name: 'Olle Ek',
      email: 'olle.ek@example.test',
    };
    const first = await createUser(admin.client, input);

    const retried = await admin.client.send(createMutation, { input });

    expect(retried.errors?.map(({ extensions }) => extensions)).toEqual([
      expect.objectContaining({
        code: 'CONFLICT',
        errorCode: 'core.user_created_password_hidden',
        details: { userId: first.user.id },
      }),
    ]);
    expect(refusals(retried)?.[0]?.fieldErrors).toBeUndefined();
    expect(await signInStatus('olle.ek@example.test', first.temporaryPassword)).toBe(200);
  });

  it('E05-S08 a retry of coreCreateUser with another username, or from another company, is NOT_FOUND and leaves the first user as they were', async () => {
    const { admin } = await company();
    const other = await company();
    const id = randomUUIDv7();
    const alva = { username: 'a.lund', name: 'Alva Lund', email: 'alva.lund@example.test' };
    const first = await createUser(admin.client, { id, ...alva });

    const otherUsername = await admin.client.send(createMutation, {
      input: { id, ...alva, username: 'a.lund2' },
    });
    const otherCompany = await other.admin.client.send(createMutation, {
      input: { id, ...alva },
    });

    expect(otherUsername.errors?.map(({ extensions }) => extensions?.code)).toEqual(['NOT_FOUND']);
    expect(otherCompany.errors?.map(({ extensions }) => extensions?.code)).toEqual(['NOT_FOUND']);
    expect(await signInStatus('alva.lund@example.test', first.temporaryPassword)).toBe(200);
  });

  it('E05-S08 a retried coreBlockUser or coreUnblockUser answers the same user, also after a first run that blocked the user in Better Auth and failed before it answered', async () => {
    const { company: companyId, slugs, admin } = await company();
    const operator = await signedIn(
      [{ scopeId: companyId, permissions: ['core.article:read'] }],
      slugs[0] ?? '',
    );
    // What a first run leaves when its transaction fails after Better Auth wrote the block.
    await query(db.authUrl, `update auth."user" set banned = true where id = '${operator.userId}'`);

    const blocks = [
      await admin.client.send(blockMutation, { input: { id: operator.userId } }),
      await admin.client.send(blockMutation, { input: { id: operator.userId } }),
    ];
    const sessionsAfterBlock = await query<{ count: string }>(
      db.authUrl,
      `select count(*) from auth.session where "userId" = '${operator.userId}'`,
    );
    const unblocks = [
      await admin.client.send(unblockMutation, { input: { id: operator.userId } }),
      await admin.client.send(unblockMutation, { input: { id: operator.userId } }),
    ];

    for (const answer of blocks) {
      expect(answer.errors).toBeUndefined();
      expect(answer.data).toEqual({
        coreBlockUser: { id: operator.userId, username: operator.username, blocked: true },
      });
    }
    expect(sessionsAfterBlock).toEqual([{ count: '0' }]);
    for (const answer of unblocks) {
      expect(answer.errors).toBeUndefined();
      expect(answer.data).toEqual({
        coreUnblockUser: { id: operator.userId, username: operator.username, blocked: false },
      });
    }
    expect(await signInStatus(operator.email, operator.password)).toBe(200);
  });

  it('E05-S08 a plant admin with core.user:create at the plant only cannot create a user of the company', async () => {
    const { plants, slugs } = await company();
    const plantAdmin = await signedIn(
      [{ scopeId: plants[0] ?? '', permissions: userAdmin }],
      slugs[0] ?? '',
    );

    const answer = await plantAdmin.client.send(createMutation, {
      input: { id: randomUUIDv7(), username: 'plant.user', name: 'Plant user' },
    });

    expect(refusals(answer)).toEqual([{ code: 'FORBIDDEN', errorCode: 'core.forbidden' }]);
  });

  it('E05-S08 a blocked user cannot sign in, and their next request with the token they hold is refused', async () => {
    const { company: companyId, slugs, admin } = await company();
    const operator = await signedIn(
      [{ scopeId: companyId, permissions: ['core.article:read'] }],
      slugs[0] ?? '',
    );
    const before = await operator.client.send('{ coreArticles { totalCount } }');

    const blocked = await admin.client.send<{ coreBlockUser: { blocked: boolean } }>(
      blockMutation,
      { input: { id: operator.userId, reason: 'Left the company' } },
    );
    const after = await operator.client.send('{ coreArticles { totalCount } }');
    const users = await admin.client.send<UsersAnswer>(usersQuery);

    expect(before.errors).toBeUndefined();
    expect(blocked.errors).toBeUndefined();
    expect(blocked.data?.coreBlockUser.blocked).toBe(true);
    expect(after.errors?.map(({ extensions }) => extensions?.code)).toEqual(['UNAUTHENTICATED']);
    expect(await signInStatus(operator.email, operator.password)).not.toBe(200);
    expect(
      users.data?.coreUsers.edges.find(({ node }) => node.id === operator.userId)?.node.blocked,
    ).toBe(true);
  });

  it('E05-S08 coreUnblockUser lets a blocked user sign in again', async () => {
    const { company: companyId, slugs, admin } = await company();
    const operator = await signedIn(
      [{ scopeId: companyId, permissions: ['core.article:read'] }],
      slugs[0] ?? '',
    );
    await admin.client.send(blockMutation, { input: { id: operator.userId } });

    const answer = await admin.client.send<{ coreUnblockUser: { blocked: boolean } }>(
      unblockMutation,
      { input: { id: operator.userId } },
    );

    expect(answer.data?.coreUnblockUser.blocked).toBe(false);
    expect(await signInStatus(operator.email, operator.password)).toBe(200);
  });

  it('E05-S08 blocking and unblocking need core.user:block at the company: a plant admin and a reader without it are refused', async () => {
    const { company: companyId, plants, slugs, admin } = await company();
    const operator = await signedIn(
      [{ scopeId: companyId, permissions: ['core.article:read'] }],
      slugs[0] ?? '',
    );
    const plantAdmin = await signedIn(
      [{ scopeId: plants[0] ?? '', permissions: userAdmin }],
      slugs[0] ?? '',
    );
    const reader = await signedIn(
      [{ scopeId: companyId, permissions: ['core.user:read'] }],
      slugs[0] ?? '',
    );
    const input = { id: operator.userId };

    const blocks = [
      await plantAdmin.client.send(blockMutation, { input }),
      await reader.client.send(blockMutation, { input }),
    ];
    await admin.client.send(blockMutation, { input });
    const unblocks = [
      await plantAdmin.client.send(unblockMutation, { input }),
      await reader.client.send(unblockMutation, { input }),
    ];

    for (const answer of [...blocks, ...unblocks]) {
      expect(refusals(answer)).toEqual([{ code: 'FORBIDDEN', errorCode: 'core.forbidden' }]);
    }
    expect(await signInStatus(operator.email, operator.password)).not.toBe(200);
  });

  it('E05-S08 an admin of one company cannot block or unblock a user who also belongs to another company, since a block holds everywhere', async () => {
    const acme = await company();
    const nordic = await company();
    const planner = await signedIn(
      [
        { scopeId: acme.company, permissions: ['core.article:read'] },
        { scopeId: nordic.company, permissions: ['core.article:read'] },
      ],
      acme.slugs[0] ?? '',
    );
    const bothAdmin = await signedIn(
      [
        { scopeId: acme.company, permissions: userAdmin },
        { scopeId: nordic.company, permissions: userAdmin },
      ],
      acme.slugs[0] ?? '',
    );

    const blockedByAcme = await acme.admin.client.send(blockMutation, {
      input: { id: planner.userId },
    });
    const statusAfterRefusal = await signInStatus(planner.email, planner.password);
    const blockedByBoth = await bothAdmin.client.send(blockMutation, {
      input: { id: planner.userId },
    });
    const unblockedByAcme = await acme.admin.client.send(unblockMutation, {
      input: { id: planner.userId },
    });

    expect(refusals(blockedByAcme)).toEqual([{ code: 'FORBIDDEN', errorCode: 'core.forbidden' }]);
    expect(statusAfterRefusal).toBe(200);
    expect(blockedByBoth.errors).toBeUndefined();
    expect(refusals(unblockedByAcme)).toEqual([{ code: 'FORBIDDEN', errorCode: 'core.forbidden' }]);
    expect(await signInStatus(planner.email, planner.password)).not.toBe(200);
  });

  it('E05-S08 coreBlockUser refuses blocking yourself and a user of another company', async () => {
    const { admin } = await company();
    const other = await company();

    const self = await admin.client.send(blockMutation, { input: { id: admin.userId } });
    const elsewhere = await admin.client.send(blockMutation, {
      input: { id: other.admin.userId },
    });

    expect(refusals(self)).toEqual([{ code: 'PRECONDITION', errorCode: 'core.cannot_block_self' }]);
    expect(elsewhere.errors?.map(({ extensions }) => extensions?.code)).toEqual(['NOT_FOUND']);
  });
});
