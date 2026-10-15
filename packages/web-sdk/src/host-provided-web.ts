// SPDX-License-Identifier: MIT

/**
 * The specifiers the web build shares with plugin screens through its import map (ADR 0075). A
 * plugin's web build leaves them as imports, so the page holds one React, one router and one
 * Apollo client. Only these exact specifiers are shared: a subpath such as react-dom/client is not,
 * and a plugin that imports it fails to build. @northmes/ui joins the list once that MIT package
 * exists.
 */
export const HOST_PROVIDED_WEB = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  '@tanstack/react-router',
  '@apollo/client',
  '@apollo/client/react',
  '@northmes/web-sdk',
] as const;

/** One of the shared web specifiers. */
export type HostProvidedWeb = (typeof HOST_PROVIDED_WEB)[number];

/** True for a shared web specifier, and false for any other, its subpaths included. */
export function isHostProvidedWeb(specifier: string): specifier is HostProvidedWeb {
  return (HOST_PROVIDED_WEB as readonly string[]).includes(specifier);
}
