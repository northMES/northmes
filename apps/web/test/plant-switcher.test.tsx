// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineWebModule, useShell } from '@northmes/web-sdk';
import { createMemoryHistory, createRoute, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShellModule } from '../src/modules.ts';
import { createShellRouter } from '../src/shell/index.ts';
import { PageFrame } from '../src/ui/components/page-frame/index.ts';
import { fakeSession } from './auth/fake-session.ts';

afterEach(cleanup);

/** A plant as coreCompanies lists it. */
interface PlantNode {
  readonly slug: string;
  readonly name: string;
}

/** A company as coreCompanies lists it, with fictional plants. */
function company(name: string, plants: readonly PlantNode[]) {
  return {
    __typename: 'Company',
    id: `company-${name}`,
    name,
    plants: plants.map(({ slug, name }) => ({
      __typename: 'Plant',
      id: `plant-${slug}`,
      slug,
      name,
    })),
  };
}

const plantA = { slug: 'plant-a', name: 'Plant A' };
const plantB = { slug: 'plant-b', name: 'Plant B' };
const plantC = { slug: 'plant-c', name: 'Plant C' };

/** Plants A and B of one company, and plant C of another. */
const twoCompanies = [company('Demo Works', [plantA, plantB]), company('Nordic Tools', [plantC])];

/** A list screen whose h1 takes focus. */
function OrdersScreen() {
  const { plant } = useShell();
  return <PageFrame title={`Production orders of ${plant}`}>{null}</PageFrame>;
}

/** A detail screen under the orders list. */
function OrderScreen() {
  return <PageFrame title="Order 1001">{null}</PageFrame>;
}

const planning: ShellModule = {
  label: 'Planning',
  order: 20,
  links: [
    {
      label: 'Production orders',
      icon: 'ClipboardList',
      link: ({ plant }) => ({ href: `/${plant}/planning/orders` }),
    },
  ],
  module: defineWebModule({
    id: 'planning',
    version: '0.4.0',
    routes: (plantRoute) => {
      const planningRoute = createRoute({ getParentRoute: () => plantRoute, path: 'planning' });
      const ordersRoute = createRoute({ getParentRoute: () => planningRoute, path: 'orders' });
      const listRoute = createRoute({
        getParentRoute: () => ordersRoute,
        path: '/',
        component: OrdersScreen,
      });
      const orderRoute = createRoute({
        getParentRoute: () => ordersRoute,
        path: '$orderId',
        component: OrderScreen,
      });
      return planningRoute.addChildren([ordersRoute.addChildren([listRoute, orderRoute])]);
    },
  }),
};

/**
 * A fetch that answers coreCompanies with these companies and leaves every other request
 * unanswered, and records the operation name and x-northmes-plant of each request.
 */
function apiWith(companies: readonly ReturnType<typeof company>[]) {
  const requests: { operation: string; plant: string | null }[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
    const { operationName } = JSON.parse(String(init?.body)) as { operationName: string };
    requests.push({
      operation: operationName,
      plant: new Headers(init?.headers).get('x-northmes-plant'),
    });
    if (operationName !== 'CoreCompanies') return new Promise<Response>(() => {});
    return new Response(JSON.stringify({ data: { coreCompanies: companies } }), {
      headers: { 'content-type': 'application/graphql-response+json' },
    });
  });
  return { fetch, requests };
}

/** Renders the shell at path for a signed-in viewer whose plants are those of companies. */
function renderAt(path: string, companies: readonly ReturnType<typeof company>[]) {
  const api = apiWith(companies);
  const router = createShellRouter([planning], {
    session: fakeSession(),
    fetch: api.fetch,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  return { ...api, router };
}

/** The sidebar's nav, Main. */
function sidebar(): Promise<HTMLElement> {
  return screen.findByRole('navigation', { name: 'Main' });
}

/** Opens the switcher with the keyboard and returns its menu. */
async function openSwitcher(user: ReturnType<typeof userEvent.setup>, name: RegExp | string) {
  const switcher = await within(await sidebar()).findByRole('button', { name });
  switcher.focus();
  await user.keyboard('{Enter}');
  return { switcher, menu: await screen.findByRole('menu', { name: 'Switch plant' }) };
}

/** The text and href of each plant link in a menu group. */
function plantLinks(group: HTMLElement) {
  return within(group)
    .getAllByRole('menuitem')
    .map((item) => [item.textContent, item.getAttribute('href')]);
}

describe('the plant switcher', () => {
  it('E04-S04 the switcher is the first item of the sidebar, named by its company and plant', async () => {
    const user = userEvent.setup();
    renderAt('/plant-a/planning/orders', twoCompanies);
    await screen.findByRole('heading', { level: 1, name: 'Production orders of plant-a' });
    await within(await sidebar()).findByRole('button', { name: /switch plant$/ });
    (document.activeElement as HTMLElement | null)?.blur();

    await user.tab();
    await user.tab();

    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Demo Works, Plant A, switch plant',
    );
    expect(document.activeElement?.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('E04-S04 plants of two companies render under two group labels, and the link to the current plant carries aria-current', async () => {
    const user = userEvent.setup();
    renderAt('/plant-a/planning/orders', twoCompanies);

    const { menu } = await openSwitcher(user, 'Demo Works, Plant A, switch plant');

    const groups = within(menu).getAllByRole('group');
    expect(groups.map((group) => group.getAttribute('aria-labelledby'))).not.toContain(null);
    expect(
      groups.map(
        (group) =>
          document.getElementById(group.getAttribute('aria-labelledby') ?? '')?.textContent,
      ),
    ).toEqual(['Demo Works', 'Nordic Tools']);
    expect(groups.map(plantLinks)).toEqual([
      [
        ['Plant A', '/plant-a/planning/orders'],
        ['Plant B', '/plant-b/planning/orders'],
      ],
      [['Plant C', '/plant-c/planning/orders']],
    ]);
    const current = within(menu).getByRole('menuitem', { name: 'Plant A' });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(
      within(menu).getByRole('menuitem', { name: 'Plant B' }).getAttribute('aria-current'),
    ).toBeNull();
  });

  it('E04-S04 plants of one company render without group labels', async () => {
    const user = userEvent.setup();
    renderAt('/plant-b/planning/orders', [company('Demo Works', [plantA, plantB])]);

    const { menu } = await openSwitcher(user, 'Demo Works, Plant B, switch plant');

    expect(within(menu).queryAllByRole('group')).toEqual([]);
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Plant A', 'Plant B']);
  });

  it('E04-S04 with one plant the switcher is not rendered, and the sidebar head names the company and the plant as text', async () => {
    renderAt('/plant-a/planning/orders', [company('Demo Works', [plantA])]);
    const nav = await sidebar();

    await within(nav).findByText('Plant A');

    expect(within(nav).queryByRole('button', { name: /switch plant$/ })).toBeNull();
    expect(within(nav).getByText('Demo Works')).toBeDefined();
  });

  it('E04-S04 on /plant-a/planning/orders/1001 the plant-b link is /plant-b/planning/orders, and on a page whose only param is the plant the link keeps the page and its search', async () => {
    const user = userEvent.setup();
    renderAt('/plant-a/planning/orders/1001', twoCompanies);
    await screen.findByRole('heading', { level: 1, name: 'Order 1001' });

    const detail = await openSwitcher(user, /switch plant$/);
    expect(
      within(detail.menu).getByRole('menuitem', { name: 'Plant B' }).getAttribute('href'),
    ).toBe('/plant-b/planning/orders');
    await user.keyboard('{Escape}');
    cleanup();

    renderAt('/plant-a/planning/orders?page=2', twoCompanies);
    const list = await openSwitcher(user, /switch plant$/);
    expect(within(list.menu).getByRole('menuitem', { name: 'Plant C' }).getAttribute('href')).toBe(
      '/plant-c/planning/orders?page=2',
    );
  });

  it('E04-S04 Enter opens the switcher on the first plant other than the current one, Escape returns focus to it, and a plant opens the same page there with focus on its h1', async () => {
    const user = userEvent.setup();
    const { router, requests } = renderAt('/plant-a/planning/orders', twoCompanies);

    const { switcher, menu } = await openSwitcher(user, /switch plant$/);
    await waitFor(() =>
      expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Plant B' })),
    );
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(switcher));

    await user.keyboard('{Enter}');
    await screen.findByRole('menu', { name: 'Switch plant' });
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Plant B'));
    await user.keyboard('{End}{Enter}');

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'Production orders of plant-c',
    });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(router.state.location.pathname).toBe('/plant-c/planning/orders');
    expect(requests.filter(({ operation }) => operation === 'CoreCompanies')).toEqual([
      { operation: 'CoreCompanies', plant: null },
    ]);
  });
});

describe('the plant crumb', () => {
  /** The breadcrumb's items and links in the top bar. */
  function breadcrumb() {
    const nav = within(screen.getByRole('banner')).getByRole('navigation', { name: 'Breadcrumb' });
    return {
      items: within(nav)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
      links: within(nav)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    };
  }

  it("E04-S04 the breadcrumb starts with the plant's name, linked to the plant's first page, and the title names the plant", async () => {
    renderAt('/plant-b/planning/orders/1001', [company('Demo Works', [plantA, plantB])]);
    await screen.findByRole('heading', { level: 1, name: 'Order 1001' });

    await waitFor(() => expect(breadcrumb().items[0]).toBe('Plant B'));
    expect(breadcrumb().links[0]).toEqual(['Plant B', '/plant-b/planning/orders']);
    expect(document.title).toBe('Order 1001 · Plant B · NorthMES');
  });

  it('E04-S04 with plants in two companies a company crumb without a link comes first', async () => {
    renderAt('/plant-c/planning/orders/1001', twoCompanies);
    await screen.findByRole('heading', { level: 1, name: 'Order 1001' });

    await waitFor(() =>
      expect(breadcrumb().items.slice(0, 2)).toEqual(['Nordic Tools', 'Plant C']),
    );
    expect(breadcrumb().links.map(([label]) => label)).not.toContain('Nordic Tools');
  });
});

describe('a plant the user cannot open', () => {
  it("E04-S04 a plant slug that is none of the user's plants shows Plant not found with links to the user's plants, without the sidebar", async () => {
    renderAt('/plant-x/planning/orders', twoCompanies);

    const heading = await screen.findByRole('heading', { level: 1, name: 'Plant not found' });

    expect(heading).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    expect(
      screen.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Plant A', '/plant-a/planning/orders'],
      ['Plant B', '/plant-b/planning/orders'],
      ['Plant C', '/plant-c/planning/orders'],
    ]);
  });
});
