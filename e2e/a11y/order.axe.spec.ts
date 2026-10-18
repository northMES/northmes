// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the states of the production order page (plan 07, planning
// records; design #686): the General tab, the History tab with an entry's changes open, the edit
// form of an imported order and the not-found state. The pages read the fixture G1, so every state
// is the same in every run. The edit form of an order created in NorthMES needs a snapshot the
// fixture does not answer; the web test covers it.

/** An order's page of the seed plant. */
function orderHref(orderId: string, search: Record<string, string> = {}): string {
  const query = new URLSearchParams(search).toString();
  return `${planningLinks.orders.order({ plant, orderId }).href}${query === '' ? '' : `?${query}`}`;
}

test.describe('the production order page', () => {
  test('ADR0021 each state of the production order page passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(orderHref('po-1001'));
    await expect(page.getByRole('heading', { level: 1, name: 'Order 1001' })).toBeVisible();
    await expect(page.getByText('Showing fixture G1.')).toBeVisible();
    await expect(
      page.getByRole('table', { name: 'Customer order lines this order supplies' }),
    ).toBeVisible();
    await checkA11y('the General tab of an order');

    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByRole('table', { name: 'History of order 1001' })).toBeVisible();
    await expect(page).toHaveURL(/tab=history/);
    await expect(page.getByRole('table', { name: 'Changes on Mon 2 Nov 09:38' })).toBeVisible();
    await checkA11y('the History tab with the newest changes open');

    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Edit order 1001' })).toBeVisible();
    await expect(page.getByText('Order 1001 comes from the ERP')).toBeVisible();
    await checkA11y('the edit form of an imported order');

    await page.goto(orderHref('po-9999'));
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'This order does not exist or you cannot see it',
      }),
    ).toBeVisible();
    await checkA11y('an order that does not exist');
  });
});
