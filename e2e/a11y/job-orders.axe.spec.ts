// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the states of the job orders page (plan 07, Job order table view;
// ADR 0091): the populated table, the late facts of a row open, a sort, Late only, a filter menu
// open, the rows grouped by machine, no row that matches, the Columns menu open and the row menu
// open. The page reads the fixture G1, so every state is the same in every run. The empty states
// without job orders need a snapshot the fixture never answers; the web test covers them.

/** The job orders page of the seed plant with its search. */
function jobOrdersHref(search: Record<string, string> = {}): string {
  const query = new URLSearchParams(search).toString();
  return `${planningLinks.jobOrders({ plant }).href}${query === '' ? '' : `?${query}`}`;
}

test.describe('the job orders page', () => {
  test('ADR0021 each state of the job orders page passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(jobOrdersHref());
    const table = page.getByRole('table', { name: 'Job orders' });
    await expect(table).toBeVisible();
    await expect(page.getByText('Showing fixture G1.')).toBeVisible();
    await expect(table.locator('[data-job-order]')).toHaveCount(10);
    await checkA11y('the populated job order table');

    await page.getByRole('button', { name: 'Late facts for 1003.20' }).click();
    await expect(page.getByRole('region', { name: 'Late facts for 1003.20' })).toBeVisible();
    await checkA11y('the late facts of a row open');

    await page.getByRole('button', { name: 'Deadline' }).click();
    await expect(page.getByRole('columnheader', { name: 'Deadline' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await checkA11y('the table sorted by deadline');

    await page.getByRole('checkbox', { name: 'Late only' }).click();
    await expect(table.locator('[data-job-order]')).toHaveCount(2);
    await expect(page).toHaveURL(/late=1/);
    await checkA11y('Late only');
    await page.getByRole('checkbox', { name: 'Late only' }).click();
    await expect(table.locator('[data-job-order]')).toHaveCount(10);

    await page
      .getByRole('button', { name: 'Machine', exact: true })
      .and(page.locator('[aria-haspopup="menu"]'))
      .click();
    await expect(page.getByRole('menuitemcheckbox', { name: /^CNC 1/ })).toBeVisible();
    // The menu fades in; axe must read its colors once the transition has ended.
    await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
    await checkA11y('the Machine filter menu open');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.getByRole('button', { name: 'Group by' }).click();
    await page.getByRole('menuitemradio', { name: 'Machine' }).click();
    await expect(page.getByRole('button', { name: /^CNC 1 / })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await checkA11y('the rows grouped by machine');

    await page.getByRole('button', { name: 'Columns' }).click();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Soft lock' })).toBeVisible();
    await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
    await checkA11y('the Columns menu open');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.getByRole('button', { name: 'Actions for 1003.10' }).click();
    await expect(page.getByRole('menuitem', { name: 'Open on Gantt' })).toBeVisible();
    await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
    await checkA11y('the row menu open');
    await page.keyboard.press('Escape');

    await page.goto(jobOrdersHref({ q: 'nothing matches this' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'No job orders match these filters' }),
    ).toBeVisible();
    await checkA11y('no job order that matches');
  });
});
