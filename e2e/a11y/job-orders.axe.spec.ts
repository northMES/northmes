// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the states of the job orders page (plan 07, Job order table view;
// design #660, T1): the populated table, the late facts of a row open, Late only, the Columns menu
// open and the row menu open. The page reads the fixture G1, so every state is the same in every
// run. The empty state needs a snapshot without orders, which the fixture never answers; the web
// test covers it.

/** The job orders page of the seed plant with its search. */
function jobOrdersHref(search: Record<string, string>): string {
  return `${planningLinks.jobOrders({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

test.describe('the job orders page', () => {
  test('ADR0021 each state of the job orders page passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(jobOrdersHref({ zoom: 'week', from: '2026-11-02' }));
    const table = page.getByRole('table', { name: 'Job orders, W45, Mon 2 Nov to Sun 8 Nov' });
    await expect(table).toBeVisible();
    await expect(page.getByText('Showing fixture G1.')).toBeVisible();
    await expect(table.locator('[data-job-order]')).toHaveCount(8);
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

    await page.getByRole('button', { name: 'Columns' }).click();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Soft lock' })).toBeVisible();
    await checkA11y('the Columns menu open');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.getByRole('button', { name: 'Actions for 1003.10' }).click();
    await expect(page.getByRole('menuitem', { name: 'Open on Gantt' })).toBeVisible();
    await checkA11y('the row menu open');
  });
});
