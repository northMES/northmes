// SPDX-License-Identifier: AGPL-3.0-or-later
import { planningLinks } from '@northmes/planning-contracts';
import type { WebModule } from '@northmes/web-sdk';
import { planningModule } from './modules/planning/index.ts';

/** One link of a module's menu group. */
export interface MenuLink {
  readonly label: string;
  /** Builds the link for a plant, such as the entry planningLinks.board of a link manifest. */
  readonly link: (params: { readonly plant: string }) => { readonly href: string };
}

/** A module the web is built with, and its group in the menu. */
export interface ShellModule {
  readonly module: WebModule;
  /** The menu group's label, as in the web block of the module's manifest. */
  readonly label: string;
  /** The menu group's position, as in the web block of the module's manifest. */
  readonly order: number;
  /** The links of the module's menu group, in their order. */
  readonly links?: readonly MenuLink[];
}

/**
 * The modules the web is built with. Each module's web part lives in src/modules/<id> and is
 * imported here from its public api, index.ts.
 */
export const shellModules: readonly ShellModule[] = [
  {
    module: planningModule,
    label: 'Planning',
    order: 20,
    links: [{ label: 'Planning board', link: planningLinks.board }],
  },
];
