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
