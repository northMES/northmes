// SPDX-License-Identifier: MIT

/**
 * Packages the NorthMES host provides to every module and plugin at run time.
 * A plugin build marks them external and never bundles them, so one copy exists per process.
 * This is the backend twin of the web singleton list in @northmes/web-build.
 */
export const HOST_PROVIDED = [
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

export function isHostProvided(specifier: string): boolean {
  return HOST_PROVIDED.some((name) => specifier === name);
}
