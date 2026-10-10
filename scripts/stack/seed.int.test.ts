import { randomUUIDv7 } from 'node:crypto';
import { hostFactory, queryAsCore } from '@northmes/backend/testing';
import { createTestApp, gqlClient, query, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { devAdmin, devUsers, seed, seedCompany, seedPlants } from './seed.mjs';

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

  /** The dev admin's JWT, signed in through Better Auth with the seed's password. */
  function adminToken(): Promise<string> {
    return tokenOf(devAdmin);
  }

  /** The JWT of a seed user, signed in through Better Auth with the seed's password. */
  async function tokenOf({ email, password }: { email: string; password: string }) {
    const signedIn = await fetch(`${url}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(signedIn.status).toBe(200);
    const sessionToken = signedIn.headers.get('set-auth-token');
    const { token } = (await (
      await fetch(`${url}/api/auth/token`, { headers: { authorization: `Bearer ${sessionToken}` } })
    ).json()) as { token: string };
    return token;
  }

  it("E05-S05 the dev admin signs in with the seed's password and reads each seed plant's production orders", async () => {
    const token = await adminToken();

    const numbersAt = async (plant: string) => {
      const answer = await gqlClient(url, {
        headers: { authorization: `Bearer ${token}`, 'x-northmes-plant': plant },
      }).send<{ planningProductionOrders: { number: string }[] }>(
        '{ planningProductionOrders { number } }',
      );
      return answer.data?.planningProductionOrders.map(({ number }) => number);
    };

    expect(await numbersAt('plant-a')).toEqual(['DEV-1001', 'DEV-1002', 'DEV-1004']);
    expect(await numbersAt('plant-b')).toEqual(['DEV-1003']);
  });

  it('E05-S03 the seed holds one company with two plants, and the dev admin can open both', async () => {
    const token = await adminToken();

    const answer = await gqlClient(url, {
      headers: { authorization: `Bearer ${token}` },
    }).send('{ coreCompanies { id name plants { id slug name } } }');

    expect(answer.data).toEqual({
      coreCompanies: [{ id: seedCompany.id, name: seedCompany.name, plants: seedPlants }],
    });
    expect(seedPlants.map(({ slug, name }) => ({ slug, name }))).toEqual([
      { slug: 'plant-a', name: 'Plant A' },
      { slug: 'plant-b', name: 'Plant B' },
    ]);
  });

  it("E05-S06 the dev admin's role holds the permission of every command, so the admin creates and edits an article and releases an order at plant-a", async () => {
    const client = gqlClient(url, {
      headers: { authorization: `Bearer ${await adminToken()}`, 'x-northmes-plant': 'plant-a' },
    });
    const orders = await client.send<{
      planningProductionOrders: { id: string; status: string; version: number }[];
    }>('{ planningProductionOrders { id status version } }');
    const order = orders.data?.planningProductionOrders.find(({ status }) => status === 'planned');
    if (!order) throw new Error('the seed has no planned production order at plant-a');

    const created = await client.send<{ coreCreateArticle: { id: string; version: number } }>(
      `mutation ($input: CoreCreateArticleInput!) { coreCreateArticle(input: $input) { id version } }`,
      { input: { id: randomUUIDv7(), code: 'SEED-TEST-1', name: 'Seed test article' } },
    );
    const article = created.data?.coreCreateArticle;
    if (!article) throw new Error(`coreCreateArticle failed: ${JSON.stringify(created)}`);
    const updated = await client.send(
      `mutation ($input: CoreUpdateArticleInput!) { coreUpdateArticle(input: $input) { code name } }`,
      {
        input: {
          id: article.id,
          expectedVersion: article.version,
          code: 'SEED-TEST-1',
          name: 'Seed test article, edited',
        },
      },
    );
    const released = await client.send(
      `mutation ($input: PlanningReleaseProductionOrderInput!) {
        planningReleaseProductionOrder(input: $input) { status }
      }`,
      { input: { id: order.id, expectedVersion: order.version } },
    );

    expect(updated).toEqual({
      status: 200,
      data: { coreUpdateArticle: { code: 'SEED-TEST-1', name: 'Seed test article, edited' } },
    });
    expect(released).toEqual({
      status: 200,
      data: { planningReleaseProductionOrder: { status: 'released' } },
    });
  });

  it("E05-S06 the dev admin holds core's Company admin at the seed company, with every installed permission, so the last-admin rule keeps the seed company's admin", async () => {
    const roles = await queryAsCore<{ id: string; key: string; scope_id: string; all: boolean }>(
      db.ownerUrl,
      `select a.id, r.key, a.scope_id,
              r.permissions @> (select array_agg(key) from core.permission where installed) as all
         from core.role_assignment a join core.role r on r.id = a.role_id
        where a.user_id = $1`,
      [devAdmin.id],
    );
    const client = gqlClient(url, {
      headers: { authorization: `Bearer ${await adminToken()}`, 'x-northmes-plant': 'plant-a' },
    });

    const removed = await client.send(
      `mutation ($input: CoreRemoveRoleAssignmentInput!) {
        coreRemoveRoleAssignment(input: $input) { id }
      }`,
      { input: { id: roles[0]?.id } },
    );

    expect(roles).toEqual([
      { id: expect.any(String), key: 'core-company-admin', scope_id: seedCompany.id, all: true },
    ]);
    expect(removed.errors?.map(({ extensions }) => extensions?.errorCode)).toEqual([
      'core.last_admin',
    ]);
  });

  /** The NorthMES codes of an answer's errors, or 'ok' for an answer without errors. */
  function outcome(answer: { readonly errors?: readonly { extensions?: unknown }[] }) {
    if (answer.errors === undefined) return 'ok';
    return answer.errors
      .map(({ extensions }) => (extensions as { errorCode?: string }).errorCode)
      .join(', ');
  }

  it('E05-S08 the seed has a Plant admin, a planner, an operator and a viewer at plant-a, each with a dev-only password, an email under northmes.test and the role they are named for', async () => {
    const roles = await queryAsCore<{ username: string; key: string; scope_id: string }>(
      db.ownerUrl,
      `select u.username, r.key, a.scope_id
         from core.role_assignment a
         join core.role r on r.id = a.role_id
         join auth."user" u on u.id = a.user_id
        where a.user_id <> $1
        order by u.username`,
      [devAdmin.id],
    );
    const operator = await queryAsCore<{ name: string; permissions: string[]; origin: string }>(
      db.ownerUrl,
      `select name, permissions, origin from core.role where key = $1`,
      [devUsers.operator.roleKey],
    );

    expect(Object.values(devUsers).map(({ email }) => email.endsWith('@northmes.test'))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(roles).toEqual(
      [
        { username: devUsers.plantAdmin.username, key: 'core-plant-admin' },
        { username: devUsers.planner.username, key: 'planning-planner' },
        { username: devUsers.operator.username, key: devUsers.operator.roleKey },
        { username: devUsers.viewer.username, key: 'planning-viewer' },
      ]
        .map((row) => ({ ...row, scope_id: seedPlants[0]?.id }))
        .sort((a, b) => a.username.localeCompare(b.username)),
    );
    expect(operator).toEqual([
      {
        name: 'Operator',
        permissions: ['core.article:read', 'planning.productionOrder:read'],
        origin: 'custom',
      },
    ]);
  });

  it('E05-S08 each seed user signs in and may do what their role allows at plant-a, and is refused what it does not', async () => {
    const at = async (user: { email: string; password: string }) =>
      gqlClient(url, {
        headers: { authorization: `Bearer ${await tokenOf(user)}`, 'x-northmes-plant': 'plant-a' },
      });
    const plantAdmin = await at(devUsers.plantAdmin);
    const planner = await at(devUsers.planner);
    const operator = await at(devUsers.operator);
    const viewer = await at(devUsers.viewer);
    const ordersQuery = '{ planningProductionOrders { id version status } }';
    const orders = await viewer.send<{
      planningProductionOrders: { id: string; version: number; status: string }[];
    }>(ordersQuery);
    const order = orders.data?.planningProductionOrders.find(({ status }) => status === 'planned');
    const newArticle = {
      id: randomUUIDv7(),
      code: `SEED-${randomUUIDv7().slice(-6)}`,
      name: 'Seed role test article',
    };
    const createArticle = `mutation ($input: CoreCreateArticleInput!) {
      coreCreateArticle(input: $input) { id }
    }`;

    const answers = {
      plantAdmin: [
        outcome(await plantAdmin.send(createArticle, { input: newArticle })),
        outcome(
          await plantAdmin.send(
            `mutation ($input: CoreBlockUserInput!) { coreBlockUser(input: $input) { id } }`,
            { input: { id: devUsers.viewer.id } },
          ),
        ),
      ],
      planner: [
        outcome(await planner.send(ordersQuery)),
        outcome(
          await planner.send(createArticle, {
            input: { ...newArticle, id: randomUUIDv7(), code: `${newArticle.code}-P` },
          }),
        ),
      ],
      operator: [
        outcome(await operator.send('{ coreArticles { totalCount } }')),
        outcome(await operator.send('{ coreUsers { totalCount } }')),
      ],
      viewer: [
        outcome(orders),
        outcome(
          await viewer.send(
            `mutation ($input: PlanningReleaseProductionOrderInput!) {
              planningReleaseProductionOrder(input: $input) { status }
            }`,
            { input: { id: order?.id, expectedVersion: order?.version } },
          ),
        ),
      ],
    };

    expect(answers).toEqual({
      plantAdmin: ['ok', 'core.forbidden'],
      planner: ['ok', 'core.forbidden'],
      operator: ['ok', 'core.forbidden'],
      viewer: ['ok', 'core.forbidden'],
    });
  });

  it('E05-S05 a seed run on a database seeded before the dev admin had an email to sign in with moves the admin to that email', async () => {
    await query(
      db.authUrl,
      `update auth."user" set email = 'admin@users.northmes.invalid' where id = '${devAdmin.id}'`,
    );

    await seed({ appUrl: db.appUrl, ownerUrl: db.ownerUrl });

    expect(await adminToken()).toEqual(expect.any(String));
  });

  it('E05-S05 a second run of the seed adds no scope, company, plant, role or assignment', async () => {
    // Core's owner role reads every role; nm_app reads only those of its read scopes.
    const counts = () =>
      queryAsCore(
        db.ownerUrl,
        `select (select count(*)::int from core.scope) as scopes,
                (select count(*)::int from core.company) as companies,
                (select count(*)::int from core.plant) as plants,
                (select count(*)::int from core.role) as roles,
                (select count(*)::int from core.role_assignment) as assignments`,
      );
    const before = await counts();

    await seed({ appUrl: db.appUrl, ownerUrl: db.ownerUrl });

    // The four default roles of core and planning that the company gets and the custom Operator,
    // and one role for each of the five dev users.
    expect(before).toEqual([{ scopes: 3, companies: 1, plants: 2, roles: 5, assignments: 5 }]);
    expect(await counts()).toEqual(before);
  });
});
