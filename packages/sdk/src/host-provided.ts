// SPDX-License-Identifier: MIT

/**
 * Packages the NorthMES host provides to every module and plugin at run time.
 * A plugin build marks them external and never bundles them, so one copy exists per process.
 * This is the backend twin of the web singleton list in @northmes/web-build.
 * An entry that ends in `/*` stands for every package in that scope.
 */
export const HOST_PROVIDED = [
  '@nestjs/*',
  '@nestjs/common',
  '@nestjs/core',
  '@nestjs/graphql',
  '@apollo/subgraph',
  '@northmes/sdk',
  'graphql',
  'reflect-metadata',
  'rxjs',
  'zod',
  'temporal-polyfill',
] as const;

/** True for a host-provided package name and for any of its subpaths, such as `graphql/language`. */
export function isHostProvided(specifier: string): boolean {
  return HOST_PROVIDED.some((name) =>
    name.endsWith('/*')
      ? specifier.startsWith(name.slice(0, -1))
      : specifier === name || specifier.startsWith(`${name}/`),
  );
}
