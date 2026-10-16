// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { devAdmin, seedPlants } from '../scripts/stack/seed.mjs';
import { expect, plant, test } from './fixtures.ts';

test.describe('the landing at /', () => {
  test('#648 signing in at /sign-in lands on Your plants, which lists the seed plants and opens one', async ({
    page,
    checkA11y,
  }) => {
    // A client address of its own, as the signIn fixture gives each sign-in (#476).
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': '10.1.0.1' });
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(devAdmin.email);
    await page.getByLabel('Password', { exact: true }).fill(devAdmin.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Your plants' })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page).toHaveTitle('Your plants · NorthMES');
    for (const { name } of seedPlants) {
      await expect(page.getByRole('main').getByRole('link', { name })).toBeVisible();
    }
    await checkA11y('landing plant list');

    const plantA = seedPlants.find(({ slug }) => slug === plant);
    await page
      .getByRole('main')
      .getByRole('link', { name: plantA?.name ?? '' })
      .click();
    await page.waitForURL((url) => url.pathname === coreLinks.dashboard({ plant }).href);
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  });
});
