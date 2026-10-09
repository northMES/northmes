// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUIDv7 } from 'node:crypto';
import { givenAssignment, givenCompany, hostFactory, signIn } from '@northmes/backend/testing';
import {
  createTestApp,
  emptyTemplateDatabase,
  gqlClient,
  query,
  type TestApp,
  useTestDatabase,
} from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inRepoCatalog } from '../../../src/boot/boot.ts';
import { migrate } from '../../../src/migrate/runner.ts';

const assignMutation = `mutation ($input: CoreAssignRoleInput!) {
  coreAssignRole(input: $input) { id scope { kind name } role { name } }
}`;

const createRoleMutation = `mutation ($input: CoreCreateRoleInput!) {
  coreCreateRole(input: $input) { id }
}`;

const updateRoleMutation = `mutation ($input: CoreUpdateRoleInput!) {
  coreUpdateRole(input: $input) { id }
}`;

const createUserMutation = `mutation ($input: CoreCreateUserInput!) {
  coreCreateUser(input: $input) { user { id } }
}`;

const blockUserMutation = `mutation ($input: CoreBlockUserInput!) {
  coreBlockUser(input: $input) { id blocked }
}`;

/** The errorCode of each error of an answer, with its GraphQL code. */
function refusals(answer: { readonly errors?: readonly { extensions?: unknown }[] }) {
  return answer.errors?.map(({ extensions }) => {
    const { code, errorCode } = extensions as Record<string, unknown>;
    return { code, errorCode };
  });
}

/** The id of the default role with this key in the company, read as nm_app. */
async function defaultRoleId(appUrl: string, company: string, key: string): Promise<string> {
  const [row] = await query<{ id: string }>(
    appUrl,
    `select id from core.role where company_id = '${company}' and key = '${key}'`,
  );
  if (!row) throw new Error(`the company has no role ${key}`);
  return row.id;
}

describe("core's Company admin role", () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core', 'planning'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /** A fresh signed-in user who holds the default role `key` at `scopeId`, with a client at `slug`. */
  async function holderOf(key: string, { company, scopeId, slug }: Place) {
    if (!testApp) throw new Error('the test app did not start');
    const user = await signIn(testApp.app, db.ownerUrl, []);
    const roleId = await defaultRoleId(db.appUrl, company, key);
    await givenAssignment(db.ownerUrl, { userId: user.userId, roleId, scopeId });
    const client = gqlClient(await testApp.app.getUrl(), {
      headers: { authorization: user.authorization, 'x-northmes-plant': slug },
    });
    return { ...user, client };
  }

  interface Place {
    readonly company: string;
    readonly scopeId: string;
    readonly slug: string;
  }

  it("E05-S06 a holder of only Company admin assigns planning's Viewer and Planner and a custom role with a planning permission", async () => {
    const given = await givenCompany(db.ownerUrl, { name: 'Acme AB', plantNames: ['Plant A'] });
    const [plantA = ''] = given.plants;
    const [slugA = ''] = given.slugs;
    const admin = await holderOf('core-company-admin', {
      company: given.company,
      scopeId: given.company,
      slug: slugA,
    });
    const sara = await holderOf('planning-viewer', {
      company: given.company,
      scopeId: plantA,
      slug: slugA,
    });
    const created = await admin.client.send<{ coreCreateRole: { id: string } }>(
      createRoleMutation,
      {
        input: {
          id: randomUUIDv7(),
          name: 'Night planner',
          permissions: ['planning.productionOrder:release'],
        },
      },
    );
    const assign = (roleId: string, scopeId: string) =>
      admin.client.send<{ coreAssignRole: { role: { name: string } } }>(assignMutation, {
        input: { id: randomUUIDv7(), userId: sara.userId, roleId, scopeId },
      });

    const viewer = await assign(
      await defaultRoleId(db.appUrl, given.company, 'planning-viewer'),
      given.company,
    );
    const planner = await assign(
      await defaultRoleId(db.appUrl, given.company, 'planning-planner'),
      plantA,
    );
    const custom = await assign(created.data?.coreCreateRole.id ?? '', plantA);

    expect(created.errors).toBeUndefined();
    expect([viewer, planner, custom].map(({ errors }) => errors)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(
      [viewer, planner, custom].map(({ data }) => data?.coreAssignRole.role.name),
    ).toEqual(['Viewer', 'Planner', 'Night planner']);
  });

  it('E05-S06 a Plant admin assigns Planner at its plant, but not Company admin, not at another plant or at the company, and edits no role, creates no user and blocks none', async () => {
    const given = await givenCompany(db.ownerUrl, {
      name: 'Acme AB',
      plantNames: ['Plant A', 'Plant B'],
    });
    const [plantA = '', plantB = ''] = given.plants;
    const [slugA = ''] = given.slugs;
    const at = (scopeId: string) => ({ company: given.company, scopeId, slug: slugA });
    const companyAdmin = await holderOf('core-company-admin', at(given.company));
    const jonas = await holderOf('core-plant-admin', at(plantA));
    const sara = await holderOf('planning-viewer', at(plantA));
    const shiftLead = await companyAdmin.client.send<{ coreCreateRole: { id: string } }>(
      createRoleMutation,
      { input: { id: randomUUIDv7(), name: 'Shift lead', permissions: ['core.article:read'] } },
    );
    const planner = await defaultRoleId(db.appUrl, given.company, 'planning-planner');
    const companyAdminRole = await defaultRoleId(db.appUrl, given.company, 'core-company-admin');
    const assign = (roleId: string, scopeId: string) =>
      jonas.client.send<{ coreAssignRole: { scope: { name: string }; role: { name: string } } }>(
        assignMutation,
        { input: { id: randomUUIDv7(), userId: sara.userId, roleId, scopeId } },
      );

    const atPlant = await assign(planner, plantA);
    const admin = await assign(companyAdminRole, plantA);
    const otherPlant = await assign(planner, plantB);
    const atCompany = await assign(planner, given.company);
    const edited = await jonas.client.send(updateRoleMutation, {
      input: {
        id: shiftLead.data?.coreCreateRole.id,
        expectedVersion: 1,
        name: 'Shift lead',
        permissions: [],
      },
    });
    const created = await jonas.client.send(createUserMutation, {
      input: { username: 'p.sund', name: 'Petra Sund' },
    });
    const blocked = await jonas.client.send(blockUserMutation, { input: { id: sara.userId } });

    expect(atPlant.errors).toBeUndefined();
    expect(atPlant.data?.coreAssignRole).toMatchObject({
      scope: { name: 'Plant A' },
      role: { name: 'Planner' },
    });
    expect(refusals(admin)).toEqual([{ code: 'FORBIDDEN', errorCode: 'core.role_not_held' }]);
    for (const answer of [otherPlant, atCompany, edited, created, blocked]) {
      expect(refusals(answer)).toEqual([{ code: 'FORBIDDEN', errorCode: 'core.forbidden' }]);
    }
  });
});

describe('northmes migrate and the admin roles', () => {
  const db = useTestDatabase({ template: emptyTemplateDatabase });

  /** The permissions of each admin role of the company, read as nm_app. */
  async function adminPermissions(company: string) {
    const rows = await query<{ key: string; permissions: string[] }>(
      db.appUrl,
      `select key, permissions from core.role
        where company_id = '${company}' and key in ('core-company-admin', 'core-plant-admin')
        order by key`,
    );
    return Object.fromEntries(rows.map(({ key, permissions }) => [key, permissions]));
  }

  it('E05-S06 a permission of a module installed later reaches Company admin and Plant admin after migrate', async () => {
    await migrate({ ownerUrl: db.ownerUrl, catalog: inRepoCatalog({ modules: ['core'] }) });
    const { company } = await givenCompany(db.ownerUrl, { name: 'Acme AB' });
    const before = await adminPermissions(company);

    await migrate({ ownerUrl: db.ownerUrl, catalog: inRepoCatalog() });
    const after = await adminPermissions(company);

    expect(before['core-company-admin']).not.toContain('planning.productionOrder:release');
    expect(after['core-company-admin']).toEqual(
      expect.arrayContaining([
        'core.role:manage',
        'core.user:block',
        'core.user:create',
        'planning.productionOrder:read',
        'planning.productionOrder:release',
      ]),
    );
    expect(before['core-plant-admin']).toEqual(
      expect.arrayContaining(['core.roleAssignment:manage', 'core.article:read']),
    );
    expect(after['core-plant-admin']).toEqual(
      expect.arrayContaining([
        'core.roleAssignment:manage',
        'planning.productionOrder:read',
        'planning.productionOrder:release',
      ]),
    );
    expect(after['core-plant-admin']).toEqual(
      after['core-company-admin']?.filter((key) => !companyLevel.includes(key)),
    );
  });
});

/** The permissions the API checks only at the company, which Plant admin never holds. */
const companyLevel = ['core.role:manage', 'core.user:block', 'core.user:create'];
