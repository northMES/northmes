// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link } from '@tanstack/react-router';
import { createContext, useContext } from 'react';
import { PageFrame } from '../ui/components/page-frame/index.ts';
import type { PageEntry } from './shell-pages.ts';

/** One group of the All pages index: a module's pages, or the plant's settings. */
export interface PageGroup {
  readonly label: string;
  readonly entries: readonly PageEntry[];
}

const PageGroupsContext = createContext<readonly PageGroup[]>([]);

/** Rendered by the plant layout with the pages the user can open there. */
export const PageGroupsProvider = PageGroupsContext.Provider;

/**
 * The All pages index of a plant (ADR 0021, WCAG 2.4.5), which Help and Page not found lead to:
 * the h1 All pages, then every page the user can open at the plant, one list per module named by
 * its h2 in the sidebar's order, and the plant's settings last. Its title reads "All pages · Plant
 * A · NorthMES".
 */
export function ShellAllPages() {
  const groups = useContext(PageGroupsContext);
  return (
    <PageFrame title="All pages">
      <div className="flex max-w-xl flex-col gap-6">
        {groups.map(({ label, entries }, index) => (
          <section key={label} aria-labelledby={`all-pages-${index}`} className="grid gap-2">
            <h2 id={`all-pages-${index}`} className="font-semibold">
              {label}
            </h2>
            <ul aria-labelledby={`all-pages-${index}`} className="grid gap-1">
              {entries.map(({ label: page, href }) => (
                <li key={href}>
                  <Link to={href} className="text-link underline">
                    {page}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageFrame>
  );
}
