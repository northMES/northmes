// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import type { SlotContribution } from '@northmes/web-sdk';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoreDashboardTabs } from '../../../src/modules/core/screens/dashboard/dashboard-tabs.graphql.ts';
import { CoreSaveDashboardTab } from '../../../src/modules/core/screens/dashboard/save-dashboard-tab.graphql.ts';
import { plant, renderCoreAt } from './core-app.tsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** A fictional widget as coreDashboardTabs answers it. */
function widget(
  id: string,
  type: 'VALUE' | 'CONTRIBUTION',
  contribution: string | null,
  x: number,
  title: string,
) {
  return {
    __typename: 'DashboardWidget' as const,
    id,
    type,
    contribution,
    size: 'SMALL' as const,
    x,
    y: 0,
    title,
  };
}

/** The user's own tab My shift with these widgets. */
function myShift(widgets: ReturnType<typeof widget>[], version = 1) {
  return {
    __typename: 'DashboardTab' as const,
    id: 'tab-my-shift',
    name: 'My shift',
    scope: 'OWN' as const,
    version,
    canEdit: true,
    widgets,
  };
}

function tabsQuery(tab: ReturnType<typeof myShift>): MockLink.MockedResponse {
  return { request: { query: CoreDashboardTabs }, result: { data: { coreDashboardTabs: [tab] } } };
}

/** The article count widget of the example plugin: it says which plant it was given. */
function ArticleCount({ plant }: { readonly plant: string }) {
  return <p>12 articles at {plant}</p>;
}

/** A widget that throws as it renders. */
function Broken(): never {
  throw new Error('the widget broke');
}

/** A contribution of the example plugin to the dashboard's slot. */
function contribution(
  id: string,
  label: string,
  Component?: SlotContribution['Component'],
): SlotContribution {
  return {
    id,
    slot: 'core/dashboard/widgets/v1',
    label,
    order: 10,
    moduleId: 'example-article-count',
    moduleLabel: 'Article count example',
    ...(Component === undefined ? {} : { Component }),
  };
}

const count = contribution('example-article-count.count', 'Article count', ArticleCount);
const late = widget('w-late', 'VALUE', null, 0, 'Late orders');

function openWith(
  tab: ReturnType<typeof myShift>,
  contributions: readonly SlotContribution[],
  ...mocks: MockLink.MockedResponse[]
) {
  return renderCoreAt(coreLinks.dashboard({ plant }).href, [tabsQuery(tab), ...mocks], {
    contributions,
  });
}

describe('widgets that plugins contribute to the dashboard (ADR 0068, M-32)', () => {
  it("draws a contributed widget with its plugin's component, given the plant, without the Demo badge", async () => {
    openWith(myShift([late, widget('w-count', 'CONTRIBUTION', count.id, 3, 'Articles here')]), [
      count,
    ]);

    const region = await screen.findByRole('region', { name: 'Articles here' });
    expect(within(region).getByText(`12 articles at ${plant}`)).toBeDefined();
    expect(within(region).queryByText('Demo')).toBeNull();
  });

  it('says a widget whose plugin is missing or did not load is unavailable', async () => {
    openWith(
      myShift([
        widget('w-count', 'CONTRIBUTION', 'example-gone.count', 0, 'Gone'),
        widget('w-failed', 'CONTRIBUTION', 'example-article-count.failed', 3, 'Failed'),
      ]),
      [contribution('example-article-count.failed', 'Failed')],
    );

    const gone = await screen.findByRole('region', { name: 'Gone' });
    expect(gone.textContent).toContain(
      'This widget is unavailable. Its plugin is not installed, did not load, or you may not see it.',
    );
    const failed = screen.getByRole('region', { name: 'Failed' });
    expect(failed.textContent).toContain('This widget is unavailable.');
  });

  it('keeps the other widgets when a contributed widget throws, and says it could not be shown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    openWith(
      myShift([
        late,
        widget('w-broken', 'CONTRIBUTION', 'example-article-count.broken', 3, 'Broken'),
      ]),
      [contribution('example-article-count.broken', 'Broken', Broken)],
    );

    const broken = await screen.findByRole('region', { name: 'Broken' });
    expect(broken.textContent).toContain('Broken could not be shown.');
    expect(screen.getByRole('region', { name: 'Late orders' })).toBeDefined();
  });

  it("lists the contributed widgets in the catalog under their module's label, and saves an added one with its contribution", async () => {
    const user = userEvent.setup();
    const sent: unknown[] = [];
    const saved = myShift([widget('w-new', 'CONTRIBUTION', count.id, 0, 'Article count')], 2);
    openWith(myShift([]), [count], {
      request: {
        query: CoreSaveDashboardTab,
        variables: ({ input }: { input: { layout: string } }) => {
          sent.push(JSON.parse(input.layout));
          return true;
        },
      },
      result: { data: { coreSaveDashboardTab: saved } },
    } as MockLink.MockedResponse);

    await user.click(await screen.findByRole('button', { name: 'Edit layout' }));
    await user.click(screen.getByRole('button', { name: 'Add widget' }));
    const catalog = await screen.findByRole('dialog', { name: 'Add widget' });
    const group = within(catalog).getByRole('list', { name: /^Article count example/ });
    expect(within(group).getByRole('heading', { name: 'Article count' })).toBeDefined();
    await user.click(within(group).getByRole('button', { name: 'Add Article count' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(
      within(screen.getByRole('region', { name: 'Article count' })).getByText(
        `12 articles at ${plant}`,
      ),
    ).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(await screen.findByRole('button', { name: 'Edit layout' })).toBeDefined();
    expect(sent).toEqual([
      [
        {
          id: expect.stringMatching(/^[0-9a-f-]{36}$/),
          type: 'contribution',
          contribution: 'example-article-count.count',
          size: 'medium',
          x: 0,
          y: 0,
          settings: { title: 'Article count' },
        },
      ],
    ]);
  });
});
