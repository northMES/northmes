// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { defineWebModule, useShell } from '@northmes/web-sdk';
import { createMemoryHistory, createRoute, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type FederationRuntime,
  fetchModuleList,
  type ListedModule,
  loadModules,
} from '../src/federation.ts';
import { createShellRouter } from '../src/shell.tsx';

afterEach(cleanup);

const planning: ListedModule = {
  id: 'planning',
  version: '0.4.0',
  remoteName: 'planning',
  label: 'Planning',
  order: 20,
  manifestUrl: '/modules/planning/0.4.0/mf-manifest.json',
  integrity: 'sha384-planning',
};

function BoardScreen() {
  const { plantId } = useShell();
  return <h1>Board of {plantId}</h1>;
}

const planningModule = defineWebModule({
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
});

const quality: ListedModule = {
  id: 'quality',
  version: '0.4.0',
  remoteName: 'quality',
  label: 'Quality',
  order: 10,
  manifestUrl: '/modules/quality/0.4.0/mf-manifest.json',
  integrity: 'sha384-quality',
};

const pingQuery = gql`
  query Ping {
    ping
  }
`;

function PingScreen() {
  const { data, error } = useQuery<{ ping: string }>(pingQuery);
  if (error) return <p>{error.message}</p>;
  return <p>{data ? `The gateway answered ${data.ping}` : 'Loading'}</p>;
}

const qualityModule = defineWebModule({
  id: 'quality',
  version: '0.4.0',
  routes: (plantRoute) =>
    createRoute({ getParentRoute: () => plantRoute, path: 'quality', component: PingScreen }),
});

const maintenance: ListedModule = {
  id: 'maintenance',
  version: '0.4.0',
  remoteName: 'maintenance',
  label: 'Maintenance',
  order: 30,
  manifestUrl: '/modules/maintenance/0.4.0/mf-manifest.json',
  integrity: 'sha384-maintenance',
};

const maintenanceModule = defineWebModule({
  id: 'maintenance',
  version: '0.4.0',
  routes: (plantRoute) => createRoute({ getParentRoute: () => plantRoute, path: 'maintenance' }),
});

/**
 * A federation runtime that stands in for @module-federation/runtime. The ./module entry of each
 * registered remote exports the value that exposed holds under the remote's name as its default,
 * and loading it throws when that value is an error.
 */
function fakeRuntime(exposed: Readonly<Record<string, unknown>>) {
  const registered: { name: string; entry: string }[] = [];
  const runtime: FederationRuntime = {
    registerRemotes(remotes) {
      registered.push(...remotes);
    },
    async loadRemote<T>(id: string): Promise<T | null> {
      const [name, entry] = id.split('/');
      if (!registered.some((remote) => remote.name === name)) {
        throw new Error(`no remote named ${name} is registered`);
      }
      if (entry !== 'module' || name === undefined) {
        throw new Error(`the remote ${name} exposes no ${entry}`);
      }
      const value = exposed[name];
      if (value instanceof Error) throw value;
      return { default: value } as T;
    },
  };
  return { runtime, registered };
}

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
  it('E02-S05 the shell registers each listed remote and mounts its routes under $plant', async () => {
    const { runtime, registered } = fakeRuntime({ planning: planningModule });

    renderShellAt('/plant-a/planning/board', await loadModules([planning], runtime));

    expect(registered).toEqual([
      { name: 'planning', entry: '/modules/planning/0.4.0/mf-manifest.json' },
    ]);
    expect(await screen.findByRole('heading', { name: 'Board of plant-a' })).toBeDefined();
  });

  it('E02-S05 a remote that fails to load gets a placeholder route and an (unavailable) entry in its usual position', async () => {
    const { runtime } = fakeRuntime({
      quality: qualityModule,
      planning: new Error('Failed to fetch /modules/planning/0.4.0/mf-manifest.json'),
      maintenance: maintenanceModule,
    });

    // The server lists the modules in boot order, and the menu orders them by their order.
    renderShellAt(
      '/plant-a/planning/board',
      await loadModules([maintenance, planning, quality], runtime),
    );

    expect(await screen.findByText('The Planning module could not be loaded.')).toBeDefined();
    const menu = screen.getByRole('navigation', { name: 'Modules' });
    expect(
      within(menu)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Quality', 'Planning (unavailable)', 'Maintenance']);
  });

  it('E02-S05 a remote whose ./module differs from its list entry gets a placeholder route and names the problem', async () => {
    const { runtime } = fakeRuntime({ quality: { ...qualityModule, version: '0.3.0' } });

    const loaded = await loadModules([quality], runtime);
    renderShellAt('/plant-a/quality', loaded);

    expect(loaded).toEqual([
      {
        listed: quality,
        module: null,
        problem: 'version is 0.3.0, expected 0.4.0 from the server entry',
      },
    ]);
    expect(await screen.findByText('The Quality module could not be loaded.')).toBeDefined();
  });

  it("E02-S05 a module's screen queries the gateway with the client for the plant in the URL", async () => {
    const { runtime } = fakeRuntime({ quality: qualityModule });
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response(JSON.stringify({ data: { ping: 'pong' } }), {
          headers: { 'content-type': 'application/graphql-response+json' },
        }),
    );

    renderShellAt('/plant-b/quality', await loadModules([quality], runtime), { fetch });

    expect(await screen.findByText('The gateway answered pong')).toBeDefined();
    expect(fetch).toHaveBeenCalledOnce();
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get('x-northmes-plant')).toBe('plant-b');
  });

  it('E02-S05 the shell requests the module list from apiPath(web, modules)', async () => {
    const fetch = vi.fn(
      async (_url: string) =>
        new Response(JSON.stringify({ northmes: '0.4.0', supergraph: null, modules: [planning] }), {
          headers: { 'content-type': 'application/json' },
        }),
    );

    expect(await fetchModuleList(fetch)).toEqual([planning]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/v1/web/modules');
  });
});
