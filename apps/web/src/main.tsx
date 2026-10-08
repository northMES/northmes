// SPDX-License-Identifier: AGPL-3.0-or-later
import { createInstance } from '@module-federation/runtime';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { fetchModuleList, loadModules, shareSingletons } from './federation.ts';
import { createShellRouter } from './shell.tsx';

/**
 * Boots the shell (ADR 0019): shares its singletons with the federation runtime, loads the remotes
 * of the modules the server lists and renders the router built from their routes.
 */
async function boot(root: HTMLElement): Promise<void> {
  const runtime = createInstance({ name: 'northmesShell', remotes: [] });
  shareSingletons(runtime, { dev: import.meta.env.DEV, versions: __SHARED_VERSIONS__ });
  const modules = await loadModules(await fetchModuleList((url) => fetch(url)), runtime);
  for (const loaded of modules) {
    if (loaded.module === null) {
      console.error(`NorthMES could not load the ${loaded.listed.id} module: ${loaded.problem}`);
    }
  }
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={createShellRouter(modules)} />
    </StrictMode>,
  );
}

const root = document.getElementById('root');
if (root === null) throw new Error('index.html has no element with the id root');
boot(root).catch((error: unknown) => {
  root.textContent = `NorthMES failed to start: ${error instanceof Error ? error.message : String(error)}`;
});
