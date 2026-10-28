// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
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

// The inset focus outline on --accent of D2 is read from computed style in e2e/design-rules.spec.ts.
describe('DropdownMenu', () => {
  it('E04-S02 Enter on the trigger opens the menu with focus on its first item, and each kind of item has its role and state', async () => {
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
    const profile = within(menu).getByRole('menuitem', { name: 'Profile' });
    expect(document.activeElement).toBe(profile);
    expect(
      within(menu)
        .getByRole('menuitemcheckbox', { name: 'Compact rows' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Light' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      within(menu).getByRole('menuitem', { name: 'Language' }).getAttribute('aria-haspopup'),
    ).toBe('menu');
  });
});
