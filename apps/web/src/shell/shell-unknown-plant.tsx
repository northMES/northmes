// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link, useRouterState } from '@tanstack/react-router';
import { Factory, SearchX } from 'lucide-react';
import { type RefObject, useEffect } from 'react';
import type { ShellModule } from '../modules.ts';
import { SkipLink } from '../ui/components/skip-link/index.ts';
import { useScrollPaddingTop } from '../ui/lib/use-scroll-padding-top.ts';
import { Card } from '../ui/primitives/card.tsx';
import type { ShellCompany } from './companies.graphql.ts';
import { mainId, plantHome } from './shell-pages.ts';
import { ShellAccountMenu, type ShellUser } from './shell-user-menu.tsx';

export interface ShellUnknownPlantProps {
  readonly modules: readonly ShellModule[];
  readonly companies: readonly ShellCompany[];
  readonly user: ShellUser;
  readonly onSignOut: () => void;
  readonly main: RefObject<HTMLElement | null>;
}

/** The h1 and the title part of the page (D2 ST29, doc copy). */
const pageNotFound = 'Page not found';

/**
 * The page of a plant slug that names none of the user's plants (D2 ST29, ST30): a page without a
 * plant, so no sidebar, no switcher and no crumbs. The top bar holds the NorthMES mark and the
 * account menu, so the user can sign out. Main holds the h1 Page not found, a card that says there
 * is no plant at the path the user can open, and under the h2 Your plants an h3 per company with a
 * list of its plants named by that h3: the switcher's Factory mark, the plant link, which opens the
 * plant's first page, and the plant's path. It never says whether the plant exists (ADR 0007).
 */
export function ShellUnknownPlant({
  modules,
  companies,
  user,
  onSignOut,
  main,
}: ShellUnknownPlantProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const withPlants = companies.filter(({ plants }) => plants.length > 0);
  const stickyBlock = useScrollPaddingTop<HTMLElement>();
  useEffect(() => {
    document.title = `${pageNotFound} · NorthMES`;
  }, []);
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
        <ShellAccountMenu user={user} onSignOut={onSignOut} />
      </header>
      <main
        id={mainId}
        ref={main}
        tabIndex={-1}
        className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-7 focus-visible:outline-offset-[-4px]"
      >
        <h1 tabIndex={-1} className="text-title font-semibold">
          {pageNotFound}
        </h1>
        <Card className="grid max-w-160 gap-4 px-6 py-6 ring-border">
          <div className="flex items-start gap-3">
            <SearchX aria-hidden className="mt-0.5 size-6 shrink-0 text-muted-foreground" />
            <p className="max-w-[72ch] text-base leading-6 font-medium">
              There is no plant at <code className="font-mono text-sm">{pathname}</code> that you
              can open. The link may be out of date.
            </p>
          </div>
          {withPlants.length > 0 && (
            <section aria-labelledby="your-plants" className="grid gap-3">
              <h2 id="your-plants" className="font-semibold">
                Your plants
              </h2>
              {withPlants.map((company) => (
                <div key={company.id} className="grid gap-1">
                  <h3
                    id={`your-plants-${company.id}`}
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    {company.name}
                  </h3>
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
                          to={plantHome(modules, each.slug) ?? '.'}
                          className="text-link underline"
                        >
                          {each.name}
                        </Link>
                        <span className="font-mono text-sm text-muted-foreground">
                          /{each.slug}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
        </Card>
      </main>
    </div>
  );
}
