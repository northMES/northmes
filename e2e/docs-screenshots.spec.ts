// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { fileURLToPath } from 'node:url';
import { unitOf } from '@northmes/contracts';
import { coreLinks } from '@northmes/core-contracts';
import type { Locator, Page } from '@playwright/test';
import { devUsers } from '../scripts/stack/seed.mjs';
import { expect, plant, test } from './fixtures.ts';

// The screenshots on the docs site come from the seeded demo data, so they show no customer data
// and can be taken again with one command when a screen changes. `pnpm docs:screenshots` sets
// NORTHMES_DOCS_SCREENSHOTS and writes the PNGs into apps/docs/images; in every other run these
// tests only check that the pages they show still render.

const writeImages = process.env.NORTHMES_DOCS_SCREENSHOTS === '1';
const images = fileURLToPath(new URL('../apps/docs/images/', import.meta.url));

/**
 * Saves the page as apps/docs/images/<name>.png when the run takes the docs screenshots, once
 * nothing on the page is still loading. A menu or a sheet that opens fades in, so `popup` names
 * it, and the picture waits until it shows at full opacity with no transition left.
 */
async function docsImage(page: Page, name: string, popup?: Locator): Promise<void> {
  if (!writeImages) return;
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  if (popup !== undefined) {
    await expect
      .poll(() =>
        popup.evaluate(
          (element) =>
            getComputedStyle(element).opacity === '1' &&
            element.getAnimations({ subtree: true }).length === 0,
        ),
      )
      .toBe(true);
  }
  await page.screenshot({ path: `${images}${name}.png` });
}

test.describe('the docs screenshots', () => {
  test('ADR0048 the install guide shows the sign-in page', async ({ page, checkA11y }) => {
    // Signed out, every app page shows the sign-in page first.
    await page.goto(coreLinks.dashboard({ plant }).href);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Sign in to NorthMES' }),
    ).toBeVisible();
    await checkA11y('the sign-in page');
    await docsImage(page, 'install/sign-in');
  });

  test('ADR0048 the docs home shows the plant dashboard', async ({ page, signIn }) => {
    await signIn(coreLinks.dashboard({ plant }).href);
    await expect(page.getByRole('tab', { name: 'Company overview' })).toBeVisible();
    await docsImage(page, 'dashboard');
  });

  // No other spec opens the plant switcher, so its axe check (ADR 0021) runs here.
  test('ADR0048 the sign-in guide shows the plant switcher open, which passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(coreLinks.dashboard({ plant }).href);
    await page.getByRole('button', { name: 'Demo Works, Plant A, switch plant' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Plant B' })).toBeVisible();
    await expect(menu).toHaveCSS('opacity', '1');
    await checkA11y('the plant switcher open');
    await docsImage(page, 'use/plant-switcher', menu);
  });

  // No other spec reaches the company's users, a user's Access tab or the roles, so their axe checks
  // (ADR 0021) run here.
  test('ADR0048 the users guide shows the users, a user and the roles, each passing the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(coreLinks.settings.users({ plant }).href);
    await expect(page.getByRole('row', { name: /Alex Lund/ })).toBeVisible();
    await checkA11y('the users of the company');
    await docsImage(page, 'use/users');

    await page.goto(
      coreLinks.settings.users.user({ plant, userId: devUsers.planner.id }, { tab: 'access' }).href,
    );
    await expect(page.getByRole('table', { name: 'Roles of Alex Lund' })).toBeVisible();
    await checkA11y("a user's Access tab");
    await docsImage(page, 'use/user-access');

    await page.goto(coreLinks.settings.roles({ plant }).href);
    await expect(page.getByRole('row', { name: /Plant admin/ })).toBeVisible();
    await checkA11y('the roles of the company');
    await docsImage(page, 'use/roles');
  });

  test('ADR0048 the articles guide shows the list, a grouped list and an article', async ({
    page,
    signIn,
  }) => {
    await signIn(coreLinks.articles({ plant }).href);
    await expect(page.getByRole('row', { name: /HG-520/ })).toBeVisible();
    await docsImage(page, 'use/articles');

    await page.goto(`${coreLinks.articles({ plant }).href}?group=stockUnit`);
    await page.getByRole('button', { name: unitOf('PIECE').label }).click();
    await expect(page.getByRole('link', { name: 'BR-140' })).toBeVisible();
    await docsImage(page, 'use/articles-grouped');

    await page.getByRole('link', { name: 'BR-140' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Article BR-140' })).toBeVisible();
    await docsImage(page, 'use/article');
  });

  test('ADR0048 the dashboard guide shows a tab in edit mode and the widget catalog', async ({
    page,
    signIn,
  }) => {
    await signIn(coreLinks.dashboard({ plant }).href);
    await page.getByRole('tab', { name: 'My shift' }).click();
    await page.getByRole('button', { name: 'Edit layout' }).click();
    await expect(page.getByRole('region', { name: 'Edit layout' })).toContainText(
      'Editing My shift.',
    );
    await docsImage(page, 'use/dashboard-edit');

    await page.getByRole('button', { name: 'Add widget' }).click();
    const catalog = page.getByRole('dialog', { name: 'Add widget' });
    await expect(catalog.getByRole('heading', { name: 'Chart' })).toBeVisible();
    await docsImage(page, 'use/widget-catalog', catalog);
  });
});
