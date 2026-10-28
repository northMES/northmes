// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreDashboardTabs } from '../../../src/modules/core/screens/dashboard/dashboard-tabs.graphql.ts';
import { setViewport } from './access-fixtures.ts';
import { plant, renderCoreAt } from './core-app.tsx';

afterEach(() => {
  cleanup();
  setViewport(1024, 768);
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

/** A fictional tab with an id made from its name. */
function tab(name: string, scope: Scope, widgets: ReturnType<typeof widget>[] = []) {
  return {
    __typename: 'DashboardTab' as const,
    id: `tab-${name.toLowerCase().replaceAll(' ', '-')}`,
    name,
    scope,
    version: 1,
    widgets,
  };
}

const companyOverview = tab('Company overview', 'COMPANY', [
  widget('w-output', 'CHART', 'LARGE', 0, 0, 'Output per week'),
]);
const shiftOverview = tab('Shift overview', 'PLANT', [
  widget('w-milling', 'LIST', 'MEDIUM', 0, 2, 'Production orders, Milling'),
  widget('w-late', 'VALUE', 'SMALL', 3, 0, 'Late orders'),
  widget('w-pressing', 'LIST', 'MEDIUM', 4, 2, 'Production orders, Pressing'),
  widget('w-released', 'VALUE', 'SMALL', 0, 0, 'Released today'),
  widget('w-stops', 'TABLE', 'LARGE', 0, 6, 'Stops this shift'),
]);
const myShift = tab('My shift', 'OWN');

/** coreDashboardTabs answered with these tabs. */
function tabsQuery(...tabs: ReturnType<typeof tab>[]): MockLink.MockedResponse {
  return { request: { query: CoreDashboardTabs }, result: { data: { coreDashboardTabs: tabs } } };
}

const dashboard = coreLinks.dashboard({ plant });

describe('the dashboard at the plant root (design shell-454, option A)', () => {
  it('shows the tabs under the h1 Dashboard, the company’s first, then the plant’s, then the user’s own', async () => {
    renderCoreAt(dashboard.href, [tabsQuery(companyOverview, shiftOverview, myShift)]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined();
    const tablist = await screen.findByRole('tablist', { name: 'Dashboard tabs' });
    expect(
      within(tablist)
        .getAllByRole('tab')
        .map((item) => item.textContent),
    ).toEqual(['Company overview', 'Shift overview', 'My shift']);
    await waitFor(() => expect(document.title).toBe('Dashboard · NorthMES'));
  });

  it('opens the first tab without a tab in the URL, and says who sees it', async () => {
    renderCoreAt(dashboard.href, [tabsQuery(companyOverview, shiftOverview)]);

    const open = await screen.findByRole('tab', { selected: true });
    expect(open.textContent).toBe('Company overview');
    expect(await screen.findByText('Everyone at the company sees this tab.')).toBeDefined();
  });

  it('opens the tab the URL names, and a tab the user picks goes into the URL', async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(coreLinks.dashboard({ plant }, { tab: shiftOverview.id }).href, [
      tabsQuery(companyOverview, shiftOverview, myShift),
    ]);

    expect((await screen.findByRole('tab', { selected: true })).textContent).toBe('Shift overview');
    expect(await screen.findByText('Everyone at this plant sees this tab.')).toBeDefined();

    await user.click(screen.getByRole('tab', { name: 'My shift' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ tab: myShift.id }));
    expect((await screen.findByRole('tab', { selected: true })).textContent).toBe('My shift');
    expect(
      await screen.findByText('Only you see this tab, at every plant of the company.'),
    ).toBeDefined();
  });

  it('moves focus along the tabs with the arrow keys and opens one with Enter (manual activation)', async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(dashboard.href, [tabsQuery(companyOverview, shiftOverview)]);
    const first = await screen.findByRole('tab', { name: 'Company overview' });

    first.focus();
    await user.keyboard('{ArrowRight}');

    const second = screen.getByRole('tab', { name: 'Shift overview' });
    expect(document.activeElement).toBe(second);
    expect(second.getAttribute('aria-selected')).toBe('false');

    await user.keyboard('{Enter}');

    await waitFor(() => expect(router.state.location.search).toEqual({ tab: shiftOverview.id }));
  });

  it('opens the first tab when the URL names a tab the user does not see', async () => {
    renderCoreAt(coreLinks.dashboard({ plant }, { tab: 'tab-gone' }).href, [
      tabsQuery(companyOverview, shiftOverview),
    ]);

    expect((await screen.findByRole('tab', { selected: true })).textContent).toBe(
      'Company overview',
    );
  });

  it('lists the open tab’s widgets in reading order, row by row, each named by its title', async () => {
    renderCoreAt(coreLinks.dashboard({ plant }, { tab: shiftOverview.id }).href, [
      tabsQuery(companyOverview, shiftOverview),
    ]);

    const widgets = await screen.findByRole('list', { name: 'Widgets of Shift overview' });
    expect(
      within(widgets)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual([
      'Released today',
      'Late orders',
      'Production orders, Milling',
      'Production orders, Pressing',
      'Stops this shift',
    ]);
  });

  it('draws each demo widget type with fictional data marked Demo', async () => {
    renderCoreAt(coreLinks.dashboard({ plant }, { tab: shiftOverview.id }).href, [
      tabsQuery(
        tab('Shift overview', 'PLANT', [
          widget('w-late', 'VALUE', 'SMALL', 0, 0, 'Late orders'),
          widget('w-milling', 'LIST', 'MEDIUM', 0, 2, 'Production orders, Milling'),
          widget('w-stops', 'TABLE', 'LARGE', 0, 6, 'Stops this shift'),
          widget('w-output', 'CHART', 'LARGE', 6, 6, 'Output per hour'),
        ]),
      ),
    ]);

    // The demo data follows from each widget's id, so the same numbers show on every load.
    const value = await screen.findByRole('region', { name: 'Late orders' });
    expect(within(value).getByText('Demo')).toBeDefined();
    expect(within(value).getByTestId('widget-value').textContent).toBe('13');
    const list = screen.getByRole('region', { name: 'Production orders, Milling' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'DEMO-8433Wall bracket',
      'DEMO-1603Side panel',
      'DEMO-1756Wall bracket',
      'DEMO-6660Flange 80 mm',
    ]);
    const table = screen.getByRole('region', { name: 'Stops this shift' });
    expect(within(table).getByRole('table', { name: 'Stops this shift' })).toBeDefined();
    const chart = screen.getByRole('region', { name: 'Output per hour' });
    expect(within(chart).getByRole('img', { name: /^Output per hour, demo data: / })).toBeDefined();
  });

  it('says a tab without widgets has none yet', async () => {
    renderCoreAt(coreLinks.dashboard({ plant }, { tab: myShift.id }).href, [
      tabsQuery(companyOverview, myShift),
    ]);

    expect(await screen.findByText('My shift has no widgets yet.')).toBeDefined();
  });

  it('says so when the plant has no dashboard tabs yet', async () => {
    renderCoreAt(dashboard.href, [tabsQuery()]);

    expect(await screen.findByRole('heading', { name: 'No dashboard tabs yet' })).toBeDefined();
  });

  it('offers Try again when the tabs could not be loaded', async () => {
    const user = userEvent.setup();
    renderCoreAt(dashboard.href, [
      { request: { query: CoreDashboardTabs }, error: new Error('offline') },
      tabsQuery(companyOverview),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('tab', { name: 'Company overview' })).toBeDefined();
  });

  it('at 320 px picks the tab in a select', async () => {
    setViewport(320, 640);
    const user = userEvent.setup();
    const router = renderCoreAt(dashboard.href, [tabsQuery(companyOverview, shiftOverview)]);

    const select = await screen.findByRole('combobox', { name: 'Dashboard tab' });
    expect(screen.queryByRole('tablist')).toBeNull();

    await user.selectOptions(select, 'Shift overview');

    await waitFor(() => expect(router.state.location.search).toEqual({ tab: shiftOverview.id }));
  });
});
