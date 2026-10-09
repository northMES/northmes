// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link, useRouterState } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { Fragment, type ReactNode, useEffect } from 'react';
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
import { ShellNavGroup } from './shell-nav-group.tsx';
import { currentOf, isMenuGroup, shownTo, sidebarItems } from './shell-pages.ts';
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
  /** The Help menu, which the footer row holds beside the user button where the sidebar is the sheet. */
  readonly help?: ReactNode;
}

/**
 * The sidebar of the D2 planner shell, one nav landmark named Main (KE1): the head with the plant
 * switcher, one group per module in their order with its entries and nested groups (PL5), and the
 * user menu at the foot. An entry that needs a permission shows only to a user who holds it at the
 * plant, a nested group only with an entry the user may open, and an entry of the plant settings
 * navigation stays out (ADR 0066), as administration does: it lives in the settings area behind
 * the Settings button. collapsible="icon" makes it the 64 px rail, where each
 * entry shows its icon and its label in a tooltip; where the shell is narrow it is the Navigation
 * sheet, whose head holds Close navigation and whose entries close it. Any path change closes the
 * sheet too, such as All pages chosen from Help in its footer, so focus can move to the new h1 (D2
 * KE13).
 */
export function ShellSidebar({
  id,
  modules,
  plant,
  companies,
  user,
  onSignOut,
  permissions,
  help,
}: ShellSidebarProps) {
  const shown = shownTo(permissions);
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // Each new path closes the sheet, whatever link inside it led there.
  useEffect(() => setOpenMobile(false), [pathname, setOpenMobile]);
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
          {modules.map((each, index) => {
            const { module, label } = each;
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
                    {sidebarItems(each).map((item) => {
                      if (!isMenuGroup(item)) return shown(item) && entry(item);
                      const entries = item.links.filter(shown);
                      return (
                        entries.length > 0 && (
                          <ShellNavGroup
                            key={item.label}
                            group={item}
                            entries={entries}
                            moduleLabel={label}
                            plant={plant}
                          />
                        )
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroup>
              </Fragment>
            );
          })}
        </SidebarContent>
        <SidebarFooter className="flex-row items-center border-t border-sidebar-border">
          {/* One footer row (D2 Sheet): the user button, then Help in the 320 px sheet. */}
          <div className="min-w-0 flex-1">
            <ShellUserMenu user={user} onSignOut={onSignOut} />
          </div>
          {help}
        </SidebarFooter>
      </nav>
    </Sidebar>
  );
}
