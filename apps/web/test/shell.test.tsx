// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { defineWebModule, useShell } from '@northmes/web-sdk';
import { createMemoryHistory, createRoute, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShellModule } from '../src/modules.ts';
import { createShellRouter } from '../src/shell.tsx';

afterEach(cleanup);

function BoardScreen() {
  const { plantId } = useShell();
  return <h1>Board of {plantId}</h1>;
}

const planning: ShellModule = {
  label: 'Planning',
  order: 20,
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

describe('the shell', () => {
  it("E02-S05 the shell mounts each module's routes under $plant", async () => {
    renderShellAt('/plant-a/planning/board', [planning]);

    expect(await screen.findByRole('heading', { name: 'Board of plant-a' })).toBeDefined();
  });

  it('E02-S05 the menu lists the modules by their order', async () => {
    renderShellAt('/plant-a/planning/board', [maintenance, planning, quality]);

    const menu = await screen.findByRole('navigation', { name: 'Modules' });
    expect(
      within(menu)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Quality', 'Planning', 'Maintenance']);
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
