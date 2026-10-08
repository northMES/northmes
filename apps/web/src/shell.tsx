// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApolloClient } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { createNorthmesClient, createShellRoutes, ShellProvider } from '@northmes/web-sdk';
import { createRouter, Outlet, type RouterHistory, useParams } from '@tanstack/react-router';
import type { LoadedModule } from './federation.ts';

export interface ShellRouterOptions {
  /** Replaces the browser history, for tests. */
  readonly history?: RouterHistory;
  /** Replaces the global fetch of each plant's Apollo client, for tests. */
  readonly fetch?: typeof globalThis.fetch;
}

/**
 * Creates the shell's router, once at boot (ADR 0019): each loaded module's routes under /$plant.
 * The $plant route renders ShellProvider and the Apollo client of the plant in the URL around the
 * module's screen.
 */
export function createShellRouter(
  modules: readonly LoadedModule[],
  { history, fetch }: ShellRouterOptions = {},
) {
  // One client per plant for the router's life (ADR 0018). Switching plants and disposing the
  // client of the plant left behind come with the plant switcher.
  const clients = new Map<string, ApolloClient>();
  const clientFor = (plantId: string): ApolloClient => {
    const client = clients.get(plantId) ?? createNorthmesClient({ plantId, fetch });
    clients.set(plantId, client);
    return client;
  };
  const routeTree = createShellRoutes({
    modules: modules.map(({ module }) => module),
    plantComponent: () => <PlantLayout clientFor={clientFor} />,
  });
  return createRouter({ routeTree, history });
}

/** The $plant route's component: the shell state and Apollo client of the plant in the URL. */
function PlantLayout({ clientFor }: { clientFor: (plantId: string) => ApolloClient }) {
  const { plant } = useParams({ strict: false });
  return (
    <ApolloProvider client={clientFor(plant)}>
      <ShellProvider value={{ plantId: plant }}>
        <Outlet />
      </ShellProvider>
    </ApolloProvider>
  );
}
