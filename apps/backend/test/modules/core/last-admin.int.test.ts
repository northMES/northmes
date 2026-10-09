// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  type Grant,
  givenAssignment,
  givenCompany,
  hostFactory,
  queryAsCore,
  signIn,
} from '@northmes/backend/testing';
import { createTestApp, gqlClient, query, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const removeMutation = `mutation ($input: CoreRemoveRoleAssignmentInput!) {
  coreRemoveRoleAssignment(input: $input) { id }
}`;

const blockMutation = `mutation ($input: CoreBlockUserInput!) {
  coreBlockUser(input: $input) { id blocked }
}`;

const updateRoleMutation = `mutation ($input: CoreUpdateRoleInput!) {
  coreUpdateRole(input: $input) { id }
}`;

const deleteRoleMutation = `mutation ($input: CoreDeleteRoleInput!) {
  coreDeleteRole(input: $input) { id }
}`;

/** The refusal every change that would leave a company without an active Company admin gets. */
const lastAdmin = [{ code: 'PRECONDITION', errorCode: 'core.last_admin' }];

/** The errorCode of each error of an answer, with its GraphQL code. */
function refusals(answer: { readonly errors?: readonly { extensions?: unknown }[] }) {
  return answer.errors?.map(({ extensions }) => {
    const { code, errorCode } = extensions as Record<string, unknown>;
    return { code, errorCode };
  });
}

describe('every company keeps an active Company admin', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core', 'planning'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /** Acme AB with Plant A and Plant B, and its Company admin role. */
  async function acme() {
    const given = await givenCompany(db.ownerUrl, {
      name: 'Acme AB',
      plantNames: ['Plant A', 'Plant B'],
    });
    const [role] = await queryAsCore<{ id: string; version: number; permissions: string[] }>(
      db.ownerUrl,
      `select id, version, permissions from core.role
        where company_id = $1 and key = 'core-company-admin'`,
      [given.company],
    );
    if (!role) throw new Error('Acme AB has no Company admin role');
    const [slugA = ''] = given.slugs;
    return { ...given, plantA: given.plants[0] ?? '', slugA, adminRole: role };
  }

  type Acme = Awaited<ReturnType<typeof acme>>;

  /**
   * A fresh signed-in user with a client at Plant A, who holds Company admin at `scopeId` when it is
   * given, and these custom grants.
   */
  async function person(company: Acme, scopeId?: string, grants: readonly Grant[] = []) {
    if (!testApp) throw new Error('the test app did not start');
    const user = await signIn(testApp.app, db.ownerUrl, grants);
    const assignmentId =
      scopeId === undefined
        ? ''
        : await givenAssignment(db.ownerUrl, {
            userId: user.userId,
            roleId: company.adminRole.id,
            scopeId,
          });
    const client = gqlClient(await testApp.app.getUrl(), {
      headers: { authorization: user.authorization, 'x-northmes-plant': company.slugA },
    });
    return { ...user, assignmentId, client };
  }

  /** The ids of the Company admin assignments of the company, read as nm_app. */
  async function adminAssignments(company: Acme): Promise<string[]> {
    const rows = await query<{ id: string }>(
      db.appUrl,
      `select id from core.role_assignment where role_id = '${company.adminRole.id}' order by id`,
    );
    return rows.map(({ id }) => id);
  }

  /** The users who hold Company admin at the company and are not blocked, read as nm_app. */
  async function activeAdmins(company: Acme): Promise<string[]> {
    const rows = await query<{ user_id: string }>(
      db.appUrl,
      `select distinct a.user_id from core.role_assignment a
         join core.user_directory u on u.id = a.user_id
        where a.role_id = '${company.adminRole.id}' and a.scope_id = '${company.company}'
          and not u.banned
        order by a.user_id`,
    );
    return rows.map(({ user_id }) => user_id);
  }

  /** Whether the user is blocked, read as nm_app. */
  async function blocked(userId: string): Promise<boolean | undefined> {
    const [row] = await query<{ banned: boolean }>(
      db.appUrl,
      `select banned from core.user_directory where id = '${userId}'`,
    );
    return row?.banned;
  }

  it('E05-S06 removing the last Company admin assignment of a company is refused with core.last_admin, also for an admin removing their own, and changes nothing', async () => {
    const company = await acme();
    const karin = await person(company, company.company);
    // Oskar holds every permission of Company admin through a custom role, which does not count.
    const oskar = await person(company, undefined, [
      { scopeId: company.company, permissions: company.adminRole.permissions },
    ]);

    const own = await karin.client.send(removeMutation, { input: { id: karin.assignmentId } });
    const other = await oskar.client.send(removeMutation, { input: { id: karin.assignmentId } });

    expect(refusals(own)).toEqual(lastAdmin);
    expect(refusals(other)).toEqual(lastAdmin);
    expect(await adminAssignments(company)).toEqual([karin.assignmentId]);
  });

  it('E05-S08 blocking the last active Company admin of a company is refused with core.last_admin and changes nothing', async () => {
    const company = await acme();
    const karin = await person(company, company.company);
    const oskar = await person(company, undefined, [
      { scopeId: company.company, permissions: ['core.user:block', 'core.user:read'] },
    ]);

    const answer = await oskar.client.send(blockMutation, { input: { id: karin.userId } });

    expect(refusals(answer)).toEqual(lastAdmin);
    expect(await blocked(karin.userId)).toBe(false);
  });

  it('E05-S08 blocking the last active Company admin of another company of the user is refused with core.last_admin, from a plant of the first company', async () => {
    const company = await acme();
    const nordic = await givenCompany(db.ownerUrl, { name: 'Nordic AB' });
    const [nordicAdmin] = await queryAsCore<{ id: string }>(
      db.ownerUrl,
      `select id from core.role where company_id = $1 and key = 'core-company-admin'`,
      [nordic.company],
    );
    // Karin is a Company admin of Acme AB, where Oskar is one too, and the only one of Nordic AB.
    const karin = await person(company, company.company);
    const oskar = await person(company, company.company, [
      { scopeId: nordic.company, permissions: ['core.user:block', 'core.user:read'] },
    ]);
    await givenAssignment(db.ownerUrl, {
      userId: karin.userId,
      roleId: nordicAdmin?.id ?? '',
      scopeId: nordic.company,
    });

    const answer = await oskar.client.send(blockMutation, { input: { id: karin.userId } });

    expect(refusals(answer)).toEqual(lastAdmin);
    expect(await blocked(karin.userId)).toBe(false);
  });

  it('E05-S06 a blocked Company admin and a Company admin assigned at a plant do not count, so the last active one at the company cannot remove their own', async () => {
    const company = await acme();
    const karin = await person(company, company.company);
    const anna = await person(company, company.company);
    const petra = await person(company, company.plantA);
    const blockedAnna = await karin.client.send(blockMutation, { input: { id: anna.userId } });

    const own = await karin.client.send(removeMutation, { input: { id: karin.assignmentId } });

    expect(blockedAnna.errors).toBeUndefined();
    expect(refusals(own)).toEqual(lastAdmin);
    expect(await adminAssignments(company)).toEqual(
      [karin.assignmentId, anna.assignmentId, petra.assignmentId].sort(),
    );
  });

  it('E05-S06 editing or deleting the Company admin role is refused with core.last_admin and changes nothing', async () => {
    const company = await acme();
    const karin = await person(company, company.company);
    const { id, version, permissions } = company.adminRole;

    const edited = await karin.client.send(updateRoleMutation, {
      input: { id, expectedVersion: version, name: 'Company admin', permissions: [] },
    });
    const deleted = await karin.client.send(deleteRoleMutation, {
      input: { id, expectedVersion: version },
    });

    expect(refusals(edited)).toEqual(lastAdmin);
    expect(refusals(deleted)).toEqual(lastAdmin);
    expect(
      await queryAsCore(db.ownerUrl, 'select version, permissions from core.role where id = $1', [
        id,
      ]),
    ).toEqual([{ version, permissions }]);
  });

  it('E05-S06 with two Company admins one may remove the other', async () => {
    const company = await acme();
    const karin = await person(company, company.company);
    const anna = await person(company, company.company);

    const answer = await karin.client.send(removeMutation, { input: { id: anna.assignmentId } });

    expect(answer.errors).toBeUndefined();
    expect(await adminAssignments(company)).toEqual([karin.assignmentId]);
  });

  it('E05-S06 two Company admins who remove each other at once leave one', async () => {
    const company = await acme();
    const karin = await person(company, company.company);
    const anna = await person(company, company.company);

    const answers = await Promise.all([
      karin.client.send(removeMutation, { input: { id: anna.assignmentId } }),
      anna.client.send(removeMutation, { input: { id: karin.assignmentId } }),
    ]);

    expect(answers.filter(({ errors }) => errors === undefined)).toHaveLength(1);
    expect(await adminAssignments(company)).toHaveLength(1);
  });

  it('E05-S08 two users who each block one of the two Company admins at once leave one', async () => {
    const company = await acme();
    const karin = await person(company, company.company);
    const anna = await person(company, company.company);
    const blocker = [
      { scopeId: company.company, permissions: ['core.user:block', 'core.user:read'] },
    ];
    const oskar = await person(company, undefined, blocker);
    const lena = await person(company, undefined, blocker);

    const answers = await Promise.all([
      oskar.client.send(blockMutation, { input: { id: karin.userId } }),
      lena.client.send(blockMutation, { input: { id: anna.userId } }),
    ]);

    expect(answers.filter(({ errors }) => errors === undefined)).toHaveLength(1);
    expect(answers.flatMap((answer) => refusals(answer) ?? [])).toEqual(lastAdmin);
    expect(await activeAdmins(company)).toHaveLength(1);
  });

  it('E05-S08 blocking one of two Company admins while the other loses Company admin at once leaves one', async () => {
    const company = await acme();
    const karin = await person(company, company.company);
    const anna = await person(company, company.company);
    const oskar = await person(company, undefined, [
      { scopeId: company.company, permissions: ['core.user:block', 'core.user:read'] },
    ]);
    // Lena holds every permission of Company admin through a custom role, which does not count.
    const lena = await person(company, undefined, [
      { scopeId: company.company, permissions: company.adminRole.permissions },
    ]);

    const answers = await Promise.all([
      oskar.client.send(blockMutation, { input: { id: karin.userId } }),
      lena.client.send(removeMutation, { input: { id: anna.assignmentId } }),
    ]);

    expect(answers.filter(({ errors }) => errors === undefined)).toHaveLength(1);
    expect(answers.flatMap((answer) => refusals(answer) ?? [])).toEqual(lastAdmin);
    expect(await activeAdmins(company)).toHaveLength(1);
  });
});
