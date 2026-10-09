// SPDX-License-Identifier: AGPL-3.0-or-later
import { coreLinks } from '@northmes/core-contracts';
import { planningLinks } from '@northmes/planning-contracts';
import type { WebModule } from '@northmes/web-sdk';
import { coreModule } from './modules/core/index.ts';
import { planningModule } from './modules/planning/index.ts';
import type { NavIconName } from './ui/lib/nav-icon-names.ts';

/** One entry of a module's sidebar group. */
export interface MenuLink {
  readonly label: string;
  /** The entry's icon in the sidebar and the rail, by its lucide name (ADR 0067). */
  readonly icon: NavIconName;
  /** Builds the link for a plant, such as the entry planningLinks.board of a link manifest. */
  readonly link: (params: { readonly plant: string }) => { readonly href: string };
  /**
   * The permission the entry's page reads with: the sidebar shows the entry only to a user who
   * holds it at the plant, as D2 draws Administration only for admins.
   */
  readonly permission?: string;
}

/** A module the web is built with, and its group in the sidebar. */
export interface ShellModule {
  readonly module: WebModule;
  /** The sidebar group's label; the backend module carries no manifest (ADR 0070). */
  readonly label: string;
  /** The sidebar group's position among the modules' groups. */
  readonly order: number;
  /** The entries of the module's sidebar group, in their order. */
  readonly links?: readonly MenuLink[];
  /** The module's entries in Administration, the sidebar's last group (D2, C7). */
  readonly adminLinks?: readonly MenuLink[];
}

/**
 * The modules the web is built with. Each module's web part lives in src/modules/<id> and is
 * imported here from its public api, index.ts.
 */
export const shellModules: readonly ShellModule[] = [
  {
    module: coreModule,
    label: 'Core',
    order: 10,
    links: [{ label: 'Articles', icon: 'Package', link: coreLinks.articles }],
    adminLinks: [
      { label: 'Users', icon: 'Users', link: coreLinks.users, permission: 'core.user:read' },
      { label: 'Roles', icon: 'Shield', link: coreLinks.roles, permission: 'core.role:read' },
    ],
  },
  {
    module: planningModule,
    label: 'Planning',
    order: 20,
    links: [{ label: 'Planning board', icon: 'ChartGantt', link: planningLinks.board }],
  },
];
