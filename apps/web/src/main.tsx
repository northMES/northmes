// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createAuthSession } from './auth/auth-session.ts';
import { bootWeb } from './boot/index.ts';
import { shellModules } from './modules.ts';
import { registerSharedModules } from './plugins/host-shared.ts';
import { loadPlugins } from './plugins/load-plugins.tsx';
import { createShellRouter } from './shell/index.ts';

const root = document.getElementById('root');
if (root === null) throw new Error('index.html has no element with the id root');

// The files under /shared/ read these, so plugins share the web build's React (ADR 0075).
registerSharedModules();

/**
 * Boots the web: reads config.json, opens the tab's auth session, loads the screens of the plugins
 * the API lists, and renders the router built from the modules' and the plugins' routes in place
 * of index.html's Loading NorthMES, or NorthMES could not start.
 */
void bootWeb(root, {
  fetch: (url) => fetch(url),
  origin: location.origin,
  reload: () => location.reload(),
  app: async ({ apiUrl }) => {
    // The session token lives in the tab's sessionStorage: it survives a reload and ends with the tab.
    const session = createAuthSession({ apiUrl, storage: sessionStorage });
    const plugins = await loadPlugins({
      apiUrl,
      token: () => session.token(),
      fetch: (url, init) => fetch(url, init),
      importModule: (url) => import(/* @vite-ignore */ url),
    });
    // The router is built once, so after sign-in a full page load runs this again with the session.
    const router = createShellRouter([...shellModules, ...plugins], {
      session,
      apiUrl,
      onSignedIn: (href) => location.assign(href),
    });
    return (
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>
    );
  },
});
