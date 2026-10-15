import { coreLinks } from '@northmes/core-contracts';
import type { Page } from '@playwright/test';
import { expect, plant, test } from './fixtures.ts';

// The screenshots on the docs site come from the seeded demo data, so they show no customer data
// and can be taken again with one command when a screen changes. `pnpm docs:screenshots` sets
// NORTHMES_DOCS_SCREENSHOTS and writes the PNGs into apps/docs/images; in every other run these
// tests only check that the pages they show still render.

const writeImages = process.env.NORTHMES_DOCS_SCREENSHOTS === '1';

/** Saves the page as apps/docs/images/<name>.png when the run takes the docs screenshots. */
async function docsImage(page: Page, name: string): Promise<void> {
  await page.screenshot(writeImages ? { path: `apps/docs/images/${name}.png` } : {});
}

test.describe('the docs screenshots', () => {
  test('ADR0048 the install guide shows the sign-in page', async ({ page, checkA11y }) => {
    await page.goto('/sign-in');
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
});
