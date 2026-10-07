// The single list of federation singletons. The shell provides exactly these (registerShared),
// and every remote consumes exactly these with import: false, so a remote never bundles a copy.
// Subpaths are separate share keys: "@apollo/client/react" holds ApolloProvider's context.
export const SINGLETONS = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "@tanstack/react-router",
  "@apollo/client",
  "@apollo/client/react",
  "@northmes/web-sdk",
  "@northmes/ui",
];

export function remoteShared({ dev = false } = {}) {
  const keys = dev ? [...SINGLETONS, "react/jsx-dev-runtime"] : SINGLETONS;
  return Object.fromEntries(
    keys.map((key) => [key, { singleton: true, import: false, requiredVersion: false }]),
  );
}
