// SPDX-License-Identifier: AGPL-3.0-or-later
import { createLink } from '@tanstack/react-router';
import { type ComponentProps, Fragment } from 'react';
import { useIsMobile } from '../../lib/use-mobile.ts';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../../primitives/breadcrumb.tsx';
import type { Crumb } from './page-frame-top-bar.tsx';

/**
 * A router link that never claims aria-current: the router marks a link active when the page is
 * under its href, as the plant crumb is on every page below the first entry, and in the trail only
 * the current page is the current page.
 */
const CrumbLink = createLink(function CrumbAnchor({
  'aria-current': _current,
  ...props
}: ComponentProps<'a'>) {
  return <a {...props} />;
});

/**
 * The trail in the top bar (D2, ADR 0067): the crumbs as links, or as text when a crumb has no
 * page, then the current page, which carries aria-current="page". The crumb links meet the 24 px
 * target (2.5.8). Every crumb shrinks and truncates, and the current page keeps the most room.
 * Below 768 px, where the sidebar is the sheet, the trail keeps the first crumb (the plant) and the
 * current page, so it fits beside the page actions at 320 px (1.4.10); NA11's Show the full path
 * menu is not built yet.
 */
export function PageFrameBreadcrumb({
  crumbs,
  current,
}: {
  readonly crumbs: readonly Crumb[];
  readonly current: string;
}) {
  const isMobile = useIsMobile();
  const shown = isMobile ? crumbs.slice(0, 1) : crumbs;
  return (
    <Breadcrumb aria-label="Breadcrumb" className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {shown.map((crumb) => (
          <Fragment key={`${crumb.label} ${crumb.href}`}>
            <BreadcrumbItem className="min-w-0 max-w-40 shrink-[2]">
              {crumb.href === undefined ? (
                <span className="truncate">{crumb.label}</span>
              ) : (
                <BreadcrumbLink
                  render={<CrumbLink to={crumb.href} />}
                  className="inline-flex min-h-(--nm-target-min) min-w-0 items-center rounded-sm"
                >
                  <span className="truncate">{crumb.label}</span>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </Fragment>
        ))}
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate font-medium">{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
