// SPDX-License-Identifier: AGPL-3.0-or-later
import { ChevronsUpDown, LogOut, Moon, Sun } from 'lucide-react';
import { type Theme, useTheme } from '../ui/lib/theme.ts';
import { Avatar, AvatarFallback } from '../ui/primitives/avatar.tsx';
import { Button } from '../ui/primitives/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/primitives/dropdown-menu.tsx';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '../ui/primitives/sidebar.tsx';

/** The person the user menu belongs to. */
export interface ShellUser {
  readonly name: string;
  readonly username: string;
}

/** The initials of a name, the avatar's text: "Alex Lund" gives AL. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
}

/** The avatar, name and username of the user button and the menu's header. */
function Identity({ user }: { readonly user: ShellUser }) {
  return (
    <>
      <Avatar aria-hidden className="size-8 rounded-lg after:rounded-lg">
        <AvatarFallback className="rounded-lg bg-secondary text-xs font-medium text-secondary-foreground">
          {initialsOf(user.name)}
        </AvatarFallback>
      </Avatar>
      <span className="grid min-w-0 flex-1 text-left leading-tight">
        <span className="truncate font-medium">{user.name}</span>
        <span className="truncate text-xs text-muted-foreground">{user.username}</span>
      </span>
    </>
  );
}

/** The menu's items: the user, the theme switch, Light and Dark, and Sign out. */
function UserMenuItems({
  user,
  onSignOut,
}: {
  readonly user: ShellUser;
  readonly onSignOut: () => void;
}) {
  const [theme, setTheme] = useTheme();
  return (
    <>
      <div className="flex items-center gap-2 px-1.5 py-1.5 text-sm">
        <Identity user={user} />
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value: Theme) => setTheme(value)}>
          <DropdownMenuRadioItem value="light" closeOnClick>
            <Sun aria-hidden />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" closeOnClick>
            <Moon aria-hidden />
            Dark
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onSignOut}>
        <LogOut aria-hidden />
        Sign out
      </DropdownMenuItem>
    </>
  );
}

interface ShellUserMenuProps {
  readonly user: ShellUser;
  readonly onSignOut: () => void;
}

/**
 * The user menu at the foot of the sidebar (D2, C2, KE24): a 48 px button named "{user},
 * {username}, account" that opens the menu upward, or to the right of the rail's avatar. The menu
 * holds the theme switch, Light and Dark; choosing one closes the menu, and focus returns to the
 * button (K7). Sign out ends the session and goes to the sign-in page (KE24). Profile and
 * Presentation settings come with their pages.
 */
export function ShellUserMenu({ user, onSignOut }: ShellUserMenuProps) {
  const { isMobile, state } = useSidebar();
  return (
    <SidebarMenu className="group-data-[collapsible=icon]:items-center">
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-label={`${user.name}, ${user.username}, account`}
                className="data-popup-open:bg-sidebar-accent"
              />
            }
          >
            <Identity user={user} />
            <ChevronsUpDown aria-hidden className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? 'top' : state === 'collapsed' ? 'right' : 'top'}
            align="end"
            className="min-w-56"
          >
            <UserMenuItems user={user} onSignOut={onSignOut} />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/**
 * The account button at the end of the top bar of company settings, a page without the main
 * sidebar (design shell-313, C1): the user's initials, named "{user}, {username}, account", which
 * open the same menu as the sidebar's user button, downward.
 */
export function ShellAccountMenu({ user, onSignOut }: ShellUserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${user.name}, ${user.username}, account`}
          />
        }
      >
        <Avatar aria-hidden className="size-8 rounded-lg after:rounded-lg">
          <AvatarFallback className="rounded-lg bg-secondary text-xs font-medium text-secondary-foreground">
            {initialsOf(user.name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="min-w-56">
        <UserMenuItems user={user} onSignOut={onSignOut} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
