// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { planningLinks } from '@northmes/planning-contracts';
import { seedCompany } from '../../scripts/stack/seed.mjs';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the states of the inventory pages (design #729): the warehouses
// in company settings with their loading, empty, failed and no-access states; the Stock page with
// a filter menu open, at 320 px and in its loading, empty, failed and no-access states; and the
// stock of one article with its chart and movements, and not found. The pages read the fixture
// G1, so every state is the same in every run; the preview key opens the states on mock data.

/** An href with a search. */
function withSearch(href: string, search: Record<string, string>): string {
  return `${href}?${new URLSearchParams(search).toString()}`;
}

test.describe('the inventory pages', () => {
  test('#729 ADR0021 each state of the warehouses passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const warehouses = coreLinks.settings.warehouses({ companyId: seedCompany.id }).href;
    await signIn(warehouses);
    await expect(page.getByRole('table', { name: 'Warehouses' })).toBeVisible();
    await expect(page.getByText('Showing fixture G1.')).toBeVisible();
    await checkA11y('the warehouses');

    await page.locator('button[aria-haspopup="menu"]', { hasText: /^Plant$/ }).click();
    await expect(page.getByRole('menuitemcheckbox', { name: /^Plant A/ })).toBeVisible();
    await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
    await checkA11y('the Plant filter menu open');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.goto(withSearch(warehouses, { preview: 'loading' }));
    await expect(page.getByRole('table', { name: 'Warehouses' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await checkA11y('the warehouses loading', { busy: true });

    await page.goto(withSearch(warehouses, { preview: 'empty' }));
    await expect(page.getByRole('heading', { level: 2, name: 'No warehouses yet' })).toBeVisible();
    await checkA11y('the warehouses empty');

    await page.goto(withSearch(warehouses, { preview: 'error' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'Could not load warehouses' }),
    ).toBeVisible();
    await checkA11y('the warehouses failed');

    await page.goto(withSearch(warehouses, { preview: 'forbidden' }));
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: "You need the permission to manage this company's warehouses",
      }),
    ).toBeVisible();
    await checkA11y('the warehouses without access');
  });

  test('#729 ADR0021 each state of the Stock page passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const stock = planningLinks.stock({ plant }).href;
    await signIn(stock);
    await expect(page.getByRole('table', { name: 'Stock of Plant A by article' })).toBeVisible();
    await expect(page.getByRole('note')).toBeVisible();
    await checkA11y('the Stock page');

    await page.locator('button[aria-haspopup="menu"]', { hasText: /^Warehouse$/ }).click();
    await expect(page.getByRole('menuitemcheckbox', { name: /^A-RM/ })).toBeVisible();
    await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
    await checkA11y('the Warehouse filter menu open');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(stock);
    await expect(page.getByRole('list', { name: 'Stock of Plant A by article' })).toBeVisible();
    await checkA11y('the Stock page at 320 px');
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto(withSearch(stock, { preview: 'loading' }));
    await expect(
      page.getByRole('table', { name: 'Stock of the plant by article' }),
    ).toHaveAttribute('aria-busy', 'true');
    await checkA11y('the Stock page loading', { busy: true });

    await page.goto(withSearch(stock, { preview: 'empty' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'No stock from the ERP yet' }),
    ).toBeVisible();
    await checkA11y('the Stock page with no stock');

    await page.goto(withSearch(stock, { preview: 'error' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'Could not load the stock' }),
    ).toBeVisible();
    await checkA11y('the Stock page failed');

    await page.goto(withSearch(stock, { preview: 'forbidden' }));
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'You need the permission to read stock at this plant',
      }),
    ).toBeVisible();
    await checkA11y('the Stock page without access');
  });

  test('#729 ADR0021 the stock of an article passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(planningLinks.stock.article({ plant, articleId: '30-2011' }).href);
    await expect(page.getByRole('heading', { level: 1, name: 'Round bar 36 C45' })).toBeVisible();
    await expect(page.getByRole('figure', { name: /^Falls below zero/ })).toBeVisible();
    await checkA11y('the stock of a material short for a job order');

    await page.goto(planningLinks.stock.article({ plant, articleId: '20-1001' }).href);
    await expect(page.getByRole('heading', { level: 1, name: 'Bracket L' })).toBeVisible();
    await checkA11y('the stock of a finished article');

    await page.goto(planningLinks.stock.article({ plant, articleId: '99-0000' }).href);
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'This article has no stock at this plant or does not exist',
      }),
    ).toBeVisible();
    await checkA11y('an article without stock');
  });
});
