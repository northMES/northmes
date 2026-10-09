// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { Menu, PanelLeft, Settings } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import { IconButton } from '../ui/components/icon-button/index.ts';
import { useScrollPaddingTop } from '../ui/lib/use-scroll-padding-top.ts';
import { buttonVariants } from '../ui/primitives/button.tsx';
import { useSidebar } from '../ui/primitives/sidebar.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/primitives/tooltip.tsx';

/** Where the Settings button leads, and whether the page on screen is in settings. */
export interface SettingsButtonTarget {
  readonly href: string;
  /** The page on screen is a settings page: the button shows that the user is in settings. */
  readonly current: boolean;
}

export interface ShellTopBarProps {
  /**
   * The id of the sidebar, which Collapse sidebar controls. A page without the main sidebar, such
   * as company settings, has no sidebar trigger.
   */
  readonly sidebarId?: string;
  /** Takes the element where a page frame renders the breadcrumb. */
  readonly breadcrumbRef: Ref<HTMLDivElement>;
  /** Takes the element where a page frame renders the page actions. */
  readonly actionsRef: Ref<HTMLDivElement>;
  /** Where the Settings button leads; without one, the user has no settings and no button. */
  readonly settings?: SettingsButtonTarget;
  /** The account button at the end, on a page without the sidebar and its user button. */
  readonly account?: ReactNode;
}

/**
 * The sidebar trigger at the top bar's start, which keeps focus when the sidebar becomes the rail
 * and back (KE5), or Open navigation where the sidebar is the sheet.
 */
function SidebarToggle({ sidebarId }: { readonly sidebarId: string }) {
  const { open, openMobile, isMobile, toggleSidebar } = useSidebar();
  return isMobile ? (
    <IconButton
      label="Open navigation"
      variant="ghost"
      aria-haspopup="dialog"
      aria-expanded={openMobile}
      onClick={toggleSidebar}
    >
      <Menu />
    </IconButton>
  ) : (
    <IconButton
      label={open ? 'Collapse sidebar' : 'Expand sidebar'}
      variant="ghost"
      aria-expanded={open}
      aria-controls={sidebarId}
      onClick={toggleSidebar}
    >
      <PanelLeft />
    </IconButton>
  );
}

/**
 * The Settings button (design shell-313, C4, ADR 0066): shell chrome with the lucide Settings icon
 * and the tooltip Settings, a link to the settings of the plant on screen, or to company settings
 * for a user with only those. On a settings page it carries aria-current, and a line under it.
 */
function SettingsButton({ href, current }: SettingsButtonTarget) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            to={href}
            aria-label="Settings"
            aria-current={current ? 'true' : undefined}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon' }),
              current && 'border-b-2 border-foreground',
            )}
          />
        }
      >
        <Settings aria-hidden />
      </TooltipTrigger>
      <TooltipContent role="tooltip">Settings</TooltipContent>
    </Tooltip>
  );
}

/**
 * The top bar (D2), the banner landmark: the sidebar trigger at its start, then the breadcrumb and
 * the page actions, which the page frame of the route fills, then the Settings button, where Help
 * will follow it, and on a page without the sidebar the account button. It is sticky, so it keeps
 * the page's scroll-padding-top at its height plus 8 px (KE19, KE20).
 */
export function ShellTopBar({
  sidebarId,
  breadcrumbRef,
  actionsRef,
  settings,
  account,
}: ShellTopBarProps) {
  const stickyBlock = useScrollPaddingTop<HTMLElement>();
  return (
    <header
      ref={stickyBlock}
      className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4"
    >
      {sidebarId !== undefined && <SidebarToggle sidebarId={sidebarId} />}
      <div ref={breadcrumbRef} className="min-w-0 flex-1" />
      <div ref={actionsRef} className="flex shrink-0 items-center gap-2" />
      {(settings !== undefined || account !== undefined) && (
        <div className="flex shrink-0 items-center gap-1">
          {settings !== undefined && <SettingsButton {...settings} />}
          {account}
        </div>
      )}
    </header>
  );
}
