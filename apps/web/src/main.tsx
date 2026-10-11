// SPDX-License-Identifier: AGPL-3.0-or-later
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createAuthSession } from './auth/auth-session.ts';
import { bootWeb } from './boot/index.ts';
import { shellModules } from './modules.ts';
import { createShellRouter } from './shell/index.ts';

const root = document.getElementById('root');
if (root === null) throw new Error('index.html has no element with the id root');

/**
 * Boots the web: reads config.json, opens the tab's auth session and renders the router built from
 * the modules' routes in place of index.html's Loading NorthMES, or NorthMES could not start.
 */
void bootWeb(root, {
  fetch: (url) => fetch(url),
  origin: location.origin,
  reload: () => location.reload(),
  app: ({ apiUrl }) => {
    // The session token lives in the tab's sessionStorage: it survives a reload and ends with the tab.
    const session = createAuthSession({ apiUrl, storage: sessionStorage });
    return (
      <StrictMode>
        <RouterProvider router={createShellRouter(shellModules, { session, apiUrl })} />
      </StrictMode>
    );
  },
});
