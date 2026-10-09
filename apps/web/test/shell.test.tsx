// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { defineWebModule, useShell } from '@northmes/web-sdk';
import {
  createMemoryHistory,
  createRoute,
  RouterProvider,
  useNavigate,
} from '@tanstack/react-router';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type ShellModule, shellModules } from '../src/modules.ts';
import { createShellRouter } from '../src/shell/index.ts';
import { PageFrame } from '../src/ui/components/page-frame/index.ts';
import type { NavIconName } from '../src/ui/lib/nav-icon-names.ts';
import { Button } from '../src/ui/primitives/button.tsx';

/** Resizes happy-dom's window, as the browser does at 320 px or on a desktop. */
function setViewport(width: number, height: number) {
  (
    window as unknown as {
      happyDOM: { setViewport(viewport: { width: number; height: number }): void };
    }
  ).happyDOM.setViewport({ width, height });
}

afterEach(() => {
  cleanup();
  setViewport(1440, 900);
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
});

/** A screen whose h1 cannot take focus, as the board stub's. */
function BoardScreen() {
  const { plantId } = useShell();
  return <h1>Board of {plantId}</h1>;
}

/** A list screen in a page frame, with a page action and a control in its content. */
function OrdersScreen() {
  return (
    <PageFrame title="Production orders" actions={<Button>New order</Button>}>
      <button type="button">Search orders</button>
    </PageFrame>
  );
}

/** A detail screen in a page frame, under its list's crumb. */
function OrderScreen() {
  const { plantId } = useShell();
  return (
    <PageFrame
      title="Order 1001"
      crumbs={[{ label: 'Production orders', href: `/${plantId}/planning/orders` }]}
    >
      <p>Order 1001</p>
    </PageFrame>
  );
}

const planning: ShellModule = {
  label: 'Planning',
  order: 20,
  links: [
    {
      label: 'Planning board',
      icon: 'ChartGantt',
      link: ({ plant }) => ({ href: `/${plant}/planning/board` }),
    },
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
      const boardRoute = createRoute({
        getParentRoute: () => planningRoute,
        path: 'board',
        component: BoardScreen,
      });
      const ordersRoute = createRoute({ getParentRoute: () => planningRoute, path: 'orders' });
      const orderListRoute = createRoute({
        getParentRoute: () => ordersRoute,
        path: '/',
        component: OrdersScreen,
      });
      const orderRoute = createRoute({
        getParentRoute: () => ordersRoute,
        path: '$orderId',
        component: OrderScreen,
      });
      return planningRoute.addChildren([
        boardRoute,
        ordersRoute.addChildren([orderListRoute, orderRoute]),
      ]);
    },
  }),
};

/** A screen with an h1 that can take focus and a button that changes only the search. */
function SettingsScreen() {
  const navigate = useNavigate();
  return (
    <>
      <h1 tabIndex={-1}>Settings</h1>
      <button type="button" onClick={() => navigate({ to: '.', search: { tab: 'history' } })}>
        Show history
      </button>
    </>
  );
}

const settings: ShellModule = {
  label: 'Settings',
  order: 40,
  links: [
    {
      label: 'Settings',
      icon: 'CalendarCog',
      link: ({ plant }) => ({ href: `/${plant}/settings` }),
    },
  ],
  module: defineWebModule({
    id: 'settings',
    version: '0.4.0',
    routes: (plantRoute) =>
      createRoute({
        getParentRoute: () => plantRoute,
        path: 'settings',
        component: SettingsScreen,
      }),
  }),
};

const pingQuery = gql`
  query Ping {
    ping
  }
`;

function PingScreen() {
  const { data, error } = useQuery<{ ping: string }>(pingQuery);
  if (error) return <p>{error.message}</p>;
  return <p>{data ? `The API answered ${data.ping}` : 'Loading'}</p>;
}

const quality: ShellModule = {
  label: 'Quality',
  order: 10,
  links: [
    {
      label: 'Inspections',
      icon: 'ListChecks',
      link: ({ plant }) => ({ href: `/${plant}/quality` }),
    },
    {
      label: 'Deviations',
      // A plugin built against a newer list of icon names.
      icon: 'NotAnIconName' as NavIconName,
      link: ({ plant }) => ({ href: `/${plant}/quality/deviations` }),
    },
  ],
  module: defineWebModule({
    id: 'quality',
    version: '0.4.0',
    routes: (plantRoute) =>
      createRoute({ getParentRoute: () => plantRoute, path: 'quality', component: PingScreen }),
  }),
};

const maintenance: ShellModule = {
  label: 'Maintenance',
  order: 30,
  module: defineWebModule({
    id: 'maintenance',
    version: '0.4.0',
    routes: (plantRoute) => createRoute({ getParentRoute: () => plantRoute, path: 'maintenance' }),
  }),
};

/** Renders the shell's router for the modules at path. */
function renderShellAt(
  path: string,
  modules: Parameters<typeof createShellRouter>[0],
  options: Parameters<typeof createShellRouter>[1] = {},
) {
  const router = createShellRouter(modules, {
    ...options,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
}

/** The visible label of a sidebar group, which names its list of links. */
function groupLabel(list: HTMLElement): string | null | undefined {
  const id = list.getAttribute('aria-labelledby');
  return id === null ? undefined : document.getElementById(id)?.textContent;
}

/** The text and href of each link in a sidebar group. */
function linksIn(list: HTMLElement): (string | null)[][] {
  return within(list)
    .queryAllByRole('link')
    .map((link) => [link.textContent, link.getAttribute('href')]);
}

/** The module groups of the sidebar's nav, Main. */
async function sidebarGroups(): Promise<HTMLElement[]> {
  const sidebar = await screen.findByRole('navigation', { name: 'Main' });
  return within(sidebar)
    .getAllByRole('list')
    .filter((list) => list.hasAttribute('aria-labelledby'));
}

/** The accessible name of the focused element: its aria-label, else its text. */
function focusedName(): string {
  const element = document.activeElement;
  return element?.getAttribute('aria-label') ?? element?.textContent?.trim() ?? '';
}

describe('the shell', () => {
  it("E02-S05 the shell mounts each module's routes under $plant", async () => {
    renderShellAt('/plant-a/planning/board', [planning]);

    expect(await screen.findByRole('heading', { name: 'Board of plant-a' })).toBeDefined();
  });

  it('E04-S02 the sidebar has a group per module by their order, each with its links to the plant in the URL', async () => {
    renderShellAt('/plant-a/planning/board', [maintenance, planning, quality]);

    const groups = await sidebarGroups();
    expect(groups.map(groupLabel)).toEqual(['Quality', 'Planning', 'Maintenance']);
    expect(groups.map(linksIn)).toEqual([
      [
        ['Inspections', '/plant-a/quality'],
        ['Deviations', '/plant-a/quality/deviations'],
      ],
      [
        ['Planning board', '/plant-a/planning/board'],
        ['Production orders', '/plant-a/planning/orders'],
      ],
      [],
    ]);
  });

  it("E04-S02 the web's sidebar has Articles in the Core group before Planning board in the Planning group", async () => {
    // The screen's query never gets an answer; the test reads the sidebar alone.
    const fetch = vi.fn<typeof globalThis.fetch>(() => new Promise(() => {}));
    renderShellAt('/plant-a/core/articles', shellModules, { fetch });

    const groups = await sidebarGroups();
    expect(groups.map(groupLabel)).toEqual(['Core', 'Planning']);
    expect(groups.map(linksIn)).toEqual([
      [['Articles', '/plant-a/core/articles']],
      [['Planning board', '/plant-a/planning/board']],
    ]);
  });

  it('E04-S02 every nav entry shows an icon hidden from assistive technology, also for a name the web does not know', async () => {
    renderShellAt('/plant-a/planning/board', [quality, planning]);

    const groups = await sidebarGroups();
    const links = groups.flatMap((group) => within(group).getAllByRole('link'));
    expect(links).toHaveLength(4);
    for (const link of links) {
      expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('E04-S02 the current nav entry carries aria-current="page", and the entry of a page under it aria-current="true"', async () => {
    renderShellAt('/plant-a/planning/orders', [planning]);
    await screen.findByRole('heading', { level: 1, name: 'Production orders' });

    const [group] = await sidebarGroups();
    const current = (name: string) =>
      within(group as HTMLElement)
        .getByRole('link', { name })
        .getAttribute('aria-current');
    expect(current('Production orders')).toBe('page');
    expect(current('Planning board')).toBeNull();

    cleanup();
    renderShellAt('/plant-a/planning/orders/1001', [planning]);
    await screen.findByRole('heading', { level: 1, name: 'Order 1001' });

    const [detailGroup] = await sidebarGroups();
    expect(
      within(detailGroup as HTMLElement)
        .getByRole('link', { name: 'Production orders' })
        .getAttribute('aria-current'),
    ).toBe('true');
  });

  it('E04-S02 the first Tab reaches the skip link, which moves focus to main', async () => {
    const user = userEvent.setup();
    renderShellAt('/plant-a/planning/orders', [planning]);
    await screen.findByRole('heading', { level: 1, name: 'Production orders' });

    await user.tab();
    expect(focusedName()).toBe('Skip to main content');
    await user.keyboard('{Enter}');

    expect(document.activeElement).toBe(screen.getByRole('main'));
    await user.tab();
    expect(focusedName()).toBe('Search orders');
  });

  it('E04-S02 Tab moves through the skip link, the sidebar, the user button, the sidebar trigger, the breadcrumb, the page actions and then the page', async () => {
    const user = userEvent.setup();
    renderShellAt('/plant-a/planning/orders', [quality, planning]);
    await screen.findByRole('heading', { level: 1, name: 'Production orders' });
    // The route change focuses the h1, which Tab never stops on; start from the page's top.
    (document.activeElement as HTMLElement | null)?.blur();

    const names: string[] = [];
    for (let stop = 0; stop < 11; stop++) {
      await user.tab();
      names.push(focusedName());
    }

    expect(names).toEqual([
      'Skip to main content',
      'Inspections',
      'Deviations',
      'Planning board',
      'Production orders',
      expect.stringMatching(/, account$/),
      'Collapse sidebar',
      'plant-a',
      'Planning',
      'New order',
      'Search orders',
    ]);
  });

  it('E04-S02 the breadcrumb in the top bar starts with the plant, then the module and the page crumbs, and ends with the current page', async () => {
    renderShellAt('/plant-a/planning/orders/1001', [quality, planning]);
    await screen.findByRole('heading', { level: 1, name: 'Order 1001' });

    const banner = screen.getByRole('banner');
    const breadcrumb = within(banner).getByRole('navigation', { name: 'Breadcrumb' });
    expect(
      within(breadcrumb)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['plant-a', 'Planning', 'Production orders', 'Order 1001']);
    expect(
      within(breadcrumb)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['plant-a', '/plant-a/quality'],
      ['Planning', '/plant-a/planning/board'],
      ['Production orders', '/plant-a/planning/orders'],
    ]);
    expect(within(breadcrumb).getByText('Order 1001').getAttribute('aria-current')).toBe('page');
    expect(document.title).toBe('Order 1001 · plant-a · NorthMES');
  });

  it('E04-S02 the page actions sit in the top bar, and the h1 stays in main', async () => {
    renderShellAt('/plant-a/planning/orders', [planning]);
    await screen.findByRole('heading', { level: 1, name: 'Production orders' });

    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: 'New order' }),
    ).toBeDefined();
    expect(
      within(screen.getByRole('main')).getByRole('heading', {
        level: 1,
        name: 'Production orders',
      }),
    ).toBeDefined();
  });

  it('E04-S02 Collapse sidebar keeps focus while the sidebar becomes the rail, and its name and aria-expanded flip', async () => {
    const user = userEvent.setup();
    renderShellAt('/plant-a/planning/board', [planning]);
    await screen.findByRole('heading', { name: 'Board of plant-a' });

    const trigger = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const sidebarId = trigger.getAttribute('aria-controls');
    expect(sidebarId).not.toBeNull();
    expect(document.getElementById(sidebarId as string)).not.toBeNull();
    await user.click(trigger);

    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-label')).toBe('Expand sidebar');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('E04-S02 in the rail an entry shows its label in a tooltip on focus, and Escape closes the tooltip with focus kept', async () => {
    const user = userEvent.setup();
    renderShellAt('/plant-a/planning/board', [planning]);
    await screen.findByRole('heading', { name: 'Board of plant-a' });
    const trigger = screen.getByRole('button', { name: 'Collapse sidebar' });
    const link = screen.getByRole('link', { name: 'Production orders' });

    // In the labelled sidebar the label is on screen, so focus opens no tooltip.
    trigger.focus();
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(link);
    expect(screen.queryByRole('tooltip', { name: 'Production orders' })).toBeNull();

    await user.tab();
    await user.tab();
    await user.keyboard('{Enter}');
    expect(trigger.getAttribute('aria-label')).toBe('Expand sidebar');
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(link);

    const tooltip = await screen.findByRole('tooltip', { name: 'Production orders' });
    expect(tooltip.textContent).toBe('Production orders');
    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('tooltip', { name: 'Production orders' })).toBeNull(),
    );
    expect(document.activeElement).toBe(link);
  });

  it('E04-S02 at 320 px Open navigation opens the sheet with focus on Close navigation, and Escape closes it with focus back on Open navigation', async () => {
    setViewport(320, 640);
    const user = userEvent.setup();
    renderShellAt('/plant-a/planning/board', [planning]);
    await screen.findByRole('heading', { name: 'Board of plant-a' });
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();

    const open = await screen.findByRole('button', { name: 'Open navigation' });
    expect(open.getAttribute('aria-haspopup')).toBe('dialog');
    open.focus();
    await user.keyboard('{Enter}');

    const sheet = await screen.findByRole('dialog', { name: 'Navigation' });
    expect(within(sheet).getByRole('navigation', { name: 'Main' })).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(sheet).getByRole('button', { name: 'Close navigation' }),
      ),
    );
    expect(open.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(open));
    expect(open.getAttribute('aria-expanded')).toBe('false');
  });

  it('E04-S02 at 320 px an entry in the sheet closes the sheet and focus moves to the new h1', async () => {
    setViewport(320, 640);
    const user = userEvent.setup();
    renderShellAt('/plant-a/planning/board', [planning, settings]);
    await screen.findByRole('heading', { name: 'Board of plant-a' });

    await user.click(await screen.findByRole('button', { name: 'Open navigation' }));
    const sheet = await screen.findByRole('dialog', { name: 'Navigation' });
    await user.click(within(sheet).getByRole('link', { name: 'Settings' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull());
    const heading = await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it('E04-S02 the user menu switches the theme to dark, keeps the choice, and returns focus to the user button', async () => {
    const user = userEvent.setup();
    renderShellAt('/plant-a/planning/board', [planning]);
    await screen.findByRole('heading', { name: 'Board of plant-a' });

    const userButton = screen.getByRole('button', { name: /, account$/ });
    expect(userButton.getAttribute('aria-haspopup')).toBe('menu');
    userButton.focus();
    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Light' }).getAttribute('aria-checked'),
    ).toBe('true');
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Dark' }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('northmes-theme')).toBe('dark');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(userButton));
  });

  it('E04-S02 a page loads in the theme chosen before', async () => {
    localStorage.setItem('northmes-theme', 'dark');
    const user = userEvent.setup();
    renderShellAt('/plant-a/planning/board', [planning]);
    await screen.findByRole('heading', { name: 'Board of plant-a' });

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    await user.click(screen.getByRole('button', { name: /, account$/ }));
    expect(
      (await screen.findByRole('menuitemradio', { name: 'Dark' })).getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('E06-S06 a path change moves focus to the new h1, and a search change leaves focus where it is', async () => {
    const user = userEvent.setup();
    renderShellAt('/plant-a/planning/board', [planning, settings]);
    await screen.findByRole('heading', { name: 'Board of plant-a' });

    await user.click(screen.getByRole('link', { name: 'Settings' }));

    const heading = await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    const button = screen.getByRole('button', { name: 'Show history' });
    await user.click(button);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(document.activeElement).toBe(button);
  });

  it('E06-S06 a path change to a page whose h1 cannot take focus moves focus to main', async () => {
    const user = userEvent.setup();
    renderShellAt('/plant-a/settings', [planning, settings]);
    await screen.findByRole('heading', { level: 1, name: 'Settings' });

    await user.click(screen.getByRole('link', { name: 'Planning board' }));

    await screen.findByRole('heading', { name: 'Board of plant-a' });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('main')));
  });

  it("E02-S05 a module's screen queries the API at apiUrl with the client for the plant in the URL", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response(JSON.stringify({ data: { ping: 'pong' } }), {
          headers: { 'content-type': 'application/graphql-response+json' },
        }),
    );

    renderShellAt('/plant-b/quality', [quality], { fetch, apiUrl: 'https://api.northmes.test' });

    expect(await screen.findByText('The API answered pong')).toBeDefined();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toBe('https://api.northmes.test/graphql');
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get('x-northmes-plant')).toBe('plant-b');
  });
});
