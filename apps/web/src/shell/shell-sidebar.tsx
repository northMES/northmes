// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link, useRouterState } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { Fragment } from 'react';
import type { MenuLink, ShellModule } from '../modules.ts';
import { NavIcon } from '../ui/components/nav-icon/index.ts';
import { Button } from '../ui/primitives/button.tsx';
import { SheetClose } from '../ui/primitives/sheet.tsx';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '../ui/primitives/sidebar.tsx';
import { type ShellUser, ShellUserMenu } from './shell-user-menu.tsx';

export interface ShellSidebarProps {
  /** The id the sidebar trigger names in aria-controls. */
  readonly id: string;
  /** The modules in their sidebar order. */
  readonly modules: readonly ShellModule[];
  /** The plant in the URL, whose links the entries are. */
  readonly plant: string;
  readonly user: ShellUser;
  /** Signs the user out, from the user menu. */
  readonly onSignOut: () => void;
}

/**
 * How an entry relates to the page on screen: its own page ("page"), a page under it ("true", as
 * an article under Articles), or neither.
 */
function currentOf(href: string, pathname: string): 'page' | 'true' | undefined {
  if (href === pathname) return 'page';
  return pathname.startsWith(`${href}/`) ? 'true' : undefined;
}

/**
 * The sidebar of the D2 planner shell, one nav landmark named Main (KE1): the head with the slot of
 * the plant switcher, one group per module in their order with its entries, and the user menu at
 * the foot. collapsible="icon" makes it the 64 px rail, where each entry shows its icon and its
 * label in a tooltip; where the shell is narrow it is the Navigation sheet, whose head holds Close
 * navigation and whose entries close it.
 */
export function ShellSidebar({ id, modules, plant, user, onSignOut }: ShellSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const entry = ({ label, icon, link }: MenuLink) => {
    const href = link({ plant }).href;
    const current = currentOf(href, pathname);
    return (
      <SidebarMenuItem key={label}>
        <SidebarMenuButton
          isActive={current !== undefined}
          tooltip={{ children: label, role: 'tooltip' }}
          render={
            <Link
              to={href}
              activeOptions={{ exact: true }}
              aria-current={current === 'true' ? 'true' : undefined}
              onClick={() => setOpenMobile(false)}
            />
          }
        >
          <NavIcon name={icon} />
          <span>{label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };
  return (
    <Sidebar id={id} collapsible="icon">
      <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col">
        <SidebarHeader className="h-14 flex-row items-center border-b border-sidebar-border">
          {/* The plant switcher of #392 goes here, the first item of the sidebar (ADR 0067). */}
          <div className="min-w-0 flex-1" />
          {isMobile && (
            // A plain icon button: a tooltip that opens on focus would take the first Escape,
            // which closes the sheet (KE12).
            <SheetClose
              render={<Button variant="ghost" size="icon" aria-label="Close navigation" />}
            >
              <X aria-hidden />
            </SheetClose>
          )}
        </SidebarHeader>
        <SidebarContent>
          {modules.map(({ module, label, links = [] }, index) => {
            const labelId = `sidebar-group-${module.id}`;
            return (
              <Fragment key={module.id}>
                {index > 0 && <SidebarSeparator />}
                <SidebarGroup>
                  <SidebarGroupLabel id={labelId}>{label}</SidebarGroupLabel>
                  <SidebarMenu
                    aria-labelledby={labelId}
                    className="group-data-[collapsible=icon]:items-center"
                  >
                    {links.map(entry)}
                  </SidebarMenu>
                </SidebarGroup>
              </Fragment>
            );
          })}
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border">
          <ShellUserMenu user={user} onSignOut={onSignOut} />
        </SidebarFooter>
      </nav>
    </Sidebar>
  );
}
