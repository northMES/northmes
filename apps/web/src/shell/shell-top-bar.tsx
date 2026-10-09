// SPDX-License-Identifier: AGPL-3.0-or-later
import { Menu, PanelLeft } from 'lucide-react';
import type { Ref } from 'react';
import { IconButton } from '../ui/components/icon-button/index.ts';
import { useSidebar } from '../ui/primitives/sidebar.tsx';

export interface ShellTopBarProps {
  /** The id of the sidebar, which Collapse sidebar controls. */
  readonly sidebarId: string;
  /** Takes the element where a page frame renders the breadcrumb. */
  readonly breadcrumbRef: Ref<HTMLDivElement>;
  /** Takes the element where a page frame renders the page actions. */
  readonly actionsRef: Ref<HTMLDivElement>;
}

/**
 * The top bar (D2), the banner landmark: the sidebar trigger at its start, which keeps focus when
 * the sidebar becomes the rail and back (KE5), or Open navigation where the sidebar is the sheet;
 * then the breadcrumb and the page actions, which the page frame of the route fills.
 */
export function ShellTopBar({ sidebarId, breadcrumbRef, actionsRef }: ShellTopBarProps) {
  const { open, openMobile, isMobile, toggleSidebar } = useSidebar();
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
      {isMobile ? (
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
      )}
      <div ref={breadcrumbRef} className="min-w-0 flex-1" />
      <div ref={actionsRef} className="flex shrink-0 items-center gap-2" />
    </header>
  );
}
