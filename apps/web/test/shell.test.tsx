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
import { createShellRouter } from '../src/shell.tsx';

afterEach(cleanup);

function BoardScreen() {
  const { plantId } = useShell();
  return <h1>Board of {plantId}</h1>;
}

const planning: ShellModule = {
  label: 'Planning',
  order: 20,
  links: [{ label: 'Planning board', link: ({ plant }) => ({ href: `/${plant}/planning/board` }) }],
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
      return planningRoute.addChildren([boardRoute]);
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
  links: [{ label: 'Settings', link: ({ plant }) => ({ href: `/${plant}/settings` }) }],
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
    { label: 'Inspections', link: ({ plant }) => ({ href: `/${plant}/quality` }) },
    { label: 'Deviations', link: ({ plant }) => ({ href: `/${plant}/quality/deviations` }) },
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

/** The visible label of a menu group, which names its list of links. */
function groupLabel(list: HTMLElement): string | null | undefined {
  const id = list.getAttribute('aria-labelledby');
  return id === null ? undefined : document.getElementById(id)?.textContent;
}

/** The text and href of each link in a menu group. */
function linksIn(list: HTMLElement): (string | null)[][] {
  return within(list)
    .queryAllByRole('link')
    .map((link) => [link.textContent, link.getAttribute('href')]);
}

describe('the shell', () => {
  it("E02-S05 the shell mounts each module's routes under $plant", async () => {
    renderShellAt('/plant-a/planning/board', [planning]);

    expect(await screen.findByRole('heading', { name: 'Board of plant-a' })).toBeDefined();
  });

  it('E06-S06 the menu has a group per module by their order, each with its links to the plant in the URL', async () => {
    renderShellAt('/plant-a/planning/board', [maintenance, planning, quality]);

    const menu = await screen.findByRole('navigation', { name: 'Modules' });
    const groups = within(menu)
      .getAllByRole('list')
      .filter((list) => list.hasAttribute('aria-labelledby'));
    expect(groups.map(groupLabel)).toEqual(['Quality', 'Planning', 'Maintenance']);
    expect(groups.map(linksIn)).toEqual([
      [
        ['Inspections', '/plant-a/quality'],
        ['Deviations', '/plant-a/quality/deviations'],
      ],
      [['Planning board', '/plant-a/planning/board']],
      [],
    ]);
  });

  it("E06-S06 the web's menu has Articles in the Core group before Planning board in the Planning group", async () => {
    // The screen's query never gets an answer; the test reads the menu alone.
    const fetch = vi.fn<typeof globalThis.fetch>(() => new Promise(() => {}));
    renderShellAt('/plant-a/core/articles', shellModules, { fetch });

    const menu = await screen.findByRole('navigation', { name: 'Modules' });
    const groups = within(menu)
      .getAllByRole('list')
      .filter((list) => list.hasAttribute('aria-labelledby'));
    expect(groups.map(groupLabel)).toEqual(['Core', 'Planning']);
    expect(groups.map(linksIn)).toEqual([
      [['Articles', '/plant-a/core/articles']],
      [['Planning board', '/plant-a/planning/board']],
    ]);
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
