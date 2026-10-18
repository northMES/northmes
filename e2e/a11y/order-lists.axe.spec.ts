// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the states of the two order lists (plan 07; design #687): the
// production orders list populated, with a filter menu open, with a filter and its chip, grouped by
// article, with Late only, and filtered to nothing; the customer orders list populated and with
// Late only. The lists read the fixture G1, so every state is the same in every run.

test.describe('the order lists', () => {
  test('ADR0021 each state of the production orders list passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(planningLinks.orders({ plant }).href);
    const table = page.getByRole('table', { name: 'Production orders' });
    await expect(table).toBeVisible();
    await expect(page.getByText(/^Showing fixture G1\./)).toBeVisible();
    await expect(table.locator('[data-order="1001"]')).toHaveCount(1);
    await checkA11y('the production orders list');

    // The filter menu's button, apart from the Article sort header.
    await page.locator('button[aria-haspopup="menu"]', { hasText: /^Article$/ }).click();
    await expect(page.getByRole('menuitemcheckbox', { name: /^Bracket L/ })).toBeVisible();
    // The menu fades in; axe must read its colors once the transition has ended.
    await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
    await checkA11y('the Article filter menu open');
    await page.getByRole('menuitemcheckbox', { name: /^Bracket L/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remove the article filter' })).toBeVisible();
    await expect(page).toHaveURL(/article=Bracket/);
    await checkA11y('a filter with its chip');
    await page.getByRole('button', { name: 'Clear filters' }).click();

    await page.getByRole('button', { name: 'Group by' }).click();
    await page.getByRole('menuitemradio', { name: 'Article' }).click();
    await expect(page.getByRole('button', { name: /^Bracket L/ })).toBeVisible();
    await expect(page).toHaveURL(/group=article/);
    await checkA11y('the list grouped by article');

    await page.getByRole('checkbox', { name: 'Late only' }).click();
    await expect(page).toHaveURL(/late=1/);
    await expect(table.locator('[data-order="1003"]')).toHaveCount(1);
    await checkA11y('Late only, grouped');

    await page.getByRole('searchbox', { name: 'Search production orders' }).fill('nothing here');
    await expect(
      page.getByRole('heading', { level: 2, name: 'No production orders match these filters' }),
    ).toBeVisible();
    await checkA11y('the list filtered to nothing');
  });

  test('ADR0021 each state of the customer orders list passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(planningLinks.customerOrders({ plant }).href);
    const table = page.getByRole('table', { name: 'Customer order lines' });
    await expect(table).toBeVisible();
    await expect(table.locator('[data-line]')).toHaveCount(7);
    await checkA11y('the customer orders list');

    await page.getByRole('button', { name: 'Actions for customer order 40208 line 1' }).click();
    await expect(page.getByRole('menuitem', { name: 'Open order' })).toBeVisible();
    await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
    await checkA11y('the row menu of a supplied line');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.getByRole('checkbox', { name: 'Late only' }).click();
    await expect(page).toHaveURL(/late=1/);
    await expect(table.locator('[data-line]')).toHaveCount(1);
    await checkA11y('Late only');
  });
});
