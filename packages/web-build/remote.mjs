// SPDX-License-Identifier: MIT
import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { noBundledSingletons, noRemoteCss } from './guards.mjs';
import { remoteShared } from './shared.mjs';

/**
 * @typedef {object} RemoteOptions
 * @property {string} id The module id from the module's manifest.
 * @property {string} version The module version from the module's manifest.
 * @property {string} [entry] The file whose default export is the remote's defineWebModule value.
 */

/**
 * The Vite config of a module's web remote (ADR 0019). The remote exposes one entry, ./module,
 * which is also the bundler input, because a remote has no index.html.
 *
 * @param {RemoteOptions} options
 * @returns {import('vite').UserConfigFnObject}
 */
export function defineRemoteConfig({ id, version, entry = './src/module.tsx' }) {
  return ({ command }) => ({
    // The server serves each remote's files at this path (ADR 0019).
    base: `/modules/${id}/${version}/`,
    plugins: [
      noBundledSingletons(),
      noRemoteCss(),
      react(),
      federation({
        // A remote name allows no hyphens, so production-start becomes productionStart (ADR 0003).
        name: id.replace(/-([a-z0-9])/g, (_, character) => character.toUpperCase()),
        filename: 'remoteEntry.js',
        manifest: true,
        exposes: { './module': entry },
        shared: remoteShared({ dev: command === 'serve' }),
        dts: false,
      }),
    ],
    build: { target: 'esnext', outDir: 'dist', rolldownOptions: { input: { module: entry } } },
  });
}
