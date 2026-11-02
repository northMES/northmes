// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { givenCompany, hostFactory, queryAsCore, signIn, signInAt } from '@northmes/backend/testing';
import { createTestApp, gqlClient, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const listCustomers = `query {
  coreCustomers { totalCount edges { node { code name version } } }
}`;

interface Answer {
  readonly data?: Record<string, unknown> | null;
  readonly errors?: readonly { message: string; extensions?: Record<string, unknown> }[];
}

const principal = { type: 'user', id: 'e06-s07-customers' } as const;

describe('customers', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  function app() {
    if (!testApp) throw new Error('the test app did not start');
    return testApp.app;
  }

  /** Writes a customer of `company` as nm_app, with the company's node as its scope. */
  function givenCustomer(company: string, code: string, name: string) {
    return db.command({ principal, scopes: [company], reason: 'E06-S07 fixture' }, (tx) =>
      tx.query(
        `insert into core.customer (scope_id, company_id, code, name) values ($1, $1, $2, $3)`,
        [company, code, name],
      ),
    );
  }

  /** A client of a user with every installed permission at the company's first plant. */
  async function plantUser(place: { plants: readonly string[] }) {
    const plant = place.plants[0] ?? '';
    return gqlClient(await app().getUrl(), { headers: await signInAt(app(), db.ownerUrl, plant) });
  }

  it('E06-S07 a customer has no address fields: it holds a number and a name, on the table and in the API', async () => {
    const columns = await queryAsCore<{ column_name: string }>(
      db.ownerUrl,
      `select column_name from information_schema.columns
        where table_schema = 'core' and table_name = 'customer' order by column_name`,
    );
    const answer: Answer = await (await plantUser(await givenCompany(db.ownerUrl))).send(
      `query { __type(name: "Customer") { fields { name } } }`,
    );
    const type = answer.data?.__type as { fields: { name: string }[] } | null;

    expect(columns.map(({ column_name }) => column_name)).toEqual([
      'code',
      'code_key',
      'company_id',
      'created_at',
      'id',
      'name',
      'scope_id',
      'updated_at',
      'version',
    ]);
    expect(type?.fields.map(({ name }) => name).sort()).toEqual([
      'code',
      'id',
      'name',
      'updatedAt',
      'version',
    ]);
  });

  it('E06-S07 a customer number is unique per company, in any case, and another company may use it', async () => {
    const acme = await givenCompany(db.ownerUrl);
    const other = await givenCompany(db.ownerUrl);
    await givenCustomer(acme.company, 'C-100', 'Nordic Pumps');

    const clash = givenCustomer(acme.company, 'c-100', 'Another customer');
    await givenCustomer(other.company, 'C-100', 'Baltic Valves');

    await expect(clash).rejects.toMatchObject({ code: '23505', constraint: 'customer_code_key' });
  });

  it("E06-S07 a plant lists its company's customers by number", async () => {
    const place = await givenCompany(db.ownerUrl);
    await givenCustomer(place.company, 'C-200', 'Lakeside Foundry');
    await givenCustomer(place.company, 'C-100', 'Nordic Pumps');

    const listed: Answer = await (await plantUser(place)).send(listCustomers);

    expect(listed.errors).toBeUndefined();
    expect(listed.data?.coreCustomers).toEqual({
      totalCount: 2,
      edges: [
        { node: { code: 'C-100', name: 'Nordic Pumps', version: 1 } },
        { node: { code: 'C-200', name: 'Lakeside Foundry', version: 1 } },
      ],
    });
  });

  it('E06-S07 a user without core.customer:read gets FORBIDDEN with core.forbidden from coreCustomers, and no customer', async () => {
    const place = await givenCompany(db.ownerUrl);
    await givenCustomer(place.company, 'C-100', 'Nordic Pumps');
    const { authorization } = await signIn(app(), db.ownerUrl, [
      { scopeId: place.plants[0] ?? '', permissions: ['core.article:read'] },
    ]);
    const reader = gqlClient(await app().getUrl(), {
      headers: { authorization, 'x-northmes-plant': place.slugs[0] ?? '' },
    });

    const listed: Answer = await reader.send(listCustomers);

    expect(listed.data).toBeNull();
    expect(listed.errors?.[0]?.extensions).toMatchObject({
      code: 'FORBIDDEN',
      errorCode: 'core.forbidden',
    });
  });

  it("E06-S07 another company's customers are hidden, from the list and from nm_app's reads", async () => {
    const acme = await givenCompany(db.ownerUrl);
    const other = await givenCompany(db.ownerUrl);
    await givenCustomer(acme.company, 'C-100', 'Nordic Pumps');
    await givenCustomer(other.company, 'C-900', 'Baltic Valves');

    const listed: Answer = await (await plantUser(acme)).send(listCustomers);
    const read = await db.command(
      { principal, scopes: [acme.company, acme.plants[0] ?? ''], reason: 'E06-S07 probe' },
      async (tx) => (await tx.query('select code from core.customer order by code')).rows,
    );

    expect(listed.data?.coreCustomers).toEqual({
      totalCount: 1,
      edges: [{ node: { code: 'C-100', name: 'Nordic Pumps', version: 1 } }],
    });
    expect(read).toEqual([{ code: 'C-100' }]);
  });
});
