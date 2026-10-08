// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineWebModule, useShell } from '@northmes/web-sdk';
import { createMemoryHistory, createRoute, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
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

/**
 * A federation runtime that stands in for @module-federation/runtime. The ./module entry of each
 * registered remote exports the value that exposed holds under the remote's name as its default.
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
      return { default: exposed[name] } as T;
    },
  };
  return { runtime, registered };
}

/** Renders the shell's router for the modules at path. */
function renderShellAt(path: string, modules: Parameters<typeof createShellRouter>[0]) {
  const router = createShellRouter(modules, {
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
