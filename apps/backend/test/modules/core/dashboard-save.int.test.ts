// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { givenCompany, hostFactory, signIn } from '@northmes/backend/testing';
import { createTestApp, gqlClient, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const saveMutation = `mutation Save($input: CoreSaveDashboardTabInput!) {
  coreSaveDashboardTab(input: $input) { id version widgets { id size x y title } }
}`;

const tabsQuery = `{ coreDashboardTabs { id name version canEdit widgets { id x y title } } }`;

interface SaveAnswer {
  coreSaveDashboardTab: {
    id: string;
    version: number;
    widgets: { id: string; size: string; x: number; y: number; title: string }[];
  };
}

interface TabsAnswer {
  coreDashboardTabs: {
    id: string;
    name: string;
    version: number;
    canEdit: boolean;
    widgets: { id: string; x: number; y: number; title: string }[];
  }[];
}

/** A widget as the layout stores it (design shell-454). */
function widget(id: string, type: string, size: string, x: number, y: number, title: string) {
  return { id, type, size, x, y, settings: { title } };
}

const lateOrders = widget('w1', 'value', 'small', 0, 0, 'Late orders');
const milling = widget('w2', 'list', 'medium', 3, 0, 'Production orders, Milling');

describe('core.saveDashboardTab, one edit session of a tab (ADR 0078)', () => {
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

  /**
   * A company with a plant, a viewer who holds core.article:read there, a plant editor who also
   * holds core.dashboardTab:manage at the plant, and a tab of each kind with one widget.
   */
  async function given() {
    if (!testApp) throw new Error('the test app did not start');
    const { company, plants, slugs } = await givenCompany(db.ownerUrl, { plants: 1 });
    const [plant = ''] = plants;
    const viewer = await signIn(testApp.app, db.ownerUrl, [
      { scopeId: plant, permissions: ['core.article:read'] },
    ]);
    const editor = await signIn(testApp.app, db.ownerUrl, [
      { scopeId: plant, permissions: ['core.article:read', 'core.dashboardTab:manage'] },
    ]);
    const tab = (scopeId: string, name: string, ownerId?: string) =>
      db.command(
        {
          principal,
          scopes: [company, scopeId],
          reason: 'fixture',
          ...(ownerId ? { userId: ownerId } : {}),
        },
        async (tx) => {
          const { rows } = await tx.query<{ id: string }>(
            `insert into core.dashboard_tab (scope_id, company_id, owner_id, name, position, widgets)
             values ($1, $2, $3, $4, 0, $5) returning id`,
            [scopeId, company, ownerId ?? null, name, JSON.stringify([lateOrders])],
          );
          return rows[0]?.id ?? '';
        },
      );
    return {
      slug: slugs[0] ?? '',
      viewer,
      editor,
      companyTab: await tab(company, 'Company overview'),
      plantTab: await tab(plant, 'Shift overview'),
      viewerTab: await tab(company, 'My shift', viewer.userId),
    };
  }

  async function clientAs(authorization: string, slug: string) {
    if (!testApp) throw new Error('the test app did not start');
    return gqlClient(await testApp.app.getUrl(), {
      headers: { authorization, 'x-northmes-plant': slug },
    });
  }

  /** Saves the layout of tab `id` as the version 1 session. */
  async function save(authorization: string, slug: string, id: string, layout: unknown[]) {
    const client = await clientAs(authorization, slug);
    return client.send<SaveAnswer>(saveMutation, {
      input: { id, expectedVersion: 1, layout: JSON.stringify(layout) },
    });
  }

  async function tabs(authorization: string, slug: string) {
    const client = await clientAs(authorization, slug);
    return (await client.send<TabsAnswer>(tabsQuery)).data?.coreDashboardTabs ?? [];
  }

  it('lets a user save the layout of an own tab without a dashboard permission', async () => {
    const { slug, viewer, viewerTab } = await given();

    const answer = await save(viewer.authorization, slug, viewerTab, [lateOrders, milling]);

    expect(answer.errors).toBeUndefined();
    expect(answer.data?.coreSaveDashboardTab).toEqual({
      id: viewerTab,
      version: 2,
      widgets: [
        { id: 'w1', size: 'SMALL', x: 0, y: 0, title: 'Late orders' },
        { id: 'w2', size: 'MEDIUM', x: 3, y: 0, title: 'Production orders, Milling' },
      ],
    });
    const mine = (await tabs(viewer.authorization, slug)).find(({ id }) => id === viewerTab);
    expect(mine?.version).toBe(2);
    expect(mine?.widgets.map(({ id }) => id)).toEqual(['w1', 'w2']);
  });

  it('saves and answers a widget that a plugin contributes, with its contribution (M-32)', async () => {
    const { slug, viewer, viewerTab } = await given();
    const count = {
      ...widget('w3', 'contribution', 'small', 3, 0, 'Article count'),
      contribution: 'example-article-count.count',
    };

    const answer = await save(viewer.authorization, slug, viewerTab, [lateOrders, count]);

    expect(answer.errors).toBeUndefined();
    const client = await clientAs(viewer.authorization, slug);
    const read = await client.send<{
      coreDashboardTabs: {
        id: string;
        widgets: { id: string; type: string; contribution: string | null }[];
      }[];
    }>('{ coreDashboardTabs { id widgets { id type contribution } } }');
    expect(read.data?.coreDashboardTabs.find(({ id }) => id === viewerTab)?.widgets).toEqual([
      { id: 'w1', type: 'VALUE', contribution: null },
      { id: 'w3', type: 'CONTRIBUTION', contribution: 'example-article-count.count' },
    ]);
  });

  it('refuses a shared tab to a user without core.dashboardTab:manage, and keeps it', async () => {
    const { slug, viewer, plantTab } = await given();

    const answer = await save(viewer.authorization, slug, plantTab, [milling]);

    expect(answer.errors?.[0]?.extensions?.errorCode).toBe('core.forbidden');
    const shared = (await tabs(viewer.authorization, slug)).find(({ id }) => id === plantTab);
    expect(shared?.widgets.map(({ id }) => id)).toEqual(['w1']);
  });

  it('lets a holder of core.dashboardTab:manage at the plant save its tabs, not the company tabs', async () => {
    const { slug, editor, plantTab, companyTab } = await given();

    const plantAnswer = await save(editor.authorization, slug, plantTab, [milling]);
    const companyAnswer = await save(editor.authorization, slug, companyTab, [milling]);

    expect(plantAnswer.data?.coreSaveDashboardTab.version).toBe(2);
    expect(companyAnswer.errors?.[0]?.extensions?.errorCode).toBe('core.forbidden');
  });

  it('says which tabs the user may edit', async () => {
    const { slug, viewer, editor, plantTab, companyTab, viewerTab } = await given();

    const canEdit = async (authorization: string) =>
      Object.fromEntries((await tabs(authorization, slug)).map(({ id, canEdit }) => [id, canEdit]));

    expect(await canEdit(viewer.authorization)).toEqual({
      [companyTab]: false,
      [plantTab]: false,
      [viewerTab]: true,
    });
    expect(await canEdit(editor.authorization)).toEqual({
      [companyTab]: false,
      [plantTab]: true,
    });
  });

  it('refuses a session made on an older version with core.version_conflict', async () => {
    const { slug, viewer, viewerTab } = await given();
    await save(viewer.authorization, slug, viewerTab, [milling]);

    const answer = await save(viewer.authorization, slug, viewerTab, [lateOrders]);

    expect(answer.errors?.[0]?.extensions?.errorCode).toBe('core.version_conflict');
  });

  it('refuses a layout with overlapping widgets as bad input, and keeps the tab', async () => {
    const { slug, viewer, viewerTab } = await given();

    const answer = await save(viewer.authorization, slug, viewerTab, [
      lateOrders,
      { ...milling, x: 2 },
    ]);

    expect(answer.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    const mine = (await tabs(viewer.authorization, slug)).find(({ id }) => id === viewerTab);
    expect(mine?.version).toBe(1);
  });

  it("does not find another user's own tab", async () => {
    const { slug, editor, viewerTab } = await given();

    const answer = await save(editor.authorization, slug, viewerTab, [milling]);

    expect(answer.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });
});
