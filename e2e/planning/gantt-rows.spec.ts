// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import type { Locator, Page } from '@playwright/test';
import { expect, plant, test } from '../fixtures.ts';

// The order Gantt's tree has two levels (plan 18, Rows and the tree; Krister, 2026-11-05): the
// production order, then one row per job order directly under it. The Gantt reads the fixture G1,
// where every operation has one job order.

/** The Gantt page of the seed plant with its search. */
function ganttHref(search: Record<string, string>): string {
  return `${planningLinks.gantt({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

/** Opens the Gantt at week 45 and waits until the blocks are in. */
async function openGantt(page: Page, signIn: (href: string) => Promise<void>): Promise<Locator> {
  await signIn(ganttHref({ zoom: 'week', from: '2026-11-02' }));
  const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
  await expect(gantt).toBeVisible();
  // The blocks come with their time chunks (ADR 0089); the grid is busy until they are in.
  await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
  return gantt;
}

test.describe('the rows of the order Gantt', () => {
  test('plan 18 G1 shows 6 order rows of 36 px at level 1 and 10 job order rows of 52 px at level 2, headed by operation, machine, quantity and status', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const gantt = await openGantt(page, signIn);

    await expect(gantt.locator('[role="row"][aria-level="1"]')).toHaveCount(6);
    await expect(gantt.locator('[role="row"][aria-level="2"]')).toHaveCount(10);
    await expect(gantt.locator('[role="row"][aria-level="3"]')).toHaveCount(0);
    const order = gantt.locator('[data-row-id="po-1003"]');
    const turn = gantt.locator('[data-row-id="jo-1003-10"]');
    await expect(turn.getByRole('rowheader')).toContainText('1003.10 Turn');
    await expect(turn.getByRole('rowheader')).toContainText('CNC 1, 600 pcs, Planned');
    expect((await order.boundingBox())?.height).toBeCloseTo(36, 0);
    expect((await turn.boundingBox())?.height).toBeCloseTo(52, 0);
    await checkA11y('the Gantt with order rows and job order rows');
  });

  test('plan 18 Down goes from an order to its first job order, Left back to the order, and Left again collapses it', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const gantt = await openGantt(page, signIn);
    const order = gantt.locator('[data-row-id="po-1003"]');
    const turn = gantt.locator('[data-row-id="jo-1003-10"]');

    await order.focus();
    await page.keyboard.press('ArrowDown');
    await expect(turn).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(order).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(order).toHaveAttribute('aria-expanded', 'false');
    await expect(turn).toHaveCount(0);
    await expect(gantt.locator('[role="row"][aria-level="2"]')).toHaveCount(8);
    await checkA11y('the Gantt with an order collapsed');
  });
});
