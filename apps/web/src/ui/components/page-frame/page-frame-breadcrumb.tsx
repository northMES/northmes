// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link } from '@tanstack/react-router';
import { Fragment } from 'react';
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
 * The trail in the top bar (D2, ADR 0067): the crumbs as links, or as text when a crumb has no
 * page, then the current page, which carries aria-current="page". The crumb links meet the 24 px
 * target (2.5.8).
 */
export function PageFrameBreadcrumb({
  crumbs,
  current,
}: {
  readonly crumbs: readonly Crumb[];
  readonly current: string;
}) {
  return (
    <Breadcrumb aria-label="Breadcrumb" className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb) => (
          <Fragment key={`${crumb.label} ${crumb.href}`}>
            <BreadcrumbItem>
              {crumb.href === undefined ? (
                <span className="truncate">{crumb.label}</span>
              ) : (
                <BreadcrumbLink
                  render={<Link to={crumb.href} />}
                  className="inline-flex min-h-(--nm-target-min) items-center truncate rounded-sm"
                >
                  {crumb.label}
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
