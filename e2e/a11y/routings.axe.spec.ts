// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the routing pages (design #729, RO1 to RO8): the routings list,
// the routing of Bracket L with its planned duration panel, the edit form of operation 20, and the
// routing's loading, no-routing, failed and no-access states. The pages read the fixture G1, so
// every state is the same in every run; the preview key opens the states on mock data.

/** An href with a search. */
function withSearch(href: string, search: Record<string, string>): string {
  return `${href}?${new URLSearchParams(search).toString()}`;
}

test.describe('the routing pages', () => {
  test('#729 ADR0021 each state of the routing pages passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(coreLinks.routings({ plant }).href);
    await expect(page.getByRole('table', { name: 'Routings' })).toBeVisible();
    await checkA11y('the routings list');

    const bracket = coreLinks.routings.routing({ plant, articleNumber: '20-1001' }).href;
    await page.goto(bracket);
    await expect(page.getByRole('heading', { level: 1, name: 'Bracket L' })).toBeVisible();
    await expect(
      page.getByRole('group', { name: 'Planned duration of operation 20' }),
    ).toBeVisible();
    await checkA11y('the routing of Bracket L');

    // At 320 px the wide tables scroll sideways in their own focusable regions.
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(bracket);
    await expect(
      page.getByRole('region', { name: 'Allowed machines of operation 20, scrolls sideways' }),
    ).toBeVisible();
    await checkA11y('the routing of Bracket L at 320 px');
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto(
      coreLinks.routings.routing.editOperation({ plant, articleNumber: '20-1001', sequence: '20' })
        .href,
    );
    await expect(
      page.getByRole('heading', { level: 1, name: 'Edit operation 20 Mill' }),
    ).toBeVisible();
    await checkA11y('the edit form of a routing operation');

    await page.goto(withSearch(bracket, { preview: 'loading' }));
    await expect(page.locator('[aria-busy="true"]').first()).toBeVisible();
    await checkA11y('a routing loading', { busy: true });

    await page.goto(withSearch(bracket, { preview: 'empty' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'This article has no routing' }),
    ).toBeVisible();
    await checkA11y('an article without a routing');

    await page.goto(withSearch(bracket, { preview: 'error' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'Could not load the routing' }),
    ).toBeVisible();
    await checkA11y('a routing failed');

    await page.goto(withSearch(bracket, { preview: 'forbidden' }));
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'You need the permission to read routings at this plant',
      }),
    ).toBeVisible();
    await checkA11y('a routing without access');
  });
});
