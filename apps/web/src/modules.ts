// SPDX-License-Identifier: AGPL-3.0-or-later
import { coreLinks } from '@northmes/core-contracts';
import { planningLinks } from '@northmes/planning-contracts';
import type { WebModule } from '@northmes/web-sdk';
import { coreModule } from './modules/core/index.ts';
import { planningModule } from './modules/planning/index.ts';
import type { NavIconName } from './ui/lib/nav-icon-names.ts';

/** One entry of a module's sidebar group, or of the plant settings navigation. */
export interface MenuLink {
  readonly label: string;
  /** The entry's icon in the sidebar and the rail, by its lucide name (ADR 0067). */
  readonly icon: NavIconName;
  /** Builds the link for a plant, such as the entry planningLinks.board of a link manifest. */
  readonly link: (params: { readonly plant: string }) => { readonly href: string };
  /**
   * The permission the entry's page reads with: the shell shows the entry only to a user who holds
   * it at the plant.
   */
  readonly permission?: string;
  /**
   * settings puts the entry in the plant settings navigation instead of the main sidebar, and the
   * shell draws the settings layout around its page (ADR 0066).
   */
  readonly area?: 'settings';
}

/** One entry of the company settings navigation, a page under /settings/$companyId (ADR 0066). */
export interface SettingsLink {
  readonly label: string;
  /** The entry's icon, by its lucide name (ADR 0067). */
  readonly icon: NavIconName;
  /** Builds the link for a company, such as the entry coreLinks.settings.users. */
  readonly link: (params: { readonly companyId: string }) => { readonly href: string };
  /** The permission the page reads with: the entry shows only to a user who holds it at the company. */
  readonly permission?: string;
}

/** A module the web is built with, its group in the sidebar and its company settings entries. */
export interface ShellModule {
  readonly module: WebModule;
  /** The sidebar group's label; the backend module carries no manifest (ADR 0070). */
  readonly label: string;
  /** The sidebar group's position among the modules' groups. */
  readonly order: number;
  /** The entries of the module's sidebar group and of the plant settings navigation, in order. */
  readonly links?: readonly MenuLink[];
  /** The module's entries in the company settings navigation, in their order. */
  readonly settingsLinks?: readonly SettingsLink[];
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
    links: [
      { label: 'Articles', icon: 'Package', link: coreLinks.articles },
      {
        label: 'People',
        icon: 'Users',
        link: coreLinks.people,
        permission: 'core.user:read',
        area: 'settings',
      },
    ],
    // General and Plants come first once they are built (#419).
    settingsLinks: [
      {
        label: 'Users',
        icon: 'Users',
        link: coreLinks.settings.users,
        permission: 'core.user:read',
      },
      {
        label: 'Roles',
        icon: 'Shield',
        link: coreLinks.settings.roles,
        permission: 'core.role:read',
      },
    ],
  },
  {
    module: planningModule,
    label: 'Planning',
    order: 20,
    links: [{ label: 'Planning board', icon: 'ChartGantt', link: planningLinks.board }],
  },
];
