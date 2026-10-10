// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { ArrowLeft, Building2 } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { NavIcon } from '../ui/components/nav-icon/index.ts';
import type { NavIconName } from '../ui/lib/nav-icon-names.ts';
import { useIsMobile } from '../ui/lib/use-mobile.ts';
import { Separator } from '../ui/primitives/separator.tsx';
import { currentOf } from './shell-pages.ts';

/** One entry of a settings navigation: its label, its icon and its page. */
export interface SettingsEntry {
  readonly label: string;
  readonly icon: NavIconName;
  readonly href: string;
}

/** A group of a settings navigation: the entries of one kind, under a label after the first. */
export interface SettingsGroup {
  /** The group's label, such as Modules; the first group of core's entries has none. */
  readonly label?: string;
  readonly entries: readonly SettingsEntry[];
}

/** A link that leads out of a settings area or back to its landing, with an arrow before it. */
export interface WayLink {
  readonly label: string;
  readonly href: string;
}

/** "← Back to Plant A" or "← Company settings": a way out with an arrow, as C1 and C6 draw it. */
export function BackLink({ label, href, className }: WayLink & { readonly className?: string }) {
  return (
    <Link
      to={href}
      className={cn(
        'inline-flex min-h-(--nm-target-min) items-center gap-2 self-start text-sm text-link underline underline-offset-2 hover:no-underline',
        className,
      )}
    >
      <ArrowLeft aria-hidden className="size-4" />
      {label}
    </Link>
  );
}

interface ShellSettingsNavProps {
  /** The company, as the small line above the title. */
  readonly company: string;
  /** The area's name, "Company settings" or "Plant A settings", which names the landmark. */
  readonly title: string;
  readonly groups: readonly SettingsGroup[];
  /** The link at the foot, such as "Acme AB settings" from plant settings. */
  readonly foot?: WayLink;
  readonly pathname: string;
}

/**
 * A settings navigation (design shell-313, C1 and C2, ADR 0066): a nav landmark named after its
 * area, apart from Main, with the company above the area's name, the entries in one fixed order
 * (WCAG 3.2.3), each with its icon, and the current entry marked with aria-current. Its foot holds
 * the way to the other area.
 */
export function ShellSettingsNav({
  company,
  title,
  groups,
  foot,
  pathname,
}: ShellSettingsNavProps) {
  const titleId = useId();
  const entry = ({ label, icon, href }: SettingsEntry) => {
    const current = currentOf(href, pathname);
    return (
      <li key={href}>
        <Link
          to={href}
          aria-current={current}
          className={cn(
            'flex min-h-9 items-center gap-2 rounded-md border-l-2 border-transparent px-2 text-sm hover:bg-accent',
            current !== undefined && 'border-foreground bg-accent font-medium',
          )}
        >
          <NavIcon name={icon} />
          <span className="truncate">{label}</span>
        </Link>
      </li>
    );
  };
  return (
    <nav aria-labelledby={titleId} className="flex flex-col gap-4">
      <div className="px-2">
        <p className="text-xs text-muted-foreground">{company}</p>
        <p id={titleId} className="text-base font-semibold">
          {title}
        </p>
      </div>
      {groups.map(({ label, entries }, index) => {
        const labelId = `${titleId}-group-${index}`;
        return (
          <div key={label ?? 'entries'} className="flex flex-col gap-1">
            {label !== undefined && (
              <p id={labelId} className="px-2 text-xs font-semibold text-muted-foreground">
                {label}
              </p>
            )}
            <ul
              aria-labelledby={label === undefined ? undefined : labelId}
              className="flex flex-col gap-0.5"
            >
              {entries.map(entry)}
            </ul>
          </div>
        );
      })}
      {foot !== undefined && (
        <>
          <Separator />
          <Link
            to={foot.href}
            className="flex min-h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-accent"
          >
            <Building2 aria-hidden className="size-4" />
            {foot.label}
          </Link>
        </>
      )}
    </nav>
  );
}

/** The id of the settings page's content, where the skip link lands past the settings navigation. */
export const settingsContentId = 'settings-content';

interface ShellSettingsLayoutProps {
  /** The column beside the page: the settings navigation, with Back to the plant above it. */
  readonly column: ReactNode;
  /**
   * The way back below 768 px, in place of the column: Back to the plant on the company landing,
   * the landing on a page drilled into from it (C5, C6). Without one, as in plant settings, the
   * column sits above the page there.
   */
  readonly narrowBack?: WayLink;
  readonly children: ReactNode;
}

/**
 * The settings layout inside main (design shell-313, C1, C2, C5 and C6): the settings navigation
 * beside the page content from 768 px; below, the page with its way back above the h1, or with the
 * navigation above it. The content takes focus from the skip link, which so passes the settings
 * navigation (WCAG 2.4.1).
 */
export function ShellSettingsLayout({ column, narrowBack, children }: ShellSettingsLayoutProps) {
  const isMobile = useIsMobile();
  const content = (
    <div
      id={settingsContentId}
      tabIndex={-1}
      className="flex min-w-0 flex-1 flex-col gap-2 focus-visible:outline-offset-4"
    >
      {isMobile && narrowBack !== undefined && <BackLink {...narrowBack} />}
      {children}
    </div>
  );
  if (isMobile) {
    return (
      <div className="flex flex-col gap-6">
        {narrowBack === undefined && column}
        {content}
      </div>
    );
  }
  return (
    <div className="flex gap-8">
      <div className="flex w-55 shrink-0 flex-col gap-6">{column}</div>
      {content}
    </div>
  );
}
