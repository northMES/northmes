// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import type { Page } from '@playwright/test';
import { confirm, newGroup, newMachine, routeOperation } from '../equipment.ts';
import { expect, plant, test, uniqueCode } from '../fixtures.ts';

// The axe check of ADR 0021 over the states of the plant settings pages (E06; design #688): the
// machines list with its Group menu open, Show archived and its loading, empty, failed and
// no-access states; the new machine form; a machine's page with its archive dialog and its
// loading, failed and no-access states; the edit form with its own color picked, loading and
// after a refused save; an archived machine and a machine that does not exist; and the calendars
// list and a calendar's page with its week view, a calendar with three shifts at 1280 and 320,
// and their no-access states. The machines come from the API: each test makes its own group and
// G1's machine codes in it, so the routing operations and the week of the fixture G1 show; the
// group's code is new in each run, and other specs on the worker's database may add groups and
// machines, so the list's screenshots can differ between runs. The API's states come from routing
// its answers. The calendars read the fixture G1; the preview key opens their states on mock data.

/** An href of the seed plant with a search. */
function withSearch(href: string, search: Record<string, string>): string {
  return `${href}?${new URLSearchParams(search).toString()}`;
}

/**
 * Makes a plant group for one test's machines, named and coded on its own, so no other group of
 * the worker's database shares its name, and returns its name.
 */
async function machining(page: Page): Promise<string> {
  const code = uniqueCode('MG');
  const name = `Machining ${code}`;
  await newGroup(page, plant, { code, name, scope: /^Plant A$/, color: 'Color 3' });
  return name;
}

test.describe('the plant settings pages', () => {
  test('#991 ADR0021 each state of the machines list passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const machines = coreLinks.settings.machines({ plant }).href;
    const list = await routeOperation(page, 'CoreEquipmentList', 'coreEquipmentList');
    await signIn(coreLinks.settings.machines.new({ plant }).href);
    await expect(page.getByRole('button', { name: 'Save machine' })).toBeVisible();
    await checkA11y('the new machine form');

    const group = await machining(page);
    const option = `${group} (${group.replace('Machining ', '')})`;
    await newMachine(page, plant, { code: 'CNC1', name: 'CNC 1', group: option });
    await newMachine(page, plant, {
      code: 'LATHE1',
      name: 'Lathe 1',
      group: option,
      plannable: false,
    });
    await page.goto(machines);
    const table = page.getByRole('table', { name: 'Machines' });
    await expect(table.getByRole('link', { name: 'CNC1', exact: true })).toBeVisible();
    const settingsNav = page.getByRole('navigation', { name: /settings$/ });
    await expect(settingsNav).toBeVisible();
    // The company's settings end the navigation as a group of their pages (#876); the dev admin
    // administers the company, so Users is among them.
    await expect(settingsNav.getByRole('link', { name: 'Users' })).toBeVisible();
    await checkA11y('the machines list');

    await page.locator('button[aria-haspopup="menu"]', { hasText: /^Group$/ }).click();
    await expect(
      page.getByRole('menuitemcheckbox', { name: new RegExp(`^${group}`) }),
    ).toBeVisible();
    await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
    await checkA11y('the Group filter menu open');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    list('hold');
    await page.goto(machines);
    await expect(page.getByRole('table', { name: 'Machines' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await checkA11y('the machines list loading', { busy: true });

    list('empty');
    await page.goto(machines);
    await expect(page.getByRole('heading', { level: 2, name: 'No machines yet' })).toBeVisible();
    await checkA11y('the machines list empty');

    list('fail');
    await page.goto(machines);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Could not load machines' }),
    ).toBeVisible();
    await checkA11y('the machines list failed');

    list('forbidden');
    await page.goto(machines);
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'You need the permission to read machines in Plant A',
      }),
    ).toBeVisible();
    await checkA11y('the machines list without access');
    list('pass');
  });

  test('#991 ADR0021 each state of a machine and its edit form passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const one = await routeOperation(page, 'CoreEquipment');
    const update = await routeOperation(page, 'CoreUpdateEquipment');
    await signIn(coreLinks.settings.machines({ plant }).href);
    const group = await machining(page);
    await newMachine(page, plant, {
      code: 'MILL1',
      name: 'Mill 1',
      group: `${group} (${group.replace('Machining ', '')})`,
    });
    const mill = page.url();
    await expect(
      page.getByRole('table', { name: 'Routing operations that may run on Mill 1' }),
    ).toBeVisible();
    await checkA11y('a machine');

    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    // The dialog fades in; axe reads its text against the page until it has (#867).
    await expect(page.getByRole('alertdialog')).toHaveCSS('opacity', '1');
    await checkA11y('the archive dialog of a machine');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    await page.getByRole('link', { name: 'Edit machine' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Edit machine MILL1' })).toBeVisible();
    const edit = page.url();
    await page.getByRole('radio', { name: 'Own color' }).click();
    await page
      .getByRole('radiogroup', { name: 'Own color' })
      .getByRole('radio', { name: 'Color 12' })
      .click();
    await checkA11y('the edit form of a machine with its own color picked');

    update('fail');
    await page.getByRole('button', { name: 'Save machine' }).click();
    await expect(page.getByRole('heading', { name: 'Could not save the machine' })).toBeVisible();
    await checkA11y('the edit form after a failed save');
    update('pass');

    one('hold');
    await page.goto(edit);
    await expect(page.getByText('Loading the machine.')).toBeVisible();
    await checkA11y('the edit form loading', { busy: true });

    await page.goto(mill);
    await expect(page.getByRole('heading', { level: 1, name: 'Machine' })).toBeVisible();
    // The page frame marks the loading machine busy; it draws no skeleton, so the busy element is
    // empty and never visible.
    await expect(page.locator('main [aria-busy="true"]')).toHaveCount(1);
    await checkA11y('a machine loading', { busy: true });

    one('fail');
    await page.goto(mill);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Could not load the machine' }),
    ).toBeVisible();
    await checkA11y('a machine failed');

    one('forbidden');
    await page.goto(mill);
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'You need the permission to read machines in Plant A',
      }),
    ).toBeVisible();
    await checkA11y('a machine without access');
    one('pass');

    await page.goto(
      coreLinks.settings.machines.machine({
        plant,
        equipmentId: '019a0000-0000-7000-8000-0000000000ff',
      }).href,
    );
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'This machine does not exist or you cannot see it',
      }),
    ).toBeVisible();
    await checkA11y('a machine that does not exist');

    await page.goto(mill);
    await confirm(page, 'Archive', 'machine');
    await expect(page.getByRole('button', { name: 'Restore', exact: true })).toBeVisible();
    await checkA11y('an archived machine');
    await page.getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCSS('opacity', '1');
    await checkA11y('the restore dialog of a machine');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    await page.goto(coreLinks.settings.machines({ plant }, { archived: '1' }).href);
    await expect(
      page.getByRole('table', { name: 'Machines' }).getByText('Archived', { exact: true }),
    ).toBeVisible();
    await checkA11y('the machines list with the archived machines');
  });

  test('ADR0021 the calendars list and a calendar with its week view pass the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(coreLinks.settings.calendars({ plant }).href);
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

    // A calendar with three shifts: each shift in its own color, with the legend above the view
    // (#770), and at 320 the view scrolling sideways in its focusable region.
    await page.goto(
      withSearch(coreLinks.settings.calendars.calendar({ plant, calendarId: 'B3' }).href, {
        week: '2026-11-09',
      }),
    );
    await expect(page.getByRole('list', { name: 'Legend' })).toBeVisible();
    await expect(page.getByRole('img', { name: /^Week 46:/ })).toBeVisible();
    await checkA11y('a calendar with three shifts and its legend');
    await page.setViewportSize({ width: 320, height: 800 });
    await expect(page.getByRole('region', { name: 'Week view' })).toBeVisible();
    await checkA11y('a calendar with three shifts at 320');
    await page.setViewportSize({ width: 1280, height: 800 });

    const noAccess = 'You need the permission to read calendars at this plant';
    await page.goto(
      withSearch(coreLinks.settings.calendars({ plant }).href, { preview: 'forbidden' }),
    );
    await expect(page.getByRole('heading', { level: 2, name: noAccess })).toBeVisible();
    await checkA11y('the calendars list without access');

    await page.goto(
      withSearch(coreLinks.settings.calendars.calendar({ plant, calendarId: 'A1' }).href, {
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
    const plantPage = coreLinks.settings.plant({ plant }).href;
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
