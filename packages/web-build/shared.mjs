// SPDX-License-Identifier: MIT
// The one list of federation singletons (ADR 0019). The shell provides exactly these through
// registerShared, and every remote consumes exactly these with import: false, so a remote never
// bundles a copy. Each subpath is its own share key: ApolloProvider's context lives in
// @apollo/client/react, and a remote that imports a subpath outside the list gets a private copy.
// @northmes/ui joins the list together with its package.
const SINGLETONS = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  '@tanstack/react-router',
  '@apollo/client',
  '@apollo/client/react',
  '@northmes/web-sdk',
];

/**
 * The share key of each singleton. In dev, React's JSX transform imports react/jsx-dev-runtime,
 * which is then a singleton too.
 *
 * @param {{ dev?: boolean }} [options]
 * @returns {string[]}
 */
export function singletons({ dev = false } = {}) {
  return dev ? [...SINGLETONS, 'react/jsx-dev-runtime'] : [...SINGLETONS];
}

/**
 * The shared config of a remote. A remote requires no version and bundles no fallback, so it
 * fails loudly when the shell does not provide a share.
 *
 * @param {{ dev?: boolean }} [options]
 * @returns {Record<string, { singleton: true, import: false, requiredVersion: false }>}
 */
export function remoteShared({ dev = false } = {}) {
  return Object.fromEntries(
    singletons({ dev }).map((key) => [
      key,
      { singleton: true, import: false, requiredVersion: false },
    ]),
  );
}
