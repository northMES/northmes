// SPDX-License-Identifier: MIT
// Every export is named: the package is a federation singleton, so it never uses export *.
export { createShellRoutes, type PlantRoute, type ShellRoutesOptions } from './routes.ts';
export {
  defineWebModule,
  validateWebModule,
  type WebModule,
  type WebModuleEntry,
} from './web-module.ts';
