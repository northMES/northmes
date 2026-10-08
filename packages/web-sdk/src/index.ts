// SPDX-License-Identifier: MIT
// Every export is named: the package is a federation singleton, so it never uses export *.
export type { PlantRoute } from './routes.ts';
export {
  defineWebModule,
  validateWebModule,
  type WebModule,
  type WebModuleEntry,
} from './web-module.ts';
