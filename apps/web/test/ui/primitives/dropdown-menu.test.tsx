// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../../../src/ui/primitives/dropdown-menu.tsx';

afterEach(cleanup);

/**
 * The classes that draw D2's menu item focus: --accent with a 2 px inset --focus-outline, and no
 * --focus-ring band outside the item. happy-dom applies no Tailwind, so the test reads the classes.
 */
const insetFocusOutline = [
  'focus-visible:outline-2',
  'focus-visible:-outline-offset-2',
  'focus-visible:outline-focus-outline',
  'focus-visible:shadow-none',
];

describe('DropdownMenu', () => {
  it('E04-S02 every kind of menu item shows keyboard focus with a 2 px inset --focus-outline on --accent', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Account</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuCheckboxItem checked>Compact rows</DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="light">
            <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Language</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Svenska</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    screen.getByRole('button', { name: 'Account' }).focus();
    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    const items = [
      within(menu).getByRole('menuitem', { name: 'Profile' }),
      within(menu).getByRole('menuitemcheckbox', { name: 'Compact rows' }),
      within(menu).getByRole('menuitemradio', { name: 'Light' }),
      within(menu).getByRole('menuitem', { name: 'Language' }),
    ];

    for (const item of items) {
      expect(item.className.split(' ')).toEqual(expect.arrayContaining(insetFocusOutline));
      expect(item.className).toContain('focus:bg-accent');
    }
  });
});
