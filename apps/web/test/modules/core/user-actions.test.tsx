// SPDX-License-Identifier: AGPL-3.0-or-later
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  acme,
  anna,
  assignment,
  companiesQuery,
  companyId,
  person,
  plantA,
  sara,
  settingsViewerQuery,
  shiftLead,
  user,
  userQuery,
  viewerRole,
} from './access-fixtures.ts';
import { renderCoreAt, spoken } from './core-app.tsx';
import {
  blockMutation,
  resetPasswordMutation,
  temporaryPassword,
  unblockMutation,
  userAdmin,
} from './user-fixtures.ts';

afterEach(cleanup);

const saraOfPage = user(sara, [assignment(viewerRole, acme), assignment(shiftLead, plantA)]);

/** The user's page in company settings. */
function pageOf(of: { readonly id: string }) {
  return coreLinks.settings.users.user({ companyId, userId: of.id }).href;
}

/** The names of the page's top bar buttons, in order, once the user's name shows. */
async function actionNames(): Promise<string[]> {
  await screen.findByRole('heading', { level: 1 });
  return screen
    .queryAllByRole('button')
    .map((button) => button.textContent ?? '')
    .filter((name) => /^(Reset password|Block user|Unblock user)$/.test(name));
}

/** Whether a button has the destructive look, which only a confirm that takes something away has. */
const destructive = (button: HTMLElement) => button.className.includes('text-destructive');

const reasonHint = "Shown in the user's history. Do not enter personal data. Up to 500 characters.";

describe("a user's actions", () => {
  it('E05-S08 Reset password asks with an optional reason that has focus, then shows the temporary password once with focus on Copy password, and Done returns focus to Reset password', async () => {
    const browser = userEvent.setup();
    renderCoreAt(pageOf(sara), [
      settingsViewerQuery(userAdmin),
      companiesQuery(),
      userQuery(saraOfPage),
      resetPasswordMutation(sara, 'Forgot it'),
    ]);

    await waitFor(async () =>
      expect(await actionNames()).toEqual(['Reset password', 'Block user']),
    );
    const reset = screen.getByRole('button', { name: 'Reset password' });
    expect(destructive(reset)).toBe(false);
    await browser.click(reset);
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Reset the password of Sara Nyberg?',
    });
    expect(dialog.textContent).toContain(
      'NorthMES replaces the password with a temporary one and shows it to you once.',
    );
    expect(dialog.textContent).toContain(
      'Sara Nyberg must choose a new password at the next sign-in, before anything else.',
    );
    const reason = within(dialog).getByRole('textbox', { name: 'Reason (optional)' });
    await waitFor(() => expect(document.activeElement).toBe(reason));
    expect([reason.getAttribute('placeholder'), reason.getAttribute('maxlength')]).toEqual([
      'Why you reset the password',
      '500',
    ]);
    expect(within(dialog).getByText(reasonHint)).toBeDefined();
    await browser.type(reason, 'Forgot it');
    await browser.click(within(dialog).getByRole('button', { name: 'Reset password' }));

    const shown = await screen.findByRole('dialog', { name: 'Temporary password for Sara Nyberg' });
    const copy = within(shown).getByRole('button', { name: 'Copy password' });
    await waitFor(() => expect(document.activeElement).toBe(copy));
    expect(
      (within(shown).getByRole('textbox', { name: 'Temporary password' }) as HTMLInputElement)
        .value,
    ).toBe(temporaryPassword);
    expect(shown.textContent).toContain(
      'Give it to Sara Nyberg, who must choose a new password at the next sign-in.',
    );
    expect(shown.textContent).toContain('The old password no longer works.');
    expect(
      within(shown).getByText(
        'Shown only now. After you close this dialog, it cannot be shown again.',
      ),
    ).toBeDefined();
    await browser.click(within(shown).getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reset password' })),
    );
    expect(screen.queryByText(temporaryPassword)).toBeNull();
    expect(spoken() ?? '').toBe('');
  });

  it('E05-S08 Reset password needs core.user:resetPassword at the company', async () => {
    renderCoreAt(pageOf(sara), [
      settingsViewerQuery(['core.user:read', 'core.role:read', 'core.user:block']),
      companiesQuery(),
      userQuery(saraOfPage),
    ]);

    await waitFor(async () => expect(await actionNames()).toEqual(['Block user']));
  });

  it('E05-S08 your own page has no Reset password and no Block user', async () => {
    const jonas = person('Jonas Holm', 'jonas');
    renderCoreAt(pageOf(jonas), [
      settingsViewerQuery(userAdmin),
      companiesQuery(),
      userQuery(user(jonas, [])),
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Jonas Holm' })).toBeDefined();
    // The viewer's permissions arrive with the page; wait for them before the absence counts.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await actionNames()).toEqual([]);
  });

  it('E05-S08 a blocked user has Unblock user and no Reset password', async () => {
    renderCoreAt(pageOf(anna), [
      settingsViewerQuery(userAdmin),
      companiesQuery(),
      userQuery(user(anna, [], true)),
    ]);

    await waitFor(async () => expect(await actionNames()).toEqual(['Unblock user']));
  });

  it('E05-S08 Block user says what happens and that the roles stay, with the reason hint, and only its confirm button is destructive', async () => {
    const browser = userEvent.setup();
    renderCoreAt(pageOf(sara), [
      settingsViewerQuery(userAdmin),
      companiesQuery(),
      userQuery(saraOfPage),
      blockMutation(sara),
    ]);

    const block = await screen.findByRole('button', { name: 'Block user' });
    expect([destructive(block), block.className.includes('border-input')]).toEqual([false, true]);
    await browser.click(block);
    const dialog = await screen.findByRole('alertdialog', { name: 'Block Sara Nyberg?' });

    expect(dialog.textContent).toContain(
      'Sara Nyberg is signed out within a minute and cannot sign in until unblocked.',
    );
    expect(dialog.textContent).toContain(
      'The roles stay, so unblocking gives the same access back.',
    );
    const reason = within(dialog).getByRole('textbox', { name: 'Reason (optional)' });
    expect(reason.getAttribute('maxlength')).toBe('500');
    expect(within(dialog).getByText(reasonHint)).toBeDefined();
    expect(destructive(within(dialog).getByRole('button', { name: 'Block user' }))).toBe(true);
  });

  it('E05-S08 Unblock user says the user signs in with the current password and names the roles that stayed', async () => {
    const browser = userEvent.setup();
    renderCoreAt(pageOf(sara), [
      settingsViewerQuery(userAdmin),
      companiesQuery(),
      userQuery({ ...saraOfPage, blocked: true }),
      unblockMutation(sara),
    ]);

    await browser.click(await screen.findByRole('button', { name: 'Unblock user' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Unblock Sara Nyberg?' });

    expect(dialog.textContent).toContain(
      'Sara Nyberg can sign in again with the current password.',
    );
    expect(dialog.textContent).toContain(
      'The roles stayed while the user was blocked: Viewer at Acme AB and Shift lead at Plant A.',
    );
    expect(within(dialog).getByText(reasonHint)).toBeDefined();
    expect(destructive(within(dialog).getByRole('button', { name: 'Unblock user' }))).toBe(false);
  });
});
