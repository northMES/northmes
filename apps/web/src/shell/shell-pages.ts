// SPDX-License-Identifier: AGPL-3.0-or-later
import { companySettingsHref } from '@northmes/web-sdk';
import { useRouterState } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import type { MenuLink, SettingsLink, ShellModule } from '../modules.ts';
import type { ShellCompany } from './companies.graphql.ts';

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
      // An h1 without a tabindex, such as the board stub's, cannot take focus, so main does.
      const heading = main.current?.querySelector<HTMLElement>('h1[tabindex]');
      (heading ?? main.current)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  return main;
}

/**
 * How an entry relates to the page on screen: its own page ("page"), a page under it ("true", as
 * an article under Articles or a user's page under Users), or neither.
 */
export function currentOf(href: string, pathname: string): 'page' | 'true' | undefined {
  if (href === pathname) return 'page';
  return pathname.startsWith(`${href}/`) ? 'true' : undefined;
}

/** Whether an entry shows to a user with these permissions: one without a permission always does. */
export function shownTo(permissions: ReadonlySet<string> | undefined) {
  return ({ permission }: Pick<MenuLink | SettingsLink, 'permission'>) =>
    permission === undefined || (permissions?.has(permission) ?? false);
}

/** The entries of the main sidebar of a module: those outside the plant settings navigation. */
export function sidebarLinks(module: ShellModule): readonly MenuLink[] {
  return (module.links ?? []).filter(({ area }) => area !== 'settings');
}

/** The entries of the plant settings navigation of a module (ADR 0066). */
export function plantSettingsLinks(module: ShellModule): readonly MenuLink[] {
  return (module.links ?? []).filter(({ area }) => area === 'settings');
}

/** The href of the first sidebar entry of a module, at a plant. */
export function firstHref(module: ShellModule | undefined, plant: string): string | undefined {
  const [first] = module === undefined ? [] : sidebarLinks(module);
  return first?.link({ plant }).href;
}

/** The href of a plant's first page, the first entry of the sidebar, until a plant has a home page. */
export function plantHome(modules: readonly ShellModule[], plant: string): string | undefined {
  return firstHref(
    modules.find((module) => sidebarLinks(module).length > 0),
    plant,
  );
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
 * The company settings entries of the modules that a user with these permissions at the company
 * may open, for a company: core's first, then the other modules' (ADR 0066).
 */
export function companySettingsEntries(
  modules: readonly ShellModule[],
  permissions: ReadonlySet<string> | undefined,
  companyId: string,
) {
  const shown = shownTo(permissions);
  return modules.map(({ module, settingsLinks = [] }) => ({
    moduleId: module.id,
    entries: settingsLinks
      .filter(shown)
      .map(({ label, icon, link }) => ({ label, icon, href: link({ companyId }).href })),
  }));
}

/** An entry of a navigation as a page: its label and its href. */
export interface PageEntry {
  readonly label: string;
  readonly href: string;
}

/** Where a page lives: a plant, by its slug, or company settings, by the company id. */
export interface PagePlace {
  readonly plant?: string;
  readonly companyId?: string;
}

/** Every entry of the modules at a place: the sidebar and plant settings, or company settings. */
function entriesAt(modules: readonly ShellModule[], { plant, companyId }: PagePlace): PageEntry[] {
  if (plant !== undefined) {
    return modules.flatMap(({ links = [] }) =>
      links.map(({ label, link }) => ({ label, href: link({ plant }).href })),
    );
  }
  if (companyId !== undefined) {
    return modules.flatMap(({ settingsLinks = [] }) =>
      settingsLinks.map(({ label, link }) => ({ label, href: link({ companyId }).href })),
    );
  }
  return [];
}

/**
 * The entry of the page on screen: the one whose page it is, or the nearest one above it, as
 * Articles for an article. Its label stands in for the route title where the route itself cannot
 * give one, such as on its error panel.
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

/**
 * The way out of a page that failed (D2 ST6, shell-306 SE): the first sidebar entry of its module,
 * else the plant's first page; in company settings, the company landing. Never the page itself.
 */
export function wayOutOf(
  modules: readonly ShellModule[],
  { plant, companyId }: PagePlace,
  pathname: string,
): PageEntry | undefined {
  if (companyId !== undefined) {
    const href = companySettingsHref(companyId);
    return href === pathname ? undefined : { label: 'Company settings', href };
  }
  if (plant === undefined) return undefined;
  const moduleId = pathname.split('/')[2];
  const module = modules.find((each) => each.module.id === moduleId);
  const candidates = [
    ...(module === undefined ? [] : sidebarLinks(module).slice(0, 1)),
    ...modules.flatMap(sidebarLinks).slice(0, 1),
  ].map(({ label, link }) => ({ label, href: link({ plant }).href }));
  return candidates.find(({ href }) => href !== pathname);
}

/** The path segment of the All pages index under a plant, the shell's own route. */
export const allPagesPath = 'all-pages';

/** The href of a plant's All pages index (ADR 0021, WCAG 2.4.5). */
export function allPagesHref(plant: string): string {
  return `/${plant}/${allPagesPath}`;
}
