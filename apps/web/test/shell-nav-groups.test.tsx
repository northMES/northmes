// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineWebModule } from '@northmes/web-sdk';
import { createRoute } from '@tanstack/react-router';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { ShellModule } from '../src/modules.ts';
import { PageFrame } from '../src/ui/components/page-frame/index.ts';
import {
  companies,
  crumbs,
  fakeApi,
  linksIn,
  renderShellAt,
  setViewport,
  viewer,
} from './settings-fixtures.tsx';

afterEach(() => {
  cleanup();
  setViewport(1440, 900);
});

/** A page of the fixture module: its h1 and its title in the page frame. */
function page(title: string) {
  return () => <PageFrame title={title}>{null}</PageFrame>;
}

/**
 * A module whose sidebar group holds a nested group, Registers, with Warehouses and Bins, then the
 * entry Moves, and Stock rules in the plant settings navigation.
 */
const stock: ShellModule = {
  label: 'Stock',
  order: 20,
  links: [
    {
      label: 'Registers',
      icon: 'Database',
      links: [
        {
          label: 'Warehouses',
          icon: 'Warehouse',
          link: ({ plant }) => ({ href: `/${plant}/stock/warehouses` }),
        },
        {
          label: 'Bins',
          icon: 'Package',
          permission: 'stock.bin:read',
          link: ({ plant }) => ({ href: `/${plant}/stock/bins` }),
        },
      ],
    },
    {
      label: 'Moves',
      icon: 'Route',
      link: ({ plant }) => ({ href: `/${plant}/stock/moves` }),
    },
    {
      label: 'Stock rules',
      icon: 'ListChecks',
      area: 'settings',
      link: ({ plant }) => ({ href: `/${plant}/stock/rules` }),
    },
  ],
  module: defineWebModule({
    id: 'stock',
    version: '0.1.0',
    routes: (plantRoute) => {
      const stockRoute = createRoute({ getParentRoute: () => plantRoute, path: 'stock' });
      const warehousesRoute = createRoute({ getParentRoute: () => stockRoute, path: 'warehouses' });
      return stockRoute.addChildren([
        warehousesRoute.addChildren([
          createRoute({
            getParentRoute: () => warehousesRoute,
            path: '/',
            component: page('Warehouses'),
          }),
          createRoute({
            getParentRoute: () => warehousesRoute,
            path: '$warehouseId',
            component: () => (
              <PageFrame
                title="Warehouse W1"
                crumbs={[{ label: 'Warehouses', href: '/plant-a/stock/warehouses' }]}
              >
                {null}
              </PageFrame>
            ),
          }),
        ]),
        ...['Bins', 'Moves', 'Rules'].map((title) =>
          createRoute({
            getParentRoute: () => stockRoute,
            path: title.toLowerCase(),
            component: page(title),
          }),
        ),
      ]);
    },
  }),
};

/** Renders the shell with the stock module at path, for a user with these plant permissions. */
function renderAt(path: string, permissions: readonly string[] = ['stock.bin:read']) {
  const api = fakeApi({
    CoreCompanies: companies,
    CoreViewer: () => viewer(permissions, []),
  });
  return renderShellAt(path, [stock], { fetch: api.fetch });
}

/** The Stock group's list of entries in the sidebar's nav, Main. */
async function stockGroup(): Promise<HTMLElement> {
  const sidebar = await screen.findByRole('navigation', { name: 'Main' });
  return within(sidebar).getByRole('list', { name: 'Stock' });
}

describe('a nested group in a module sidebar group (D2 PL5)', () => {
  it('E04-S02 a nested group is a button with its icon and a chevron, open when it holds the current page, with its entries under it', async () => {
    const user = userEvent.setup();
    renderAt('/plant-a/stock/warehouses');
    await screen.findByRole('heading', { level: 1, name: 'Warehouses' });
    const group = await stockGroup();

    const registers = within(group).getByRole('button', { name: 'Registers' });
    expect(registers.getAttribute('aria-expanded')).toBe('true');
    expect(registers.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
    await waitFor(() =>
      expect(linksIn(group)).toEqual([
        ['Warehouses', '/plant-a/stock/warehouses'],
        ['Bins', '/plant-a/stock/bins'],
        ['Moves', '/plant-a/stock/moves'],
      ]),
    );
    expect(
      within(group).getByRole('link', { name: 'Warehouses' }).getAttribute('aria-current'),
    ).toBe('page');

    await user.click(registers);

    expect(registers.getAttribute('aria-expanded')).toBe('false');
    await waitFor(() => expect(linksIn(group)).toEqual([['Moves', '/plant-a/stock/moves']]));
    expect(document.activeElement).toBe(registers);
  });

  it('E04-S02 a nested group that does not hold the current page starts closed, and opens when the user goes to one of its entries', async () => {
    const router = renderAt('/plant-a/stock/moves');
    await screen.findByRole('heading', { level: 1, name: 'Moves' });
    const registers = within(await stockGroup()).getByRole('button', { name: 'Registers' });
    expect(registers.getAttribute('aria-expanded')).toBe('false');

    await router.navigate({ to: '/plant-a/stock/bins' });

    await screen.findByRole('heading', { level: 1, name: 'Bins' });
    expect(registers.getAttribute('aria-expanded')).toBe('true');
  });

  it('E04-S02 a nested group shows only the entries the user may open, and none at all when the user may open none of them', async () => {
    renderAt('/plant-a/stock/moves', []);
    await screen.findByRole('heading', { level: 1, name: 'Moves' });
    const group = await stockGroup();
    await within(group).findByRole('button', { name: 'Registers' });

    await userEvent.setup().click(within(group).getByRole('button', { name: 'Registers' }));
    await waitFor(() =>
      expect(linksIn(group)).toEqual([
        ['Warehouses', '/plant-a/stock/warehouses'],
        ['Moves', '/plant-a/stock/moves'],
      ]),
    );

    cleanup();
    const onlyBins: ShellModule = {
      ...stock,
      links: [
        {
          label: 'Registers',
          icon: 'Database',
          links: [
            {
              label: 'Bins',
              icon: 'Package',
              permission: 'stock.bin:read',
              link: ({ plant }) => ({ href: `/${plant}/stock/bins` }),
            },
          ],
        },
        ...(stock.links ?? []).slice(1),
      ],
    };
    const api = fakeApi({ CoreCompanies: companies, CoreViewer: () => viewer([], []) });
    renderShellAt('/plant-a/stock/moves', [onlyBins], { fetch: api.fetch });
    await screen.findByRole('heading', { level: 1, name: 'Moves' });
    expect(within(await stockGroup()).queryByRole('button', { name: 'Registers' })).toBeNull();
  });
});

describe('the breadcrumb of a page in a nested group', () => {
  it('E04-S02 the breadcrumb names the nested group, as text, between the module and the page', async () => {
    renderAt('/plant-a/stock/warehouses');
    await screen.findByRole('heading', { level: 1, name: 'Warehouses' });

    await waitFor(() => expect(crumbs()).toEqual(['Plant A', 'Stock', 'Registers', 'Warehouses']));
    const breadcrumb = within(screen.getByRole('banner')).getByRole('navigation', {
      name: 'Breadcrumb',
    });
    expect(within(breadcrumb).queryByRole('link', { name: 'Registers' })).toBeNull();
    expect(document.title).toBe('Warehouses · Plant A · NorthMES');
  });

  it("E04-S02 a page under a nested group's entry keeps the group's crumb before the entry's", async () => {
    renderAt('/plant-a/stock/warehouses/w1');
    await screen.findByRole('heading', { level: 1, name: 'Warehouse W1' });

    await waitFor(() =>
      expect(crumbs()).toEqual(['Plant A', 'Stock', 'Registers', 'Warehouses', 'Warehouse W1']),
    );
    expect(document.title).toBe('Warehouse W1 · Plant A · NorthMES');
  });

  it('E04-S02 a page outside the nested group has no group crumb', async () => {
    renderAt('/plant-a/stock/moves');
    await screen.findByRole('heading', { level: 1, name: 'Moves' });

    await waitFor(() => expect(crumbs()).toEqual(['Plant A', 'Stock', 'Moves']));
  });
});

describe('a nested group in the rail (D2 KE28, KE29)', () => {
  /** Renders the shell at path with the sidebar collapsed to the rail. */
  async function renderRailAt(path: string, heading: string) {
    const user = userEvent.setup();
    renderAt(path);
    await screen.findByRole('heading', { level: 1, name: heading });
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    return user;
  }

  it('E04-S02 in the rail a nested group is its icon, a button that opens a flyout headed by the module with focus on its first entry, and Escape returns focus to the icon', async () => {
    const user = await renderRailAt('/plant-a/stock/bins', 'Bins');
    const group = await stockGroup();

    const registers = within(group).getByRole('button', { name: 'Registers' });
    expect(registers.getAttribute('aria-haspopup')).toBe('menu');
    expect(registers.getAttribute('aria-expanded')).toBe('false');
    expect(registers.getAttribute('aria-current')).toBe('true');
    expect(within(group).queryByRole('link', { name: 'Bins' })).toBeNull();
    registers.focus();
    expect(await screen.findByRole('tooltip', { name: 'Registers' })).toBeDefined();

    await user.keyboard('{Enter}');

    const flyout = await screen.findByRole('menu', { name: 'Registers' });
    const items = within(flyout).getAllByRole('menuitem');
    expect(
      items.map((item) => [
        item.textContent,
        item.getAttribute('href'),
        item.getAttribute('aria-current'),
      ]),
    ).toEqual([
      ['Warehouses', '/plant-a/stock/warehouses', null],
      ['Bins', '/plant-a/stock/bins', 'page'],
    ]);
    expect(items[1]?.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
    expect(within(flyout).getByText('Stock')).toBeDefined();
    expect(registers.getAttribute('aria-expanded')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(items[0]));

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(registers);
  });

  it('E04-S02 an entry chosen in the flyout opens its page, and focus moves to its h1', async () => {
    const user = await renderRailAt('/plant-a/stock/moves', 'Moves');
    const registers = within(await stockGroup()).getByRole('button', { name: 'Registers' });
    expect(registers.getAttribute('aria-current')).toBeNull();
    registers.focus();
    await user.keyboard('{Enter}');
    const flyout = await screen.findByRole('menu', { name: 'Registers' });
    await waitFor(() =>
      expect(document.activeElement).toBe(within(flyout).getAllByRole('menuitem')[0]),
    );

    await user.keyboard('{Enter}');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Warehouses' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
