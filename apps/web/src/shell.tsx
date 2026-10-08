// SPDX-License-Identifier: AGPL-3.0-or-later
import { createShellRoutes, ShellProvider } from '@northmes/web-sdk';
import { createRouter, Outlet, type RouterHistory, useParams } from '@tanstack/react-router';
import type { LoadedModule } from './federation.ts';

export interface ShellRouterOptions {
  /** Replaces the browser history, for tests. */
  readonly history?: RouterHistory;
}

/**
 * Creates the shell's router, once at boot (ADR 0019): each loaded module's routes under /$plant,
 * whose route renders ShellProvider for the plant in the URL.
 */
export function createShellRouter(
  modules: readonly LoadedModule[],
  { history }: ShellRouterOptions = {},
) {
  const routeTree = createShellRoutes({
    modules: modules.map(({ module }) => module),
    plantComponent: PlantLayout,
  });
  return createRouter({ routeTree, history });
}

/** The $plant route's component: the shell state of the plant in the URL around the screen. */
function PlantLayout() {
  const { plant } = useParams({ strict: false });
  return (
    <ShellProvider value={{ plantId: plant }}>
      <Outlet />
    </ShellProvider>
  );
}
