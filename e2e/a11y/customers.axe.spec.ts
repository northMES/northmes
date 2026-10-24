// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the states of the customer pages (design #728): the customers
// list with its Source menu open and its loading, empty and failed states; a customer's page, with
// Late only, at 320 px, loading and not found; and a customer order's page with its Supply from an
// order step and not found. The pages read the fixture G1, so every state is the same in every
// run; the preview key opens the states of the customers pages on mock data.

/** An href of the seed plant with a search. */
function withSearch(href: string, search: Record<string, string>): string {
  return `${href}?${new URLSearchParams(search).toString()}`;
}

test.describe('the customer pages', () => {
  test('#728 ADR0021 each state of the customers list passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const customers = coreLinks.customers({ plant }).href;
    await signIn(customers);
    await expect(page.getByRole('table', { name: 'Customers' })).toBeVisible();
    await expect(page.getByText('Showing fixture G1.')).toBeVisible();
    await checkA11y('the customers list');

    await page.locator('button[aria-haspopup="menu"]', { hasText: /^Source$/ }).click();
    await expect(page.getByRole('menuitemcheckbox', { name: /^From the ERP/ })).toBeVisible();
    await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
    await checkA11y('the Source filter menu open');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.goto(withSearch(customers, { preview: 'loading' }));
    await expect(page.getByRole('table', { name: 'Customers' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await checkA11y('the customers list loading', { busy: true });

    await page.goto(withSearch(customers, { preview: 'empty' }));
    await expect(page.getByRole('heading', { level: 2, name: 'No customers yet' })).toBeVisible();
    await checkA11y('the customers list empty');

    await page.goto(withSearch(customers, { preview: 'error' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'Could not load customers' }),
    ).toBeVisible();
    await checkA11y('the customers list failed');
  });

  test("#728 ADR0021 each state of a customer's page passes the WCAG 2.2 AA rules", async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const hallberg = coreLinks.customers.customer({ plant, customerId: 'K-1042' }).href;
    await signIn(hallberg);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Hallberg Verkstad AB' }),
    ).toBeVisible();
    await expect(
      page.getByRole('table', { name: 'Customer order lines of Hallberg Verkstad AB' }),
    ).toBeVisible();
    await checkA11y('a customer');

    await page.goto(
      withSearch(coreLinks.customers.customer({ plant, customerId: 'K-1318' }).href, {
        late: '1',
      }),
    );
    await expect(page.getByText(/^1 of 1 line, late only\./)).toBeVisible();
    await checkA11y('a customer with Late only');

    await page.setViewportSize({ width: 320, height: 980 });
    await page.goto(hallberg);
    await expect(
      page.getByRole('region', { name: 'Customer order lines, scrolls sideways' }),
    ).toBeVisible();
    await checkA11y('a customer at 320 px');
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto(withSearch(hallberg, { preview: 'loading' }));
    await expect(page.locator('[aria-busy="true"]').first()).toBeVisible();
    await checkA11y('a customer loading', { busy: true });

    await page.goto(coreLinks.customers.customer({ plant, customerId: 'K-9999' }).href);
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'This customer does not exist or you cannot see it',
      }),
    ).toBeVisible();
    await checkA11y('a customer that does not exist');
  });

  test("#728 ADR0021 a customer order's page and its supply step pass the WCAG 2.2 AA rules", async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(
      planningLinks.customerOrders.customerOrder({ plant, customerOrderId: '40211' }).href,
    );
    await expect(
      page.getByRole('heading', { level: 1, name: 'Customer order 40211' }),
    ).toBeVisible();
    await checkA11y('a customer order');

    await page.getByRole('button', { name: 'Supply from an order, line 2' }).click();
    const dialog = page.getByRole('dialog', { name: 'Supply line 2 from a production order' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS('opacity', '1');
    await checkA11y('the supply step of line 2');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);

    await page.goto(
      planningLinks.customerOrders.customerOrder({ plant, customerOrderId: '99999' }).href,
    );
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'This customer order does not exist or you cannot see it',
      }),
    ).toBeVisible();
    await checkA11y('a customer order that does not exist');
  });
});
