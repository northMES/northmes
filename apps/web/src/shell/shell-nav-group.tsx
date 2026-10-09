// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link, useRouterState } from '@tanstack/react-router';
import { cn } from 'cn';
import { Check, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { MenuGroup, MenuLink } from '../modules.ts';
import { NavIcon } from '../ui/components/nav-icon/index.ts';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/primitives/collapsible.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../ui/primitives/dropdown-menu.tsx';
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '../ui/primitives/sidebar.tsx';
import { currentOf } from './shell-pages.ts';

export interface ShellNavGroupProps {
  /** The nested group's label and icon. */
  readonly group: Pick<MenuGroup, 'label' | 'icon'>;
  /** The group's entries the user may open, in order; the sidebar leaves out a group without any. */
  readonly entries: readonly MenuLink[];
  /** The label of the module whose sidebar group holds the group, the rail flyout's heading. */
  readonly moduleLabel: string;
  /** The slug of the plant in the URL, whose links the entries are. */
  readonly plant: string;
}

/**
 * Whether the group is open in the labelled sidebar: open by default when it holds the page on
 * screen, then the user's choice, until the user goes to a page of the group again, which opens it.
 */
function useGroupOpen(holdsCurrent: boolean) {
  const [open, setOpen] = useState(holdsCurrent);
  const [held, setHeld] = useState(holdsCurrent);
  if (held !== holdsCurrent) {
    setHeld(holdsCurrent);
    if (holdsCurrent) setOpen(true);
  }
  return [open, setOpen] as const;
}

/**
 * A nested group in a module's sidebar group (D2 PL5), such as core's Master data. In the
 * labelled sidebar and the sheet it is a disclosure button with its icon, its label and a chevron,
 * with its entries one level down; it opens by default when it holds the page on screen. While it
 * holds that page it carries aria-current="true", and when closed it is marked in --sidebar-accent,
 * not the --sidebar-primary of the page's own entry. In the rail it is the group's icon with its
 * label in a tooltip, a button that opens a flyout to its right (KE28): a menu named by the group,
 * headed by the module, whose items are the entries' links, the current one with a check. The
 * icon carries aria-current="true" while the group holds the page on screen, and Escape returns
 * focus to it (KE29). The group has no page of its own.
 */
export function ShellNavGroup({ group, entries, moduleLabel, plant }: ShellNavGroupProps) {
  const { isMobile, state, setOpenMobile } = useSidebar();
  const pathname = useRouterState({ select: (router) => router.location.pathname });
  const links = entries.map(({ label, icon, link }) => {
    const href = link({ plant }).href;
    return { label, icon, href, current: currentOf(href, pathname) };
  });
  const holdsCurrent = links.some(({ current }) => current !== undefined);
  const [open, setOpen] = useGroupOpen(holdsCurrent);
  if (state === 'collapsed' && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                isActive={holdsCurrent}
                aria-current={holdsCurrent ? 'true' : undefined}
                tooltip={{ children: group.label, role: 'tooltip' }}
                className="data-popup-open:bg-sidebar-accent"
              />
            }
          >
            <NavIcon name={group.icon} />
            <span>{group.label}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="start"
            aria-label={group.label}
            className="min-w-56"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>{moduleLabel}</DropdownMenuLabel>
              {links.map(({ label, icon, href, current }) => (
                <DropdownMenuItem
                  key={href}
                  render={
                    <Link
                      to={href}
                      activeOptions={{ exact: true }}
                      aria-current={current === 'true' ? 'true' : undefined}
                    />
                  }
                >
                  <NavIcon name={icon} />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {current !== undefined && <Check aria-hidden className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }
  return (
    <Collapsible open={open} onOpenChange={setOpen} render={<SidebarMenuItem />}>
      <CollapsibleTrigger
        aria-current={holdsCurrent ? 'true' : undefined}
        render={<SidebarMenuButton />}
        className={cn(holdsCurrent && !open && 'bg-sidebar-accent text-sidebar-accent-foreground')}
      >
        <NavIcon name={group.icon} />
        <span className="min-w-0 flex-1 truncate">{group.label}</span>
        <ChevronRight
          aria-hidden
          className={cn('ml-auto transition-transform', open && 'rotate-90')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          {links.map(({ label, icon, href, current }) => (
            <SidebarMenuSubItem key={href}>
              <SidebarMenuSubButton
                isActive={current !== undefined}
                className="h-8"
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
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}
