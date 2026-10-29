// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useRouterState } from '@tanstack/react-router';
import { SearchX } from 'lucide-react';
import { type ReactNode, type RefObject, useEffect } from 'react';
import type { ShellModule } from '../modules.ts';
import { Card } from '../ui/primitives/card.tsx';
import type { ShellCompany } from './companies.graphql.ts';
import { ShellPlantFreePage, ShellPlantList } from './shell-plant-free-page.tsx';
import type { ShellUser } from './shell-user-menu.tsx';

export interface ShellUnknownPlantProps {
  readonly modules: readonly ShellModule[];
  readonly companies: readonly ShellCompany[];
  readonly user: ShellUser;
  readonly onSignOut: () => void;
  readonly main: RefObject<HTMLElement | null>;
  /** The Help menu, before the account menu. */
  readonly help?: ReactNode;
}

/** The h1 and the title part of the page (D2 ST29, doc copy). */
const pageNotFound = 'Page not found';

/**
 * The page of a plant slug that names none of the user's plants (D2 ST29, ST30), a page without a
 * plant. Main holds the h1 Page not found, a card that says there is no plant at the path the user
 * can open, and under the h2 Your plants an h3 per company with a list of its plants. It never
 * says whether the plant exists (ADR 0007).
 */
export function ShellUnknownPlant({
  modules,
  companies,
  user,
  onSignOut,
  main,
  help,
}: ShellUnknownPlantProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const withPlants = companies.filter(({ plants }) => plants.length > 0);
  useEffect(() => {
    document.title = `${pageNotFound} · NorthMES`;
  }, []);
  return (
    <ShellPlantFreePage user={user} onSignOut={onSignOut} main={main} help={help}>
      <h1 tabIndex={-1} className="text-title font-semibold">
        {pageNotFound}
      </h1>
      <Card className="grid max-w-160 gap-4 px-6 py-6 ring-border">
        <div className="flex items-start gap-3">
          <SearchX aria-hidden className="mt-0.5 size-6 shrink-0 text-muted-foreground" />
          <p className="max-w-[72ch] text-base leading-6 font-medium">
            There is no plant at <code className="font-mono text-sm">{pathname}</code> that you can
            open. The link may be out of date.
          </p>
        </div>
        {withPlants.length > 0 && (
          <section aria-labelledby="your-plants" className="grid gap-3">
            <h2 id="your-plants" className="font-semibold">
              Your plants
            </h2>
            <ShellPlantList
              modules={modules}
              companies={withPlants.map((company) => ({ company }))}
            />
          </section>
        )}
      </Card>
    </ShellPlantFreePage>
  );
}
