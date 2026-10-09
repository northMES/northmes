// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link } from '@tanstack/react-router';
import { CircleHelp } from 'lucide-react';
import { Fragment, useRef } from 'react';
import type { ShellModule } from '../modules.ts';
import { Button } from '../ui/primitives/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/primitives/dropdown-menu.tsx';

export interface ShellHelpMenuProps {
  /** The modules in their sidebar order, whose help entries the menu lists. */
  readonly modules: readonly ShellModule[];
  /** The All pages index of the plant on screen; a page without a plant has none. */
  readonly allPagesHref?: string;
  /** Where the menu opens: below the top bar's button, or above the sheet footer's. */
  readonly side?: 'bottom' | 'top';
}

/** A link item: an app path through the router, any other URL as a plain link. */
function linkFor(href: string) {
  if (href.startsWith('/')) return <Link to={href} />;
  // biome-ignore lint/a11y/useAnchorContent: the menu item renders its label inside the link.
  return <a href={href} />;
}

/**
 * The one help menu (D2 PL8, KE15, KE16; ADR 0062): the CircleHelp button named Help at a fixed
 * place, the end of the top bar, or the navigation sheet's footer at 320 px (WCAG 3.2.6). The menu
 * holds the modules' help entries, one group per module labelled by the module, then All pages.
 * It opens with focus on its first entry, and Escape returns focus to Help. An entry that opens a
 * page in the app moves focus to that page's h1, as any path change does. Without a single entry
 * there is no button. Accessibility waits for the docs site's Accessibility page (ADR 0021).
 */
export function ShellHelpMenu({ modules, allPagesHref, side = 'bottom' }: ShellHelpMenuProps) {
  // The items render links; the menu types its items' refs as divs.
  const first = useRef<HTMLDivElement>(null);
  const groups = modules
    .map(({ module, label }) => ({ id: module.id, label, entries: module.help ?? [] }))
    .filter(({ entries }) => entries.length > 0);
  const firstHref = groups[0]?.entries[0]?.href ?? allPagesHref;
  // A menu without entries would open empty: a page without a plant whose modules have no help.
  if (firstHref === undefined) return null;
  return (
    <DropdownMenu
      onOpenChangeComplete={(open) => {
        if (open) first.current?.focus();
      }}
    >
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Help" />}>
        <CircleHelp aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="end" className="min-w-56">
        {groups.map(({ id, label, entries }) => (
          <DropdownMenuGroup key={id}>
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            {entries.map((entry) => (
              <DropdownMenuItem
                key={entry.id}
                ref={entry.href === firstHref ? first : undefined}
                render={linkFor(entry.href)}
              >
                {entry.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
        {allPagesHref !== undefined && (
          <Fragment>
            {groups.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              ref={allPagesHref === firstHref ? first : undefined}
              render={linkFor(allPagesHref)}
            >
              All pages
            </DropdownMenuItem>
          </Fragment>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
