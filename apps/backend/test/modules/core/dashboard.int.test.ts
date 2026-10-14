// SPDX-License-Identifier: AGPL-3.0-or-later
import { givenCompany, hostFactory, signIn } from '@northmes/backend/testing';
import { createTestApp, gqlClient, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const tabsQuery = `{
  coreDashboardTabs { id name scope version widgets { id type size x y title } }
}`;

interface TabsAnswer {
  coreDashboardTabs: {
    id: string;
    name: string;
    scope: string;
    version: number;
    widgets: { id: string; type: string; size: string; x: number; y: number; title: string }[];
  }[];
}

/** A widget as the layout stores it (design shell-454). */
function widget(id: string, type: string, size: string, x: number, y: number, title: string) {
  return { id, type, size, x, y, settings: { title } };
}

describe('the dashboard tabs at the request plant (ADR 0078)', () => {
  const db = useTestDatabase();
  const principal = { type: 'system', id: 'dashboard-fixture' } as const;
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /** A company with two plants and a user who holds only core.article:read at the first. */
  async function given() {
    if (!testApp) throw new Error('the test app did not start');
    const { company, plants, slugs } = await givenCompany(db.ownerUrl, { plants: 2 });
    const [plant = '', sibling = ''] = plants;
    const user = await signIn(testApp.app, db.ownerUrl, [
      { scopeId: plant, permissions: ['core.article:read'] },
    ]);
    const other = await signIn(testApp.app, db.ownerUrl, [
      { scopeId: plant, permissions: ['core.article:read'] },
    ]);
    return { company, plant, sibling, slug: slugs[0] ?? '', user, other };
  }

  /** Writes a tab as nm_app, as its owner for an own tab. */
  function tab(
    scopes: { company: string; scopeId: string; ownerId?: string },
    name: string,
    position: number,
    widgets: readonly unknown[] = [],
  ): Promise<string> {
    const { company, scopeId, ownerId } = scopes;
    return db.command(
      {
        principal,
        scopes: [company, scopeId],
        reason: 'fixture',
        ...(ownerId ? { userId: ownerId } : {}),
      },
      async (tx) => {
        const { rows } = await tx.query<{ id: string }>(
          `insert into core.dashboard_tab (scope_id, company_id, owner_id, name, position, widgets)
           values ($1, $2, $3, $4, $5, $6) returning id`,
          [scopeId, company, ownerId ?? null, name, position, JSON.stringify(widgets)],
        );
        return rows[0]?.id ?? '';
      },
    );
  }

  async function tabsAs(authorization: string, plant: string | undefined) {
    if (!testApp) throw new Error('the test app did not start');
    const client = gqlClient(await testApp.app.getUrl(), {
      headers: { authorization, ...(plant === undefined ? {} : { 'x-northmes-plant': plant }) },
    });
    return client.send<TabsAnswer>(tabsQuery);
  }

  it("answers the company's tabs, then the plant's, then the user's own, each by position", async () => {
    const { company, plant, sibling, slug, user, other } = await given();
    await tab({ company, scopeId: company, ownerId: user.userId }, 'My shift', 0);
    await tab({ company, scopeId: plant }, 'Quality', 1);
    await tab({ company, scopeId: plant }, 'Shift overview', 0);
    await tab({ company, scopeId: company }, 'Company overview', 0);
    await tab({ company, scopeId: sibling }, 'Press line', 0);
    await tab({ company, scopeId: company, ownerId: other.userId }, 'Not mine', 0);

    const answer = await tabsAs(user.authorization, slug);

    expect(answer.errors).toBeUndefined();
    expect(answer.data?.coreDashboardTabs.map(({ name, scope }) => [name, scope])).toEqual([
      ['Company overview', 'COMPANY'],
      ['Shift overview', 'PLANT'],
      ['Quality', 'PLANT'],
      ['My shift', 'OWN'],
    ]);
  });

  it("answers a tab's widgets with their type, size, place and title", async () => {
    const { company, plant, slug, user } = await given();
    await tab({ company, scopeId: plant }, 'Shift overview', 0, [
      widget('w1', 'list', 'medium', 0, 0, 'Production orders, Milling'),
      widget('w2', 'value', 'small', 4, 0, 'Late orders'),
    ]);

    const answer = await tabsAs(user.authorization, slug);

    expect(answer.data?.coreDashboardTabs[0]?.widgets).toEqual([
      { id: 'w1', type: 'LIST', size: 'MEDIUM', x: 0, y: 0, title: 'Production orders, Milling' },
      { id: 'w2', type: 'VALUE', size: 'SMALL', x: 4, y: 0, title: 'Late orders' },
    ]);
  });

  it('leaves out a widget whose type or size the layout does not allow', async () => {
    const { company, plant, slug, user } = await given();
    await tab({ company, scopeId: plant }, 'Shift overview', 0, [
      widget('w1', 'value', 'wide', 0, 0, 'A Value is Small only'),
      widget('w2', 'gauge', 'small', 0, 2, 'No such type'),
      widget('w3', 'chart', 'large', 0, 4, 'Output per shift'),
    ]);

    const answer = await tabsAs(user.authorization, slug);

    expect(answer.data?.coreDashboardTabs[0]?.widgets.map(({ id }) => id)).toEqual(['w3']);
  });

  it('needs a plant', async () => {
    const { user } = await given();

    const answer = await tabsAs(user.authorization, undefined);

    expect(answer.data).toBeUndefined();
    expect(answer.errors?.[0]?.extensions?.errorCode).toBe('core.plant_forbidden');
  });
});
