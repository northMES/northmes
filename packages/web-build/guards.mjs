// SPDX-License-Identifier: MIT
// Vite plugins that fail a remote's build when it breaks a rule of ADR 0019.
import { singletons } from './shared.mjs';

/**
 * The package a share key or a path inside node_modules belongs to: @apollo/client/react belongs
 * to @apollo/client.
 *
 * @param {string} key
 */
function packageOfKey(key) {
  const segments = key.split('/');
  return key.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
}

/**
 * The installed package a module id lies in, with the file's path from node_modules, or
 * undefined for a file outside node_modules.
 *
 * @param {string} moduleId
 */
function installedPackageOf(moduleId) {
  const path = moduleId.replaceAll('\\', '/');
  const index = path.lastIndexOf('/node_modules/');
  if (index === -1) {
    return undefined;
  }
  const inPackage = path.slice(index + '/node_modules/'.length);
  return { name: packageOfKey(inPackage), file: inPackage };
}

/**
 * Fails the build when a chunk holds code from a package the shell shares as a singleton, for
 * example through a subpath outside the share keys, such as @apollo/client/cache. That code would
 * run as a second copy beside the shell's, with its own React context or Apollo cache.
 *
 * @returns {import('vite').Plugin}
 */
export function noBundledSingletons() {
  const forbidden = new Set(singletons().map(packageOfKey));
  return {
    name: 'northmes:no-bundled-singletons',
    apply: 'build',
    generateBundle(_options, bundle) {
      /** @type {Map<string, string>} */
      const offenders = new Map();
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') {
          continue;
        }
        for (const moduleId of chunk.moduleIds) {
          const installed = installedPackageOf(moduleId);
          if (installed && forbidden.has(installed.name) && !offenders.has(installed.name)) {
            offenders.set(installed.name, `${installed.file} in ${chunk.fileName}`);
          }
        }
      }
      if (offenders.size > 0) {
        const names = [...offenders.keys()];
        const details = [...offenders].map(([name, where]) => `  ${name}: ${where}`);
        this.error(
          [
            `this remote bundles ${names.join(', ')}. The shell provides each singleton package ` +
              'once (ADR 0019), and a remote reaches one only through a share key in shared.mjs ' +
              'of @northmes/web-build:',
            ...details,
          ].join('\n'),
        );
      }
    },
  };
}
