// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import type { Page } from '@playwright/test';
import { signInPath } from '../apps/web/src/auth/sign-in-link.ts';
import { allPagesHref } from '../apps/web/src/shell/shell-pages.ts';
import { devAdmin, devUsers, seedPlants } from '../scripts/stack/seed.mjs';
import { expect, plant, test } from './fixtures.ts';

/** Signs a seed user in on the sign-in page, from a client address of its own (#476). */
async function signInAs(
  page: Page,
  user: { readonly email: string; readonly password: string },
  address: string,
  href = signInPath,
) {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': address });
  await page.goto(href);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe('the landing at /', () => {
  test('#648 #872 signing in with the seed plants lands on Your plants, which asks the user to pick a plant and opens one', async ({
    page,
    checkA11y,
  }) => {
    // The dev admin holds a role at the company, so both seed plants are open to them.
    await signInAs(page, devAdmin, '10.1.0.1');

    await expect(page.getByRole('heading', { level: 1, name: 'Your plants' })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page).toHaveTitle('Your plants · NorthMES');
    await expect(page.getByText('Pick the plant to work in.')).toBeVisible();
    for (const { name } of seedPlants) {
      await expect(page.getByRole('main').getByRole('link', { name })).toBeVisible();
    }
    await checkA11y('landing plant picker');

    const plantA = seedPlants.find(({ slug }) => slug === plant);
    await page
      .getByRole('main')
      .getByRole('link', { name: plantA?.name ?? '' })
      .click();
    await page.waitForURL((url) => url.pathname === coreLinks.dashboard({ plant }).href);
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  });

  test('#872 signing in with one plant lands on that plant, the dashboard', async ({ page }) => {
    // The seed's viewer holds a role at plant A alone.
    await signInAs(page, devUsers.viewer, '10.1.0.2');
    await page.waitForURL((url) => url.pathname === coreLinks.dashboard({ plant }).href);
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  });

  test('#872 the redirect key of sign-in still leads a user with one plant to the page it names', async ({
    page,
  }) => {
    const allPages = allPagesHref(plant);
    await signInAs(page, devUsers.viewer, '10.1.0.3', `${signInPath}?redirect=${allPages}`);
    await page.waitForURL((url) => url.pathname === allPages);
    await expect(page.getByRole('heading', { level: 1, name: 'All pages' })).toBeVisible();
  });
});
