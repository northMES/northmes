// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoreDashboardTabs } from '../../../src/modules/core/screens/dashboard/dashboard-tabs.graphql.ts';
import { CoreSaveDashboardTab } from '../../../src/modules/core/screens/dashboard/save-dashboard-tab.graphql.ts';
import { politeRegionId } from '../../../src/ui/lib/announce.ts';
import { plant, renderCoreAt } from './core-app.tsx';

/** The width the grid container measures; 0 draws the one-column list. */
const grid = vi.hoisted(() => ({ width: 0 }));

vi.mock('react-grid-layout', async (original) => ({
  ...(await original<typeof import('react-grid-layout')>()),
  useContainerWidth: () => ({
    width: grid.width,
    mounted: grid.width > 0,
    containerRef: { current: null },
    measureWidth: () => {},
  }),
}));

afterEach(() => {
  cleanup();
  grid.width = 0;
});

type Scope = 'COMPANY' | 'PLANT' | 'OWN';
type WidgetType = 'LIST' | 'TABLE' | 'VALUE' | 'CHART';
type WidgetSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'TALL' | 'WIDE';

/** A fictional widget as coreDashboardTabs answers it. */
function widget(
  id: string,
  type: WidgetType,
  size: WidgetSize,
  x: number,
  y: number,
  title: string,
) {
  return {
    __typename: 'DashboardWidget' as const,
    id,
    type,
    contribution: null,
    size,
    x,
    y,
    title,
  };
}

type Widget = ReturnType<typeof widget>;

/** A fictional tab with an id made from its name. */
function tab(
  name: string,
  scope: Scope,
  widgets: Widget[] = [],
  { canEdit = true, version = 1 }: { canEdit?: boolean; version?: number } = {},
) {
  return {
    __typename: 'DashboardTab' as const,
    id: `tab-${name.toLowerCase().replaceAll(' ', '-')}`,
    name,
    scope,
    version,
    canEdit,
    widgets,
  };
}

type Tab = ReturnType<typeof tab>;

/** coreDashboardTabs answered with these tabs. */
function tabsQuery(...tabs: Tab[]): MockLink.MockedResponse {
  return { request: { query: CoreDashboardTabs }, result: { data: { coreDashboardTabs: tabs } } };
}

interface SaveInput {
  readonly id: string;
  readonly expectedVersion: number;
  readonly layout: string;
}

/**
 * coreSaveDashboardTab for the tab, answered with the saved tab, or with the errors. Each input it
 * takes lands in `sent`, its layout parsed.
 */
function saveMutation(
  saved: Tab,
  sent: { id: string; expectedVersion: number; layout: unknown }[],
  errors?: readonly Record<string, unknown>[],
): MockLink.MockedResponse {
  return {
    request: {
      query: CoreSaveDashboardTab,
      variables: ({ input }: { input: SaveInput }) => {
        sent.push({ ...input, layout: JSON.parse(input.layout) });
        return input.id === saved.id;
      },
    },
    result: errors === undefined ? { data: { coreSaveDashboardTab: saved } } : { errors },
  } as MockLink.MockedResponse;
}

const late = widget('w-late', 'VALUE', 'SMALL', 0, 0, 'Late orders');
const milling = widget('w-milling', 'LIST', 'MEDIUM', 0, 2, 'Production orders, Milling');
const shiftOverview = tab('Shift overview', 'PLANT', [late, milling]);
const companyOverview = tab('Company overview', 'COMPANY', [], { canEdit: false });
const myShift = tab('My shift', 'OWN');

/** The dashboard opened on this tab. */
function openAt(open: Tab, ...mocks: MockLink.MockedResponse[]) {
  return renderCoreAt(coreLinks.dashboard({ plant }, { tab: open.id }).href, mocks);
}

/** The text the polite region says last. */
async function announced(text: string) {
  await waitFor(() => expect(document.getElementById(politeRegionId)?.textContent).toBe(text));
}

/** The headings of the widgets, in the order of the page. */
function widgetTitles(): (string | null)[] {
  const list = screen.getByRole('list', { name: /^Widgets of / });
  return within(list)
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent);
}

describe('edit mode of a dashboard tab (design shell-454, option A)', () => {
  it('offers Edit layout on a tab the user may change, and not on one the user may not', async () => {
    const user = userEvent.setup();
    openAt(companyOverview, tabsQuery(companyOverview, myShift));

    expect(await screen.findByText('Company overview has no widgets yet.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Edit layout' })).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'My shift' }));

    expect(await screen.findByRole('button', { name: 'Edit layout' })).toBeDefined();
  });

  it('says who sees the tab while it is edited, and Cancel leaves without saving', async () => {
    const user = userEvent.setup();
    openAt(shiftOverview, tabsQuery(shiftOverview));

    await user.click(await screen.findByRole('button', { name: 'Edit layout' }));

    const bar = screen.getByRole('region', { name: 'Edit layout' });
    expect(bar.textContent).toContain(
      'Editing Shift overview. Everyone at this plant sees this tab. Changes are saved when you select Done.',
    );
    await user.click(screen.getByRole('button', { name: 'Widget actions, Late orders' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    expect(screen.queryByRole('region', { name: 'Late orders' })).toBeNull();

    await user.click(within(bar).getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('button', { name: 'Edit layout' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Late orders' })).toBeDefined();
  });

  it('adds a widget from the catalog at the Add widget tile and saves the session on Done', async () => {
    const user = userEvent.setup();
    const sent: { id: string; expectedVersion: number; layout: unknown }[] = [];
    const saved = tab('My shift', 'OWN', [widget('w-new', 'CHART', 'LARGE', 0, 0, 'Chart')], {
      version: 2,
    });
    openAt(myShift, tabsQuery(myShift), saveMutation(saved, sent));

    await user.click(await screen.findByRole('button', { name: 'Edit layout' }));
    await user.click(screen.getByRole('button', { name: 'Add widget' }));

    const catalog = await screen.findByRole('dialog', { name: 'Add widget' });
    expect(catalog.textContent).toContain(
      'To My shift. In this release every widget shows demo data.',
    );
    expect(within(catalog).getByText('Sizes Large, Medium, Wide')).toBeDefined();
    await user.click(within(catalog).getByRole('button', { name: 'Add Chart' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('region', { name: 'Chart' })).toBeDefined();
    await announced('Chart added. Column 1, row 1.');

    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(await screen.findByRole('button', { name: 'Edit layout' })).toBeDefined();
    expect(sent).toEqual([
      {
        id: myShift.id,
        expectedVersion: 1,
        layout: [
          {
            id: expect.stringMatching(/^[0-9a-f-]{36}$/),
            type: 'chart',
            size: 'large',
            x: 0,
            y: 0,
            settings: { title: 'Chart' },
          },
        ],
      },
    ]);
    await announced('Saved My shift.');
  });

  it('finds widgets in the catalog by their name or description', async () => {
    const user = userEvent.setup();
    openAt(myShift, tabsQuery(myShift));

    await user.click(await screen.findByRole('button', { name: 'Edit layout' }));
    await user.click(screen.getByRole('button', { name: 'Add widget' }));
    const catalog = await screen.findByRole('dialog', { name: 'Add widget' });
    const search = within(catalog).getByRole('searchbox', { name: 'Search widgets' });

    await user.type(search, 'number');

    expect(
      within(catalog)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(['Value']);

    await user.clear(search);
    await user.type(search, 'gauge');

    expect(within(catalog).getByText('No widget matches “gauge”.')).toBeDefined();
  });

  it('changes a widget’s title, size and place in its settings, on Apply', async () => {
    const user = userEvent.setup();
    const sent: { id: string; expectedVersion: number; layout: unknown }[] = [];
    openAt(shiftOverview, tabsQuery(shiftOverview), saveMutation(shiftOverview, sent));

    await user.click(await screen.findByRole('button', { name: 'Edit layout' }));
    await user.click(
      screen.getByRole('button', { name: 'Widget actions, Production orders, Milling' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Settings' }));

    const settings = await screen.findByRole('dialog', { name: 'Widget settings' });
    expect(settings.textContent).toContain('Production orders, Milling: a List on Shift overview.');
    const title = within(settings).getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.click(within(settings).getByRole('button', { name: 'Apply' }));
    expect(within(settings).getByText('Enter a title.')).toBeDefined();

    await user.type(title, 'Milling queue');
    await user.click(within(settings).getByRole('radio', { name: 'Tall 6 by 6' }));
    await user.click(within(settings).getByRole('button', { name: 'Move right' }));
    expect(within(settings).getByText('Column 2, row 3.')).toBeDefined();
    await announced('Column 2, row 3.');
    await user.click(within(settings).getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(widgetTitles()).toEqual(['Late orders', 'Milling queue']);

    await user.click(screen.getByRole('button', { name: 'Done' }));

    await screen.findByRole('button', { name: 'Edit layout' });
    expect(sent[0]?.layout).toEqual([
      {
        id: 'w-late',
        type: 'value',
        size: 'small',
        x: 0,
        y: 0,
        settings: { title: 'Late orders' },
      },
      {
        id: 'w-milling',
        type: 'list',
        size: 'tall',
        x: 1,
        y: 2,
        settings: { title: 'Milling queue' },
      },
    ]);
  });

  it('moves a widget down from Widget actions and says where it went', async () => {
    const user = userEvent.setup();
    openAt(shiftOverview, tabsQuery(shiftOverview));

    await user.click(await screen.findByRole('button', { name: 'Edit layout' }));
    await user.click(screen.getByRole('button', { name: 'Widget actions, Late orders' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move down' }));

    expect(widgetTitles()).toEqual(['Production orders, Milling', 'Late orders']);
    await announced('Late orders moved. Column 1, row 5.');
  });

  it('on a version conflict keeps the changes and offers Reload, which starts again from the saved layout', async () => {
    const user = userEvent.setup();
    const sent: { id: string; expectedVersion: number; layout: unknown }[] = [];
    const theirs = tab('Shift overview', 'PLANT', [late], { version: 3 });
    openAt(
      shiftOverview,
      tabsQuery(shiftOverview),
      saveMutation(shiftOverview, sent, [
        {
          message: 'The dashboard tab changed',
          path: ['coreSaveDashboardTab'],
          extensions: { code: 'CONFLICT', errorCode: 'core.version_conflict' },
        },
      ]),
      tabsQuery(theirs),
    );

    await user.click(await screen.findByRole('button', { name: 'Edit layout' }));
    await user.click(screen.getByRole('button', { name: 'Widget actions, Late orders' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move down' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    const summary = await screen.findByRole('group', {
      name: 'This dashboard tab changed while you edited it',
    });
    expect(widgetTitles()).toEqual(['Production orders, Milling', 'Late orders']);

    await user.click(within(summary).getByRole('button', { name: 'Reload dashboard tab' }));

    await waitFor(() => expect(widgetTitles()).toEqual(['Late orders']));
    expect(screen.queryByRole('group', { name: /changed while you edited it/ })).toBeNull();
    expect(screen.getByRole('region', { name: 'Edit layout' })).toBeDefined();
  });

  it('asks before another tab opens over unsaved changes', async () => {
    const user = userEvent.setup();
    const router = openAt(shiftOverview, tabsQuery(shiftOverview, myShift));

    await user.click(await screen.findByRole('button', { name: 'Edit layout' }));
    await user.click(screen.getByRole('button', { name: 'Widget actions, Late orders' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    await user.click(screen.getByRole('tab', { name: 'My shift' }));

    const ask = await screen.findByRole('alertdialog', { name: 'Discard your changes?' });
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect(router.state.location.search).toEqual({ tab: shiftOverview.id });

    await user.click(screen.getByRole('tab', { name: 'My shift' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Discard changes',
      }),
    );

    await waitFor(() => expect(router.state.location.search).toEqual({ tab: myShift.id }));
    expect(screen.queryByRole('region', { name: 'Edit layout' })).toBeNull();
  });

  it('at 12 columns moves a widget by keyboard with its move button, and Escape puts it back', async () => {
    grid.width = 1200;
    const user = userEvent.setup();
    const sent: { id: string; expectedVersion: number; layout: unknown }[] = [];
    openAt(shiftOverview, tabsQuery(shiftOverview), saveMutation(shiftOverview, sent));

    await user.click(await screen.findByRole('button', { name: 'Edit layout' }));
    const move = screen.getByRole('button', { name: 'Move Late orders' });
    move.focus();

    await user.keyboard('{Enter}');
    await announced(
      'Late orders picked up. Column 1, row 1. Arrow keys move it, Enter drops it, Escape cancels.',
    );
    await user.keyboard('{ArrowRight}{ArrowRight}');
    await announced('Column 3, row 1.');
    await user.keyboard('{Escape}');
    await announced('Move cancelled. Late orders is back at column 1, row 1.');

    await user.keyboard('{Enter}{ArrowRight}{Enter}');
    await announced('Late orders dropped. Column 2, row 1.');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Move Late orders' }));

    await user.click(screen.getByRole('button', { name: 'Done' }));

    await screen.findByRole('button', { name: 'Edit layout' });
    expect(sent[0]?.layout).toEqual([
      {
        id: 'w-late',
        type: 'value',
        size: 'small',
        x: 1,
        y: 0,
        settings: { title: 'Late orders' },
      },
      {
        id: 'w-milling',
        type: 'list',
        size: 'medium',
        x: 0,
        y: 2,
        settings: { title: 'Production orders, Milling' },
      },
    ]);
  });
});
