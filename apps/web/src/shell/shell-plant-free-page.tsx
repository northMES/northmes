// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Link } from '@tanstack/react-router';
import { Factory } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import type { ShellModule } from '../modules.ts';
import { SkipLink } from '../ui/components/skip-link/index.ts';
import { useScrollPaddingTop } from '../ui/lib/use-scroll-padding-top.ts';
import type { ShellCompany } from './companies.graphql.ts';
import { mainId, plantLinkHref } from './shell-pages.ts';
import { ShellAccountMenu, type ShellUser } from './shell-user-menu.tsx';

export interface ShellPlantFreePageProps {
  readonly user: ShellUser;
  readonly onSignOut: () => void;
  readonly main: RefObject<HTMLElement | null>;
  /** The Help menu, before the account menu. */
  readonly help?: ReactNode;
  readonly children: ReactNode;
}

/**
 * The frame of a page without a plant (D2 ST29, ST38, ST42): no sidebar, no switcher and no crumbs.
 * The top bar holds the NorthMES mark, Help and the account menu, so the user can sign out, and
 * main holds the page.
 */
export function ShellPlantFreePage({
  user,
  onSignOut,
  main,
  help,
  children,
}: ShellPlantFreePageProps) {
  const stickyBlock = useScrollPaddingTop<HTMLElement>();
  return (
    <div className="flex min-h-svh flex-col">
      <SkipLink targetId={mainId} />
      <header
        ref={stickyBlock}
        className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4"
      >
        <span
          aria-hidden
          className="grid size-6 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
        >
          N
        </span>
        <span className="flex-1 font-semibold">NorthMES</span>
        {help}
        <ShellAccountMenu user={user} onSignOut={onSignOut} />
      </header>
      <main
        id={mainId}
        ref={main}
        tabIndex={-1}
        className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-7 focus-visible:outline-offset-[-4px]"
      >
        {children}
      </main>
    </div>
  );
}

/** A company in a plant list, with its company settings landing where the user has a page there. */
export interface PlantListCompany {
  readonly company: ShellCompany;
  readonly settings?: string;
}

export interface ShellPlantListProps {
  readonly modules: readonly ShellModule[];
  readonly companies: readonly PlantListCompany[];
  /** The level of each company's heading, under the heading of the list. */
  readonly level: 2 | 3;
}

/**
 * The user's plants by company (D2 ST29, ST38): a heading per company and a list of its plants
 * named by that heading, each with the switcher's Factory mark, the plant link, which opens the
 * plant's first page or its root, and the plant's path. A company with a settings landing gets the link
 * "{company} settings" beside its heading (ADR 0066).
 */
export function ShellPlantList({ modules, companies, level }: ShellPlantListProps) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return companies.map(({ company, settings }) => (
    <div key={company.id} className="grid gap-1">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <Heading
          id={`your-plants-${company.id}`}
          className="text-xs font-semibold text-muted-foreground"
        >
          {company.name}
        </Heading>
        {settings !== undefined && (
          <Link
            to={settings}
            className="inline-flex min-h-(--nm-target-min) min-w-(--nm-target-min) items-center text-sm text-link underline"
          >
            {company.name} settings
          </Link>
        )}
      </div>
      {company.plants.length > 0 && (
        <ul aria-labelledby={`your-plants-${company.id}`} className="grid gap-1">
          {company.plants.map((each) => (
            <li key={each.slug} className="flex min-h-9 items-center gap-2">
              <span
                aria-hidden
                className="grid size-6 place-items-center rounded-md border text-muted-foreground"
              >
                <Factory className="size-3.5" />
              </span>
              <Link
                to={plantLinkHref(modules, each.slug)}
                className="inline-flex min-h-(--nm-target-min) min-w-(--nm-target-min) items-center text-link underline"
              >
                {each.name}
              </Link>
              <span className="font-mono text-sm text-muted-foreground">/{each.slug}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  ));
}
