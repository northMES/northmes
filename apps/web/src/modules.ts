// SPDX-License-Identifier: AGPL-3.0-or-later
import type { WebModule } from '@northmes/web-sdk';
import { planningModule } from './modules/planning/index.ts';

/** A module the web is built with, and its entry in the menu. */
export interface ShellModule {
  readonly module: WebModule;
  /** The menu label, as in the web block of the module's manifest. */
  readonly label: string;
  /** The menu position, as in the web block of the module's manifest. */
  readonly order: number;
}

/**
 * The modules the web is built with. Each module's web part lives in src/modules/<id> and is
 * imported here from its public api, index.ts.
 */
export const shellModules: readonly ShellModule[] = [
  { module: planningModule, label: 'Planning', order: 20 },
];
