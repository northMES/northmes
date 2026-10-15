// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { expect, plant, test } from './fixtures.ts';

// The axe check of ADR 0021 that every spec runs on the page states it reaches (#506).

test.describe('the accessibility check', () => {
  test('ADR0021 a WCAG 2.2 AA violation on an app page fails the check and names the rule', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(coreLinks.articles({ plant }).href);
    await expect(page.getByRole('heading', { level: 1, name: 'Articles' })).toBeVisible();

    await page.locator('main').evaluate((main) => {
      const button = document.createElement('button');
      button.type = 'button';
      main.append(button);
    });

    await expect(checkA11y('the articles list with a button without a name')).rejects.toThrow(
      /button-name/,
    );
  });
});
