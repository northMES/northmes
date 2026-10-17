// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the states of the order Gantt (plan 18, Gates): populated, an
// expanded order with its links, the chain highlight and the workload table. The Gantt reads the
// fixture G1 in phase 1, so every state is the same in every run. Move mode and the 640 px tabs
// come with the moves of phase 2.

/** The board href of the seed plant with the Gantt's search. */
function ganttHref(search: Record<string, string>): string {
  return `${planningLinks.board({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

test.describe('the order Gantt', () => {
  test('ADR0021 each state of the order Gantt passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(ganttHref({ view: 'gantt', zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();
    await expect(page.getByText('Showing fixture G1.')).toBeVisible();
    await checkA11y('the populated Gantt');

    await page.getByRole('button', { name: 'Collapse order 1001' }).click();
    await expect(page.getByRole('button', { name: 'Expand order 1001' })).toBeVisible();
    await checkA11y('a collapsed order');
    await page.getByRole('button', { name: 'Expand order 1001' }).click();
    await expect(gantt.locator('[data-link="jo-1001-10-jo-1001-20"]')).toHaveCount(1);
    await checkA11y('an expanded order with its links');

    await page.goto(
      ganttHref({ view: 'gantt', zoom: 'week', from: '2026-11-02', order: 'po-1003', chain: '1' }),
    );
    await expect(gantt).toBeVisible();
    // The row's name in Chromium starts with its disclosure button, so the row is found by id.
    await gantt.locator('[data-row-id="po-1003"] [role="rowheader"]').click();
    await expect(
      page.getByRole('region', { name: 'Critical chain, 3 rows, root 1001.10 on CNC 1' }),
    ).toBeVisible();
    await checkA11y('the chain highlight with its explanation');

    await page.getByRole('button', { name: 'Board options' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Workload' }).click();
    await page.keyboard.press('Escape');
    // The menu fades out; axe must not read its text mid-transition.
    await expect(page.getByRole('menu')).toHaveCount(0);
    await page.getByRole('button', { name: 'Workload on CNC 1' }).click();
    await expect(page.getByRole('dialog', { name: 'Workload on CNC 1' })).toBeVisible();
    await checkA11y('the workload panel with the table of CNC 1 open');
  });
});
