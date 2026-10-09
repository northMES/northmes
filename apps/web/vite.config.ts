// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig, type Plugin } from 'vite';

/** The API paths that the dev server forwards to the backend. */
const apiPaths = ['/graphql', '/api'];

/** One path that the dev server forwards. */
interface ProxiedPath {
  target: string;
  ws: true;
}

/**
 * The dev server's proxy: pnpm dev names the backend's origin in NORTHMES_API_ORIGIN, so the
 * browser reaches the API through the web's origin (ADR 0058). Each path forwards WebSockets too,
 * as /graphql carries subscriptions. The forwarded request keeps the browser's Origin, the web's
 * origin, which pnpm dev makes the server's NORTHMES_PUBLIC_ORIGIN: the API lets its own origin
 * through, and Better Auth trusts it.
 */
function devProxy(apiOrigin: string | undefined): Record<string, ProxiedPath> {
  if (!apiOrigin) return {};
  return Object.fromEntries(apiPaths.map((path) => [path, { target: apiOrigin, ws: true }]));
}

/** The classic script that index.html's head runs before the first paint (design shell-306, BO2). */
const themeBootPath = '/src/boot/theme-boot.js';

/**
 * Vite bundles module scripts only, so the build writes the theme script to assets/ under a name
 * with its content hash and points index.html's tag at it: the server serves files from /assets/
 * alone, and caches them for good. The dev server serves the source file as it is.
 */
function themeBoot(): Plugin {
  let root = '';
  let base = '/';
  let fileName = '';
  return {
    name: 'northmes:theme-boot',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      base = config.base;
    },
    buildStart() {
      const source = readFileSync(join(root, themeBootPath), 'utf8');
      const hash = createHash('sha256').update(source).digest('base64url').slice(0, 8);
      fileName = `assets/theme-boot-${hash}.js`;
      this.emitFile({ type: 'asset', fileName, source });
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replace(`src="${themeBootPath}"`, `src="${base}${fileName}"`),
    },
  };
}

/**
 * The web is one static app: the build writes index.html and its assets, and the host adds
 * config.json next to them when the API is on another origin.
 */
export default defineConfig(({ command }) => ({
  // Tailwind builds the one stylesheet, src/styles/app.css, which index.html links.
  plugins: [react(), tailwindcss(), themeBoot()],
  // The dev server resolves workspace packages to their source, as the tests do (ADR 0058).
  ...(command === 'serve' && {
    resolve: { conditions: ['@northmes/source', ...defaultClientConditions] },
    server: { proxy: devProxy(process.env.NORTHMES_API_ORIGIN) },
  }),
}));
