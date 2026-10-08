// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApolloClient } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import {
  createNorthmesClient,
  createShellRoutes,
  ShellProvider,
  type WebModule,
} from '@northmes/web-sdk';
import {
  createRoute,
  createRouter,
  Outlet,
  type RouterHistory,
  useParams,
} from '@tanstack/react-router';
import type { ListedModule, LoadedModule } from './federation.ts';
import { Menu } from './menu.tsx';

export interface ShellRouterOptions {
  /** Replaces the browser history, for tests. */
  readonly history?: RouterHistory;
  /** Replaces the global fetch of each plant's Apollo client, for tests. */
  readonly fetch?: typeof globalThis.fetch;
}

/**
 * Creates the shell's router, once at boot (ADR 0019): each loaded module's routes under /$plant,
 * and a placeholder route for each module whose remote failed to load. The $plant route renders
 * the menu, and ShellProvider and the Apollo client of the plant in the URL around the screen.
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
    modules: modules.map(({ listed, module }) => module ?? placeholderModule(listed)),
    plantComponent: () => <PlantLayout modules={modules} clientFor={clientFor} />,
  });
  return createRouter({ routeTree, history });
}

/**
 * The routes of a module whose remote failed to load: every path under /$plant/<id> shows that the
 * module is unavailable.
 */
function placeholderModule({ id, version, label }: ListedModule): WebModule {
  return {
    id,
    version,
    routes: (plantRoute) => {
      const moduleRoute = createRoute({
        getParentRoute: () => plantRoute,
        path: id,
        component: () => <p>The {label} module could not be loaded.</p>,
      });
      return moduleRoute.addChildren([
        createRoute({ getParentRoute: () => moduleRoute, path: '$' }),
      ]);
    },
  };
}

interface PlantLayoutProps {
  readonly modules: readonly LoadedModule[];
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
