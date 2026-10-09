// SPDX-License-Identifier: AGPL-3.0-or-later
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadWebConfig } from './config.ts';
import { shellModules } from './modules.ts';
import { createShellRouter } from './shell/index.ts';
import { applyStoredTheme } from './ui/lib/theme.ts';
import './styles/app.css';

/** Boots the web: reads config.json and renders the router built from the modules' routes. */
async function boot(root: HTMLElement): Promise<void> {
  // The theme the viewer chose before applies before the first paint.
  applyStoredTheme();
  const { apiUrl } = await loadWebConfig((url) => fetch(url), location.origin);
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={createShellRouter(shellModules, { apiUrl })} />
    </StrictMode>,
  );
}

const root = document.getElementById('root');
if (root === null) throw new Error('index.html has no element with the id root');
boot(root).catch((error: unknown) => {
  root.textContent = `NorthMES failed to start: ${error instanceof Error ? error.message : String(error)}`;
});
