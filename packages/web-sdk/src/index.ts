// SPDX-License-Identifier: MIT
// Every export is named: the package is a federation singleton, so it never uses export *.
export { type CreateNorthmesClientOptions, createNorthmesClient } from './apollo.ts';
export { createShellRoutes, type PlantRoute, type ShellRoutesOptions } from './routes.ts';
export { ShellProvider, type ShellState, useShell } from './shell-context.tsx';
export {
  defineWebModule,
  validateWebModule,
  type WebModule,
  type WebModuleEntry,
} from './web-module.ts';
