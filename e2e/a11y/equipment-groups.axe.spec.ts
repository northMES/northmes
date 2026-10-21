// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the equipment groups pages (design #729, EG1 to EG9): the list
// with its Scope menu open, a group's page, the edit form with a color picked, the list and the
// page at 320 px, and the list's loading, empty, failed and no-access states. The pages read the
// fixture G1, so every state is the same in every run; the preview key opens the states on mock
// data.

/** An href with a search. */
function withSearch(href: string, search: Record<string, string>): string {
  return `${href}?${new URLSearchParams(search).toString()}`;
}

test.describe('the equipment groups pages', () => {
  test('#729 ADR0021 each state of the equipment groups pages passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const groups = coreLinks.equipmentGroups({ plant }).href;
    const mach = coreLinks.equipmentGroups.group({ plant, groupCode: 'MACH' }).href;
    await signIn(groups);
    await expect(page.getByRole('table', { name: 'Equipment groups of Plant A' })).toBeVisible();
    await checkA11y('the equipment groups list');

    await page.locator('button[aria-haspopup="menu"]', { hasText: /^Scope/ }).click();
    await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
    await checkA11y('the Scope menu open');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.goto(mach);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Equipment group MACH' }),
    ).toBeVisible();
    await checkA11y('an equipment group');

    await page.goto(coreLinks.equipmentGroups.group.edit({ plant, groupCode: 'MACH' }).href);
    await page.getByRole('radio', { name: 'Color 12' }).click();
    await expect(page.getByRole('radio', { name: 'Color 12' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await checkA11y('the edit form with a color picked');

    // At 320 px the list and the group's machines scroll sideways in focusable regions.
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(groups);
    await expect(
      page.getByRole('region', { name: 'Equipment groups, scrolls sideways' }),
    ).toBeVisible();
    await checkA11y('the equipment groups list at 320 px');
    await page.goto(mach);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Equipment group MACH' }),
    ).toBeVisible();
    await checkA11y('an equipment group at 320 px');
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto(withSearch(groups, { preview: 'loading' }));
    await expect(page.getByRole('table', { name: 'Equipment groups' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await checkA11y('the equipment groups list loading', { busy: true });

    await page.goto(withSearch(groups, { preview: 'empty' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'No equipment groups yet' }),
    ).toBeVisible();
    await checkA11y('the equipment groups list empty');

    await page.goto(withSearch(groups, { preview: 'error' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'Could not load equipment groups' }),
    ).toBeVisible();
    await checkA11y('the equipment groups list failed');

    await page.goto(withSearch(groups, { preview: 'forbidden' }));
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'You need the permission to manage the settings of this plant',
      }),
    ).toBeVisible();
    await checkA11y('the equipment groups list without access');
  });
});
