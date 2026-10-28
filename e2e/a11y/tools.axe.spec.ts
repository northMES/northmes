// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the tools pages (design #729, TO1 to TO8): the tools list with
// its Scope menu open, a tool's page, the list's loading, empty, failed and no-access states, and
// a tool's loading, not-found, failed and no-access states.
// The pages read the fixture G1, so every state is the same in every run; the preview key opens
// the states on mock data.

/** An href with a search. */
function withSearch(href: string, search: Record<string, string>): string {
  return `${href}?${new URLSearchParams(search).toString()}`;
}

test.describe('the tools pages', () => {
  test('#729 ADR0021 each state of the tools pages passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const tools = coreLinks.tools({ plant }).href;
    await signIn(tools);
    await expect(page.getByRole('table', { name: 'Tools of Acme AB and Plant A' })).toBeVisible();
    await checkA11y('the tools list');

    await page.locator('button[aria-haspopup="menu"]', { hasText: /^Scope/ }).click();
    await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
    await checkA11y('the Scope menu open');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.goto(coreLinks.tools.tool({ plant, toolCode: 'T-311' }).href);
    await expect(page.getByRole('heading', { level: 1, name: 'Tool T-311' })).toBeVisible();
    await checkA11y('a tool');

    // At 320 px the list and the tool's operations scroll sideways in focusable regions.
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(tools);
    await expect(page.getByRole('region', { name: 'Tools, scrolls sideways' })).toBeVisible();
    await checkA11y('the tools list at 320 px');
    await page.goto(coreLinks.tools.tool({ plant, toolCode: 'T-311' }).href);
    await expect(page.getByRole('heading', { level: 1, name: 'Tool T-311' })).toBeVisible();
    await checkA11y('a tool at 320 px');
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto(withSearch(tools, { preview: 'loading' }));
    await expect(
      page.getByRole('table', { name: 'Tools of the company and the plant' }),
    ).toHaveAttribute('aria-busy', 'true');
    await checkA11y('the tools list loading', { busy: true });

    await page.goto(withSearch(tools, { preview: 'empty' }));
    await expect(page.getByRole('heading', { level: 2, name: 'No tools yet' })).toBeVisible();
    await checkA11y('the tools list empty');

    await page.goto(withSearch(tools, { preview: 'error' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'Could not load tools' }),
    ).toBeVisible();
    await checkA11y('the tools list failed');

    await page.goto(withSearch(tools, { preview: 'forbidden' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'You need the permission to read master data' }),
    ).toBeVisible();
    await checkA11y('the tools list without access');

    // A tool's page takes the same preview key, and a code no tool has shows its not-found state.
    const t311 = coreLinks.tools.tool({ plant, toolCode: 'T-311' }).href;
    await page.goto(withSearch(t311, { preview: 'loading' }));
    await expect(page.getByRole('heading', { level: 1, name: 'Tool T-311' })).toBeVisible();
    await expect(page.locator('[aria-busy="true"]').first()).toBeVisible();
    await checkA11y('a tool loading', { busy: true });

    await page.goto(coreLinks.tools.tool({ plant, toolCode: 'T-000' }).href);
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'This tool does not exist or you cannot see it',
      }),
    ).toBeVisible();
    await checkA11y('a tool that does not exist');

    await page.goto(withSearch(t311, { preview: 'error' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'Could not load the tool' }),
    ).toBeVisible();
    await checkA11y('a tool failed');

    await page.goto(withSearch(t311, { preview: 'forbidden' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'You need the permission to read master data' }),
    ).toBeVisible();
    await checkA11y('a tool without access');
  });
});
