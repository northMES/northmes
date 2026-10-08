// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { singletons } from '@northmes/web-build';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';

/** The package behind a share key: react for react/jsx-runtime, @apollo/client for its /react. */
function packageOf(key: string): string {
  return key
    .split('/')
    .slice(0, key.startsWith('@') ? 2 : 1)
    .join('/');
}

/** The version of the package that the shell bundles for a share key. */
function versionOf(key: string): string {
  const manifest = new URL(`./node_modules/${packageOf(key)}/package.json`, import.meta.url);
  return (JSON.parse(readFileSync(manifest, 'utf8')) as { version: string }).version;
}

/**
 * The dev server's proxy: pnpm dev names the origin for each path prefix in NORTHMES_DEV_PROXY, in
 * the order the prefixes are tried, so the browser reaches the server and each remote's dev server
 * through the shell's origin (ADR 0058). Each entry forwards WebSockets too: /graphql carries
 * subscriptions, and each remote's Vite client connects below its own path.
 */
function devProxy(json = '{}'): Record<string, { target: string; ws: true }> {
  const origins = JSON.parse(json) as Record<string, string>;
  return Object.fromEntries(
    Object.entries(origins).map(([path, target]) => [path, { target, ws: true }]),
  );
}

/**
 * The shell is a pure @module-federation/runtime host and runs no federation build plugin (ADR
 * 0019). The build hands main.tsx the version of each shared package, which shareSingletons
 * registers.
 */
export default defineConfig(({ command }) => ({
  plugins: [react()],
  define: {
    __SHARED_VERSIONS__: JSON.stringify(
      Object.fromEntries(singletons({ dev: true }).map((key) => [key, versionOf(key)])),
    ),
  },
  // The dev server resolves workspace packages to their source, as the tests do (ADR 0058).
  ...(command === 'serve' && {
    resolve: { conditions: ['@northmes/source', ...defaultClientConditions] },
    server: { proxy: devProxy(process.env.NORTHMES_DEV_PROXY) },
  }),
}));
