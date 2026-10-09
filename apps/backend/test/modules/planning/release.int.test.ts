// SPDX-License-Identifier: AGPL-3.0-or-later
import { givenCompany, hostFactory, signIn, signInAt } from '@northmes/backend/testing';
import {
  type CommandContext,
  createTestApp,
  given,
  gqlClient,
  type TestApp,
  useTestDatabase,
} from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** The context of a fixture write at `plant`. */
function fixtureAt(plant: string): CommandContext {
  return { principal: { type: 'system', id: 'fixture' }, scopes: [plant], reason: 'fixture' };
}

const releaseMutation = `mutation ($input: PlanningReleaseProductionOrderInput!) {
  planningReleaseProductionOrder(input: $input) { id status version }
}`;

const ordersQuery = '{ planningProductionOrders { id status version } }';

describe('planningReleaseProductionOrder', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core', 'planning'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  // Vitest runs the afterAll hooks of a block last registered first, so the app and its pool close
  // before useTestDatabase drops the database.
  afterAll(async () => {
    await testApp?.app.close();
  });

  /**
   * A GraphQL client for the test app, signed in as a user who holds every permission at `plant`,
   * that names `plant` in x-northmes-plant.
   */
  async function clientAt(plant: string) {
    if (!testApp) throw new Error('the test app did not start');
    const headers = await signInAt(testApp.app, db.ownerUrl, plant);
    return gqlClient(await testApp.app.getUrl(), { headers });
  }

  /** Writes a planned production order for 40 of a new article at `plant` and returns its id. */
  async function writeOrder(plant: string, number: string): Promise<string> {
    const { rows } = await db.command(fixtureAt(plant), (tx) =>
      tx.query<{ id: string }>(
        `with article as (
           insert into core.article (scope_id, code, name) values ($1, 'SH-210', 'Shelf board')
           returning id
         )
         insert into planning.production_order (scope_id, number, article_id, quantity)
         select $1, $2, id, 40 from article
         returning id`,
        [plant, number],
      ),
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('the order insert returned no id');
    return id;
  }

  it('E02-S04 planningReleaseProductionOrder sets the order to released and bumps its version', async () => {
    const plant = given.plant();
    const id = await writeOrder(plant, '6501');
    const client = await clientAt(plant);

    const answer = await client.send(releaseMutation, { input: { id, expectedVersion: 1 } });

    expect(answer).toEqual({
      status: 200,
      data: { planningReleaseProductionOrder: { id, status: 'released', version: 2 } },
    });
    expect(await client.send(ordersQuery)).toEqual({
      status: 200,
      data: { planningProductionOrders: [{ id, status: 'released', version: 2 }] },
    });
  });

  it('E02-S04 releasing an order that is not planned returns a DomainError and changes nothing', async () => {
    const plant = given.plant();
    const id = await writeOrder(plant, '6502');
    const client = await clientAt(plant);
    await client.send(releaseMutation, { input: { id, expectedVersion: 1 } });

    const answer = await client.send(releaseMutation, { input: { id, expectedVersion: 2 } });

    expect(answer).toMatchObject({
      status: 200,
      data: null,
      errors: [
        {
          message: 'Production order 6502 is released, and only a planned order can be released',
          path: ['planningReleaseProductionOrder'],
          extensions: {
            code: 'PRECONDITION',
            errorCode: 'planning.production_order.not_planned',
          },
        },
      ],
    });
    expect(await client.send(ordersQuery)).toEqual({
      status: 200,
      data: { planningProductionOrders: [{ id, status: 'released', version: 2 }] },
    });
  });

  it('E02-S04 releasing an order at another plant returns NOT_FOUND without an errorCode and leaves it planned', async () => {
    const plant = given.plant();
    const otherPlant = given.plant();
    const id = await writeOrder(otherPlant, '6503');

    const answer = await (await clientAt(plant)).send(releaseMutation, {
      input: { id, expectedVersion: 1 },
    });

    expect(answer).toMatchObject({
      status: 200,
      data: null,
      errors: [
        {
          message: `Production order ${id} was not found`,
          path: ['planningReleaseProductionOrder'],
          extensions: { code: 'NOT_FOUND' },
        },
      ],
    });
    expect(answer.errors?.[0]?.extensions).not.toHaveProperty('errorCode');
    expect(await (await clientAt(otherPlant)).send(ordersQuery)).toEqual({
      status: 200,
      data: { planningProductionOrders: [{ id, status: 'planned', version: 1 }] },
    });
  });

  it('E05-S01 releasing an order with a stale expectedVersion returns core.version_conflict and leaves it planned', async () => {
    const plant = given.plant();
    const id = await writeOrder(plant, '6504');
    const client = await clientAt(plant);

    const answer = await client.send(releaseMutation, { input: { id, expectedVersion: 2 } });

    expect(answer).toMatchObject({
      status: 200,
      data: null,
      errors: [
        {
          message: `Production order ${id} is at version 1, and the change was made on version 2`,
          path: ['planningReleaseProductionOrder'],
          extensions: { code: 'CONFLICT', errorCode: 'core.version_conflict' },
        },
      ],
    });
    expect(await client.send(ordersQuery)).toEqual({
      status: 200,
      data: { planningProductionOrders: [{ id, status: 'planned', version: 1 }] },
    });
  });

  it('E05-S06 a user who reads production orders at the plant but holds no release permission gets FORBIDDEN core.forbidden, and the order stays planned', async () => {
    if (!testApp) throw new Error('the test app did not start');
    const { plants } = await givenCompany(db.ownerUrl);
    const [plant = ''] = plants;
    const id = await writeOrder(plant, '6601');
    const { authorization } = await signIn(testApp.app, db.ownerUrl, [
      { scopeId: plant, permissions: ['planning.productionOrder:read', 'core.article:update'] },
    ]);
    const viewer = gqlClient(await testApp.app.getUrl(), {
      headers: { authorization, 'x-northmes-plant': plant },
    });

    const answer = await viewer.send(releaseMutation, { input: { id, expectedVersion: 1 } });

    expect(answer).toMatchObject({
      status: 200,
      data: null,
      errors: [
        {
          message: `You need planning.productionOrder:release at the scope of Production order ${id}`,
          extensions: { code: 'FORBIDDEN', errorCode: 'core.forbidden' },
        },
      ],
    });
    expect(await viewer.send(ordersQuery)).toEqual({
      status: 200,
      data: { planningProductionOrders: [{ id, status: 'planned', version: 1 }] },
    });
  });
});
