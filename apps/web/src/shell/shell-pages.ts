// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreModuleId, settingsHref, settingsPath } from '@northmes/web-sdk';
import { useRouterState } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import type { MenuGroup, MenuItem, MenuLink, SettingsLink, ShellModule } from '../modules.ts';
import type { ShellCompany } from './companies.graphql.ts';
import type { SettingsEntry, SettingsGroup } from './shell-settings-nav.tsx';

/** The id of main, which the skip link moves focus to outside settings. */
export const mainId = 'main';

/** The id of the sidebar, which the sidebar trigger controls. */
export const sidebarId = 'shell-sidebar';

/**
 * Moves focus to the page's h1 after each path change, one frame after the new route rendered, and
 * to main when the page has no h1 that takes focus (ADR 0021). The first load moves no focus, so
 * the first Tab reaches the skip link (D2, Focus rules). A change of the search alone leaves focus
 * where it is, so sorting, searching and paging keep focus on their control.
 */
export function useFocusPageHeading() {
  const main = useRef<HTMLElement>(null);
  const shownPath = useRef<string | undefined>(undefined);
  const pathname = useRouterState({ select: (state) => state.resolvedLocation?.pathname });
  useEffect(() => {
    if (pathname === undefined) return;
    const left = shownPath.current;
    shownPath.current = pathname;
    if (left === undefined || left === pathname) return;
    const frame = requestAnimationFrame(() => {
      // An h1 without a tabindex cannot take focus, so main does.
      const heading = main.current?.querySelector<HTMLElement>('h1[tabindex]');
      (heading ?? main.current)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  return main;
}

/** Whether an href is a plant's root, one segment: the dashboard's page (ADR 0078). */
function isPlantRoot(href: string): boolean {
  return /^\/[^/]+$/.test(href);
}

/**
 * How an entry relates to the page on screen: its own page ("page"), a page under it ("true", as
 * an article under Articles or a user's page under Users), or neither. Every page of a plant lies
 * under its root, so the entry there, the dashboard, is current on its own page alone (#873).
 */
export function currentOf(href: string, pathname: string): 'page' | 'true' | undefined {
  // The router keeps a trailing slash the user typed, as in /plant-a/, which names the same page.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (href === path) return 'page';
  if (isPlantRoot(href)) return undefined;
  return path.startsWith(`${href}/`) ? 'true' : undefined;
}

/** Whether an entry shows to a user with these permissions: one without a permission always does. */
export function shownTo(permissions: ReadonlySet<string> | undefined) {
  return ({ permission }: Pick<MenuLink | SettingsLink, 'permission'>) =>
    permission === undefined || (permissions?.has(permission) ?? false);
}

/** Whether an item of a module's links is a nested group of entries. */
export function isMenuGroup(item: MenuItem): item is MenuGroup {
  return 'links' in item;
}

/** Every entry of a module, those of its nested groups in their place. */
export function menuLinks(module: ShellModule): readonly MenuLink[] {
  return (module.links ?? []).flatMap((item): readonly MenuLink[] =>
    isMenuGroup(item) ? item.links : [item],
  );
}

/** The items of the main sidebar of a module: its entries and nested groups outside settings. */
export function sidebarItems(module: ShellModule): readonly MenuItem[] {
  return (module.links ?? []).filter((item) => isMenuGroup(item) || item.area !== 'settings');
}

/**
 * The entries of the main sidebar of a module: those outside the plant settings navigation, those
 * of its nested groups in their place.
 */
export function sidebarLinks(module: ShellModule): readonly MenuLink[] {
  return menuLinks(module).filter(({ area }) => area !== 'settings');
}

/** The entries of the plant settings navigation of a module (ADR 0066). */
export function plantSettingsLinks(module: ShellModule): readonly MenuLink[] {
  return menuLinks(module).filter(({ area }) => area === 'settings');
}

/**
 * The nested group of a module that holds the page on screen: the group with the entry whose page
 * it is, or the nearest one above it, as Master data for an article.
 */
export function groupAt(
  module: ShellModule | undefined,
  plant: string,
  pathname: string,
): MenuGroup | undefined {
  if (module === undefined) return undefined;
  return sidebarItems(module)
    .filter(isMenuGroup)
    .find(({ links }) =>
      links.some(({ link }) => currentOf(link({ plant }).href, pathname) !== undefined),
    );
}

/** The href of the first sidebar entry of a module, at a plant. */
export function firstHref(module: ShellModule | undefined, plant: string): string | undefined {
  const [first] = module === undefined ? [] : sidebarLinks(module);
  return first?.link({ plant }).href;
}

/** The href of a plant's first page, the first entry of the sidebar: core's Dashboard (ADR 0078). */
export function plantHome(modules: readonly ShellModule[], plant: string): string | undefined {
  return firstHref(
    modules.find((module) => sidebarLinks(module).length > 0),
    plant,
  );
}

/**
 * Where a link to a plant from a page without a plant leads: the plant's first page, or the plant's
 * root when no module has a sidebar entry.
 */
export function plantLinkHref(modules: readonly ShellModule[], plant: string): string {
  return plantHome(modules, plant) ?? `/${encodeURIComponent(plant)}`;
}

/**
 * The module a path under a plant lies in: the module other than core whose id is the path's first
 * segment under the plant, or under the plant's settings, or else core, whose pages sit at the
 * plant root and the settings root (ADR 0074, #876), when it is loaded.
 */
export function moduleOfPath(
  modules: readonly ShellModule[],
  pathname: string,
): ShellModule | undefined {
  const segments = pathname.split('/');
  const segment = segments[2] === settingsPath ? segments[3] : segments[2];
  return (
    modules.find(({ module }) => module.id !== coreModuleId && module.id === segment) ??
    modules.find(({ module }) => module.id === coreModuleId)
  );
}

/** Whether a module is core, which has no crumb of its own and no page-not-found of its own. */
export function isCore(module: ShellModule | undefined): boolean {
  return module?.module.id === coreModuleId;
}

/** The company and the plant of the user's companies that a slug names. */
export function plantOf(companies: readonly ShellCompany[], slug: string) {
  for (const company of companies) {
    const plant = company.plants.find((each) => each.slug === slug);
    if (plant !== undefined) return { company, plant };
  }
  return undefined;
}

/**
 * The company settings entries of the modules that a user with these permissions may open, under a
 * plant of the company: core's first, then the other modules' (ADR 0066, #876). An entry shows to a
 * holder of its permission at the company, and an entry whose page also reads at the plant to a
 * holder of it at the plant too (ADR 0091).
 */
export function companySettingsEntries(
  modules: readonly ShellModule[],
  {
    company,
    plant: atPlant,
  }: { readonly company?: ReadonlySet<string>; readonly plant?: ReadonlySet<string> },
  plant: string,
) {
  const shown = (entry: SettingsLink) =>
    shownTo(company)(entry) || (entry.readsAtPlant === true && shownTo(atPlant)(entry));
  return modules.map(({ module, settingsLinks = [] }) => ({
    moduleId: module.id,
    entries: settingsLinks
      .filter(shown)
      .map(({ label, icon, link }) => ({ label, icon, href: link({ plant }).href })),
  }));
}

/**
 * Where a page of the company's settings reads (ADR 0066, ADR 0091): at the company, with the
 * company's id and no plant, unless its entry also reads at the plant and the user lacks the
 * entry's permission at the company; then at the plant, with x-northmes-plant. Undefined until the
 * company's permissions are known, for a page that waits for them.
 */
export function companyPageReadsAt(
  entry: SettingsLink,
  companyPermissions: ReadonlySet<string> | undefined,
): 'company' | 'plant' | undefined {
  if (entry.readsAtPlant !== true || entry.permission === undefined) return 'company';
  if (companyPermissions === undefined) return undefined;
  return companyPermissions.has(entry.permission) ? 'company' : 'plant';
}

/**
 * Whether a page is a plant's settings page: one under /<plant>/settings, the company's pages
 * included (ADR 0066, #876).
 */
export function isSettingsPage(plant: string, pathname: string): boolean {
  return currentOf(settingsHref(plant), pathname) !== undefined;
}

/** Whether a page is the settings landing itself, /<plant>/settings. */
export function isSettingsLanding(plant: string, pathname: string): boolean {
  return currentOf(settingsHref(plant), pathname) === 'page';
}

/** Go to Settings, the settings landing, from a page under it, or nothing on the landing itself. */
export function settingsWayOut(plant: string, pathname: string): WayOut | undefined {
  return isSettingsLanding(plant, pathname)
    ? undefined
    : { label: 'Go to Settings', href: settingsHref(plant) };
}

/**
 * The company settings entry of a page under a plant, such as Users for a user's page: the entry
 * whose page it is, or the nearest one above it, or undefined for a page that is none of the
 * company's (#876).
 */
export function companySettingsEntryAt(
  modules: readonly ShellModule[],
  plant: string,
  pathname: string,
): SettingsLink | undefined {
  return modules
    .flatMap(({ settingsLinks = [] }) => settingsLinks)
    .filter(({ link }) => currentOf(link({ plant }).href, pathname) !== undefined)
    .sort((a, b) => b.link({ plant }).href.length - a.link({ plant }).href.length)[0];
}

/**
 * Whether a page is one of the company's settings pages under a plant, such as Users: its entry
 * is a company settings entry, or the nearest one above it is (#876).
 */
export function isCompanySettingsPage(
  modules: readonly ShellModule[],
  plant: string,
  pathname: string,
): boolean {
  return companySettingsEntryAt(modules, plant, pathname) !== undefined;
}

/** An entry of a navigation as a page: its label and its href. */
export interface PageEntry {
  readonly label: string;
  readonly href: string;
}

/** Where a page lives: a plant, by its slug, or no plant. */
export interface PagePlace {
  readonly plant?: string;
}

/**
 * Every entry of the modules at a place: the sidebar, plant settings and the company's settings
 * pages under the plant.
 */
function entriesAt(modules: readonly ShellModule[], { plant }: PagePlace): PageEntry[] {
  if (plant === undefined) return [];
  return modules.flatMap((module) => [
    ...menuLinks(module).map(({ label, link }) => ({ label, href: link({ plant }).href })),
    ...(module.settingsLinks ?? []).map(({ label, link }) => ({
      label,
      href: link({ plant }).href,
    })),
  ]);
}

/**
 * The entry of the page on screen: the one whose page it is, or the nearest one above it, as
 * Articles for an article. The entry at the plant root is above no page (currentOf), so a page
 * under the root with no entry of its own, such as All pages, has none. Its label stands in for the
 * route title where the route itself cannot give one, such as on its error panel.
 */
export function entryAt(
  modules: readonly ShellModule[],
  place: PagePlace,
  pathname: string,
): PageEntry | undefined {
  return entriesAt(modules, place)
    .filter(({ href }) => currentOf(href, pathname) !== undefined)
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/** The way out of a page that failed: the link's text, such as Go to Tools, and its href. */
export interface WayOut {
  readonly label: string;
  readonly href: string;
}

/** The way out to an entry, unless the entry is the page itself. */
function goTo(entry: MenuLink | undefined, plant: string, pathname: string): WayOut | undefined {
  if (entry === undefined) return undefined;
  const href = entry.link({ plant }).href;
  return href === pathname ? undefined : { label: `Go to ${entry.label}`, href };
}

/**
 * The way out of a page that failed (D2 ST6, shell-306 SE): Go to the first sidebar entry of its
 * module, or See all pages when the page is that entry or the module has none (shell-306 LS3). A
 * page at the plant root is core's (ADR 0074). Outside a module, Go to the plant's first page.
 * Under the plant's settings, Go to Settings, the landing that leads on to the first settings page
 * the user may open (#876). Never the page itself.
 */
export function wayOutOf(
  modules: readonly ShellModule[],
  { plant }: PagePlace,
  pathname: string,
): WayOut | undefined {
  if (plant === undefined) return undefined;
  if (isSettingsPage(plant, pathname)) return settingsWayOut(plant, pathname);
  const module = moduleOfPath(modules, pathname);
  if (module === undefined) return goTo(modules.flatMap(sidebarLinks)[0], plant, pathname);
  return (
    goTo(sidebarLinks(module)[0], plant, pathname) ?? {
      label: 'See all pages',
      href: allPagesHref(plant),
    }
  );
}

/** The path segment of the All pages index under a plant, the shell's own route. */
export const allPagesPath = 'all-pages';

/** The href of a plant's All pages index (ADR 0021, WCAG 2.4.5). */
export function allPagesHref(plant: string): string {
  return `/${plant}/${allPagesPath}`;
}

/**
 * The groups of a settings navigation from each module's entries (design shell-313, C2): core's
 * entries first without a label, then the entries of every other module in one group labelled
 * Modules, in module order. A group without entries is left out.
 */
export function settingsGroupsOf(
  perModule: readonly { readonly moduleId: string; readonly entries: readonly SettingsEntry[] }[],
): SettingsGroup[] {
  const groups: SettingsGroup[] = [
    {
      entries: perModule
        .filter(({ moduleId }) => moduleId === coreModuleId)
        .flatMap(({ entries }) => entries),
    },
    {
      label: 'Modules',
      entries: perModule
        .filter(({ moduleId }) => moduleId !== coreModuleId)
        .flatMap(({ entries }) => entries),
    },
  ];
  return groups.filter(({ entries }) => entries.length > 0);
}
