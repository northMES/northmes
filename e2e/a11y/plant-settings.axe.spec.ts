// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the states of the plant settings pages (E06; design #688): the
// machines list and its loading, empty, failed and no-access states, a machine's page, the edit
// form with its loading, failed-save and no-access states and the not-found state, the calendars
// list and a calendar's page with its week view, and their no-access states. The pages read the fixture G1, so every state is
// the same in every run; the preview key opens the states on mock data.

/** An href of the seed plant with a search. */
function withSearch(href: string, search: Record<string, string>): string {
  return `${href}?${new URLSearchParams(search).toString()}`;
}

test.describe('the plant settings pages', () => {
  test('ADR0021 each state of the machines list passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const machines = coreLinks.machines({ plant }).href;
    await signIn(machines);
    const table = page.getByRole('table', { name: 'Machines' });
    await expect(table).toBeVisible();
    await expect(page.getByText('Showing fixture G1.')).toBeVisible();
    await expect(page.getByRole('navigation', { name: /settings$/ })).toBeVisible();
    await checkA11y('the machines list');

    await page.locator('button[aria-haspopup="menu"]', { hasText: /^Group$/ }).click();
    await expect(page.getByRole('menuitemcheckbox', { name: /^Assembly/ })).toBeVisible();
    await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
    await checkA11y('the Group filter menu open');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.goto(withSearch(machines, { preview: 'loading' }));
    await expect(page.getByRole('table', { name: 'Machines' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await checkA11y('the machines list loading', { busy: true });

    await page.goto(withSearch(machines, { preview: 'empty' }));
    await expect(page.getByRole('heading', { level: 2, name: 'No machines yet' })).toBeVisible();
    await checkA11y('the machines list empty');

    await page.goto(withSearch(machines, { preview: 'error' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'Could not load machines' }),
    ).toBeVisible();
    await checkA11y('the machines list failed');

    await page.goto(withSearch(machines, { preview: 'forbidden' }));
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'You need the permission to read machines at this plant',
      }),
    ).toBeVisible();
    await checkA11y('the machines list without access');
  });

  test('ADR0021 each state of a machine and its edit form passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(coreLinks.machines.machine({ plant, equipmentId: 'CNC1' }).href);
    await expect(page.getByRole('heading', { level: 1, name: 'Machine CNC1' })).toBeVisible();
    await expect(
      page.getByRole('table', { name: 'Routing operations that may run on CNC 1' }),
    ).toBeVisible();
    await checkA11y('a machine');

    const edit = coreLinks.machines.machine.edit({ plant, equipmentId: 'CNC1' }).href;
    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Edit machine CNC1' })).toBeVisible();
    await checkA11y('the edit form of a machine');

    await page.goto(withSearch(edit, { preview: 'loading' }));
    await expect(page.getByRole('heading', { level: 1, name: 'Edit machine' })).toBeVisible();
    await checkA11y('the edit form loading', { busy: true });

    await page.goto(withSearch(edit, { preview: 'error' }));
    await expect(page.getByRole('alert')).toContainText('Could not save the machine');
    await checkA11y('the edit form after a failed save');

    await page.goto(withSearch(edit, { preview: 'forbidden' }));
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'You need the permission to change machines at this plant',
      }),
    ).toBeVisible();
    await checkA11y('the edit form without access');

    await page.goto(coreLinks.machines.machine({ plant, equipmentId: 'ROBOT9' }).href);
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'This machine does not exist or you cannot see it',
      }),
    ).toBeVisible();
    await checkA11y('a machine that does not exist');
  });

  test('ADR0021 the calendars list and a calendar with its week view pass the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(coreLinks.calendars({ plant }).href);
    await expect(page.getByRole('table', { name: 'Calendars' })).toBeVisible();
    await checkA11y('the calendars list');

    await page.getByRole('link', { name: 'A1' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar A1' })).toBeVisible();
    await expect(page.getByRole('img', { name: /^Week 45:/ })).toBeVisible();
    await checkA11y('a calendar with the week view of W45');

    await page.getByRole('button', { name: 'Show the later week' }).click();
    await expect(page).toHaveURL(/week=2026-11-09/);
    await expect(page.getByRole('img', { name: /^Week 46:/ })).toBeVisible();
    await checkA11y('the week view of W46 with the plant holiday');

    await page.getByRole('button', { name: 'Mill 1' }).click();
    await expect(page.getByRole('button', { name: 'Mill 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await checkA11y('the week view of one machine');

    const noAccess = 'You need the permission to read calendars at this plant';
    await page.goto(withSearch(coreLinks.calendars({ plant }).href, { preview: 'forbidden' }));
    await expect(page.getByRole('heading', { level: 2, name: noAccess })).toBeVisible();
    await checkA11y('the calendars list without access');

    await page.goto(
      withSearch(coreLinks.calendars.calendar({ plant, calendarId: 'A1' }).href, {
        preview: 'forbidden',
      }),
    );
    await expect(page.getByRole('heading', { level: 2, name: noAccess })).toBeVisible();
    await checkA11y('a calendar without access');
  });

  test('ADR0021 each state of the plant page passes the WCAG 2.2 AA rules (design #767)', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const plantPage = coreLinks.plant({ plant }).href;
    await signIn(plantPage);
    // The h1 is the page, Plant; the plant's name and slug stand beside it (#767).
    await expect(page.getByRole('heading', { level: 1, name: 'Plant' })).toBeVisible();
    await expect(page.getByText('Plant A, plant-a')).toBeVisible();
    await expect(page.getByText('Showing fixture G1.')).toBeVisible();
    await checkA11y('the plant page');

    await page.goto(withSearch(plantPage, { preview: 'noCalendar' }));
    const dayStart = page.getByRole('textbox', { name: 'Production day start' });
    await dayStart.fill('02:30');
    await dayStart.blur();
    await expect(dayStart).toHaveAttribute('aria-invalid', 'true');
    await checkA11y('the plant page before its first calendar version, with a refused day start');

    await page.goto(withSearch(plantPage, { preview: 'loading' }));
    await expect(page.getByText('Loading the plant.')).toBeVisible();
    await checkA11y('the plant page loading', { busy: true });

    await page.goto(withSearch(plantPage, { preview: 'error' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'Could not load the plant' }),
    ).toBeVisible();
    await checkA11y('the plant page failed');

    await page.goto(withSearch(plantPage, { preview: 'forbidden' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'You need the permission to change this plant' }),
    ).toBeVisible();
    await checkA11y('the plant page without access');
  });
});
