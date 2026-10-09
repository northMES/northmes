// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApolloClient } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { createNorthmesClient, createShellRoutes, ShellProvider } from '@northmes/web-sdk';
import { createRouter, Outlet, type RouterHistory, useParams } from '@tanstack/react-router';
import { Menu } from './menu.tsx';
import type { ShellModule } from './modules.ts';

export interface ShellRouterOptions {
  /** The URL of the API, from config.json. Without one, the API is on the page's origin. */
  readonly apiUrl?: string;
  /** Replaces the browser history, for tests. */
  readonly history?: RouterHistory;
  /** Replaces the global fetch of each plant's Apollo client, for tests. */
  readonly fetch?: typeof globalThis.fetch;
}

/**
 * Creates the web's router, once at boot: each module's routes under /$plant. The $plant route
 * renders the menu, and ShellProvider and the Apollo client of the plant in the URL around the
 * screen.
 */
export function createShellRouter(
  modules: readonly ShellModule[],
  { apiUrl, history, fetch }: ShellRouterOptions = {},
) {
  // One client per plant for the router's life (ADR 0018). Switching plants and disposing the
  // client of the plant left behind come with the plant switcher.
  const clients = new Map<string, ApolloClient>();
  const clientFor = (plantId: string): ApolloClient => {
    const client = clients.get(plantId) ?? createNorthmesClient({ plantId, apiUrl, fetch });
    clients.set(plantId, client);
    return client;
  };
  const routeTree = createShellRoutes({
    modules: modules.map(({ module }) => module),
    plantComponent: () => <PlantLayout modules={modules} clientFor={clientFor} />,
  });
  return createRouter({ routeTree, history });
}

interface PlantLayoutProps {
  readonly modules: readonly ShellModule[];
  readonly clientFor: (plantId: string) => ApolloClient;
}

/** The $plant route's component: the menu, and the shell state and Apollo client of the plant. */
function PlantLayout({ modules, clientFor }: PlantLayoutProps) {
  const { plant } = useParams({ strict: false });
  return (
    <ApolloProvider client={clientFor(plant)}>
      <ShellProvider value={{ plantId: plant }}>
        <Menu modules={modules} />
        <main>
          <Outlet />
        </main>
      </ShellProvider>
    </ApolloProvider>
  );
}
