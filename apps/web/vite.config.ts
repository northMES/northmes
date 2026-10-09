// SPDX-License-Identifier: AGPL-3.0-or-later
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';

/** The API paths that the dev server forwards to the backend. */
const apiPaths = ['/graphql', '/api'];

/**
 * The dev server's proxy: pnpm dev names the backend's origin in NORTHMES_API_ORIGIN, so the
 * browser reaches the API through the web's origin (ADR 0058). Each path forwards WebSockets too,
 * as /graphql carries subscriptions.
 */
function devProxy(apiOrigin: string | undefined): Record<string, { target: string; ws: true }> {
  if (!apiOrigin) return {};
  return Object.fromEntries(apiPaths.map((path) => [path, { target: apiOrigin, ws: true }]));
}

/**
 * The web is one static app: the build writes index.html and its assets, and the host adds
 * config.json next to them when the API is on another origin.
 */
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // The dev server resolves workspace packages to their source, as the tests do (ADR 0058).
  ...(command === 'serve' && {
    resolve: { conditions: ['@northmes/source', ...defaultClientConditions] },
    server: { proxy: devProxy(process.env.NORTHMES_API_ORIGIN) },
  }),
}));
