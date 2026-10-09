// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApolloClient } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { createNorthmesClient, createShellRoutes, ShellProvider } from '@northmes/web-sdk';
import {
  createRouter,
  Outlet,
  type RouterHistory,
  useParams,
  useRouterState,
} from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
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

/**
 * Moves focus to the page's h1 after each path change, one frame after the new route rendered, and
 * to main when the page has no h1 that takes focus (ADR 0021). A change of the search alone leaves focus where it
 * is, so sorting, searching and paging keep focus on their control.
 */
function useFocusPageHeading() {
  const main = useRef<HTMLElement>(null);
  const pathname = useRouterState({ select: (state) => state.resolvedLocation?.pathname });
  useEffect(() => {
    if (pathname === undefined) return;
    const frame = requestAnimationFrame(() => {
      // An h1 without a tabindex, such as the board stub's, cannot take focus, so main does.
      const heading = main.current?.querySelector<HTMLElement>('h1[tabindex]');
      (heading ?? main.current)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  return main;
}

/** The $plant route's component: the menu, and the shell state and Apollo client of the plant. */
function PlantLayout({ modules, clientFor }: PlantLayoutProps) {
  const { plant } = useParams({ strict: false });
  const main = useFocusPageHeading();
  return (
    <ApolloProvider client={clientFor(plant)}>
      <ShellProvider value={{ plantId: plant }}>
        <Menu modules={modules} plant={plant} />
        <main ref={main} tabIndex={-1}>
          <Outlet />
        </main>
      </ShellProvider>
    </ApolloProvider>
  );
}
