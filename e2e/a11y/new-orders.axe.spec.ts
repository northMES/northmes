// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the states of New production order and New customer order
// (#768): each form ready, with field errors, at 320, and its loading, empty and no-access states,
// and the Gantt with a created order under Not placed. The forms read the fixture G1 and keep
// created orders in memory, so every state is the same in every run; the preview key opens the
// states.

/** An href with a search. */
function withSearch(href: string, search: Record<string, string>): string {
  const query = new URLSearchParams(search).toString();
  return query === '' ? href : `${href}?${query}`;
}

test.describe('the new order forms', () => {
  test('ADR0021 each state of New production order passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const form = planningLinks.orders.new({ plant }).href;
    await signIn(withSearch(form, { line: '40211-2' }));
    await expect(
      page.getByRole('heading', { level: 1, name: 'New production order' }),
    ).toBeVisible();
    await expect(page.getByRole('table', { name: 'Supplies' })).toBeVisible();
    await checkA11y('New production order from a customer order line');

    await page.getByRole('textbox', { name: /^Quantity/ }).fill('');
    await page.getByRole('button', { name: 'Create order' }).click();
    await expect(page.getByRole('group', { name: /needs? a change$/ })).toBeFocused();
    await checkA11y('New production order with field errors');

    await page.setViewportSize({ width: 320, height: 900 });
    await checkA11y('New production order at 320');
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.getByRole('textbox', { name: /^Quantity/ }).fill('250');
    await page.getByRole('button', { name: 'Create order' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Order N-1007' })).toBeVisible();

    // The order lives in the tab's memory, so the Gantt opens through the app, not a new load.
    await page.getByRole('link', { name: 'Zoom to order on the Gantt' }).click();
    await expect(page.getByRole('row', { name: /Not placed/ })).toContainText('N-1007.10');
    await checkA11y('the Gantt after a created order');

    await page.goto(withSearch(form, { line: '40211-2', preview: 'saveError' }));
    await page.getByRole('button', { name: 'Create order' }).click();
    await expect(page.getByRole('group', { name: 'Could not create the order' })).toBeFocused();
    await checkA11y('New production order with a server error');

    await page.goto(withSearch(form, { preview: 'error' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'Could not load the form' }),
    ).toBeVisible();
    await checkA11y('New production order that could not load');

    await page.goto(withSearch(form, { preview: 'loading' }));
    await expect(page.getByText('Loading articles and customer order lines')).toBeVisible();
    await checkA11y('New production order loading', { busy: true });

    await page.goto(withSearch(form, { preview: 'empty' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'No article can be ordered yet' }),
    ).toBeVisible();
    await checkA11y('New production order without an article');

    await page.goto(withSearch(form, { preview: 'forbidden' }));
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'You need the permission to create production orders at this plant',
      }),
    ).toBeVisible();
    await checkA11y('New production order without access');
  });

  test('ADR0021 each state of New customer order passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const form = planningLinks.customerOrders.new({ plant }).href;
    await signIn(form);
    await expect(page.getByRole('heading', { level: 1, name: 'New customer order' })).toBeVisible();
    await checkA11y('New customer order');

    await page.getByRole('button', { name: 'Create customer order' }).click();
    await expect(page.getByRole('group', { name: /needs? a change$/ })).toBeFocused();
    await checkA11y('New customer order with field errors');

    await page.setViewportSize({ width: 320, height: 900 });
    await checkA11y('New customer order at 320');
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto(withSearch(form, { preview: 'saveError' }));
    await page.getByRole('combobox', { name: 'Customer' }).selectOption('K-1211');
    await page.getByRole('combobox', { name: 'Article of line 1' }).selectOption('Shaft 8');
    await page.getByRole('textbox', { name: 'Quantity of line 1, pcs' }).fill('200');
    await page.getByRole('textbox', { name: 'Wanted date of line 1' }).fill('2026-11-25');
    await page.getByRole('button', { name: 'Create customer order' }).click();
    await expect(
      page.getByRole('group', { name: 'Could not create the customer order' }),
    ).toBeFocused();
    await checkA11y('New customer order with a server error');

    await page.goto(withSearch(form, { preview: 'error' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'Could not load the form' }),
    ).toBeVisible();
    await checkA11y('New customer order that could not load');

    await page.goto(withSearch(form, { preview: 'loading' }));
    await expect(page.getByText('Loading customers and articles')).toBeVisible();
    await checkA11y('New customer order loading', { busy: true });

    await page.goto(withSearch(form, { preview: 'empty' }));
    await expect(page.getByRole('heading', { level: 2, name: 'No customers yet' })).toBeVisible();
    await checkA11y('New customer order without customers');

    await page.goto(withSearch(form, { preview: 'forbidden' }));
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'You need the permission to create customer orders',
      }),
    ).toBeVisible();
    await checkA11y('New customer order without access');
  });
});
