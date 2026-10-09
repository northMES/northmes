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
import type { ShellCompany } from './companies.graphql.ts';
import { ShellPlantSwitcher } from './shell-plant-switcher.tsx';
import { type ShellUser, ShellUserMenu } from './shell-user-menu.tsx';

export interface ShellSidebarProps {
  /** The id the sidebar trigger names in aria-controls. */
  readonly id: string;
  /** The modules in their sidebar order. */
  readonly modules: readonly ShellModule[];
  /** The slug of the plant in the URL, whose links the entries are. */
  readonly plant: string;
  /** The user's companies and plants, for the plant switcher; empty until they load. */
  readonly companies: readonly ShellCompany[];
  readonly user: ShellUser;
  /** Signs the user out, from the user menu. */
  readonly onSignOut: () => void;
  /**
   * The permissions the user holds at the plant, for the entries that need one; until they load,
   * such entries stay out.
   */
  readonly permissions?: ReadonlySet<string>;
}

/** The id of Administration's label, which names its list. */
const adminLabelId = 'sidebar-group-administration';

/**
 * How an entry relates to the page on screen: its own page ("page"), a page under it ("true", as
 * an article under Articles), or neither.
 */
function currentOf(href: string, pathname: string): 'page' | 'true' | undefined {
  if (href === pathname) return 'page';
  return pathname.startsWith(`${href}/`) ? 'true' : undefined;
}

/**
 * The sidebar of the D2 planner shell, one nav landmark named Main (KE1): the head with the plant
 * switcher, one group per module in their order with its entries, Administration last with the
 * modules' admin entries (C7), and the user menu at the foot. An entry that needs a permission
 * shows only to a user who holds it at the plant. collapsible="icon" makes it the 64 px rail, where each entry shows its icon and its
 * label in a tooltip; where the shell is narrow it is the Navigation sheet, whose head holds Close
 * navigation and whose entries close it.
 */
export function ShellSidebar({
  id,
  modules,
  plant,
  companies,
  user,
  onSignOut,
  permissions,
}: ShellSidebarProps) {
  const shown = ({ permission }: MenuLink) =>
    permission === undefined || (permissions?.has(permission) ?? false);
  const adminLinks = modules.flatMap(({ adminLinks: links = [] }) => links).filter(shown);
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
          {/* The plant switcher is the first item of the sidebar (ADR 0067). */}
          <div className="flex min-w-0 flex-1">
            <ShellPlantSwitcher companies={companies} plant={plant} />
          </div>
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
                    {links.filter(shown).map(entry)}
                  </SidebarMenu>
                </SidebarGroup>
              </Fragment>
            );
          })}
          {adminLinks.length > 0 && (
            <>
              <SidebarSeparator />
              <SidebarGroup>
                <SidebarGroupLabel id={adminLabelId}>Administration</SidebarGroupLabel>
                <SidebarMenu
                  aria-labelledby={adminLabelId}
                  className="group-data-[collapsible=icon]:items-center"
                >
                  {adminLinks.map(entry)}
                </SidebarMenu>
              </SidebarGroup>
            </>
          )}
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border">
          <ShellUserMenu user={user} onSignOut={onSignOut} />
        </SidebarFooter>
      </nav>
    </Sidebar>
  );
}
