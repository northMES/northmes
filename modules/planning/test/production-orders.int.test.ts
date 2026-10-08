// SPDX-License-Identifier: AGPL-3.0-or-later
import { hostFactory } from '@northmes/server/testing';
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

const ordersQuery = `{
  planningProductionOrders { number quantity status article { code name } }
}`;

interface OrdersAnswer {
  planningProductionOrders: {
    number: string;
    quantity: string;
    status: string;
    article: { code: string; name: string } | null;
  }[];
}

describe('planningProductionOrders', () => {
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

  /** A GraphQL client for the test app that names `plant` in x-northmes-plant. */
  async function clientAt(plant: string) {
    if (!testApp) throw new Error('the test app did not start');
    return gqlClient(await testApp.app.getUrl(), { headers: { 'x-northmes-plant': plant } });
  }

  /** Writes an article at `plant` and returns its id. */
  async function writeArticle(plant: string, code: string, name: string): Promise<string> {
    const { rows } = await db.command(fixtureAt(plant), (tx) =>
      tx.query<{ id: string }>(
        'insert into core.article (scope_id, code, name) values ($1, $2, $3) returning id',
        [plant, code, name],
      ),
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('the article insert returned no id');
    return id;
  }

  /** Writes a planned production order at `plant` for `quantity` of the article `articleId`. */
  async function writeOrder(
    plant: string,
    number: string,
    articleId: string,
    quantity: string,
  ): Promise<void> {
    await db.command(fixtureAt(plant), (tx) =>
      tx.query(
        `insert into planning.production_order (scope_id, number, article_id, quantity)
         values ($1, $2, $3, $4)`,
        [plant, number, articleId, quantity],
      ),
    );
  }

  it("E02-S04 planningProductionOrders lists the plant's orders with their article names", async () => {
    const plant = given.plant();
    const shelf = await writeArticle(plant, 'SH-210', 'Shelf board');
    const leg = await writeArticle(plant, 'LG-712', 'Table leg');
    await writeOrder(plant, '6202', leg, '12.5');
    await writeOrder(plant, '6201', shelf, '120');

    const answer = await (await clientAt(plant)).send<OrdersAnswer>(ordersQuery);

    // quantity is the numeric(18,6) column as decimal text, so no digit passes through a float.
    expect(answer).toEqual({
      status: 200,
      data: {
        planningProductionOrders: [
          {
            number: '6201',
            quantity: '120.000000',
            status: 'planned',
            article: { code: 'SH-210', name: 'Shelf board' },
          },
          {
            number: '6202',
            quantity: '12.500000',
            status: 'planned',
            article: { code: 'LG-712', name: 'Table leg' },
          },
        ],
      },
    });
  });

  it('E02-S04 an order at another plant is not listed', async () => {
    const plant = given.plant();
    const otherPlant = given.plant();
    await writeOrder(plant, '6301', await writeArticle(plant, 'SH-105', 'Shelf board'), '40');
    await writeOrder(
      otherPlant,
      '6302',
      await writeArticle(otherPlant, 'SH-105', 'Shelf board'),
      '40',
    );

    const answer = await (await clientAt(plant)).send('{ planningProductionOrders { number } }');

    expect(answer).toEqual({
      status: 200,
      data: { planningProductionOrders: [{ number: '6301' }] },
    });
  });
});
