// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The keyboard of the planning board grid (plan 07, Grid semantics and focus; design D3, TA10
// and TA11): one Tab stop that enters at the job order nearest now, the arrow keys along and
// between machine rows, the row header column and the group button. The board reads the fixture
// G1, so the cells are the same in every run.

/** The board page of the seed plant with its search. */
function boardHref(search: Record<string, string>): string {
  return `${planningLinks.board({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

test.describe('the planning board keyboard', () => {
  test('ADR0021 Tab enters the grid once, the arrow keys move between job orders and rows, and focus stays clear of the sticky axes', async ({
    page,
    signIn,
  }) => {
    await signIn(boardHref({ zoom: 'week', from: '2026-11-02' }));
    // The grid's skeleton has the same role and name while it loads, so wait for it to be done.
    const board = page.getByRole('grid', { name: /board/ });
    await expect(board).toBeVisible();
    await expect(board).not.toHaveAttribute('aria-busy', 'true');
    const cell = (job: string) => board.locator(`[role="gridcell"][data-job-order="${job}"]`);

    await expect(board.locator('[tabindex="0"]')).toHaveCount(1);
    await cell('1001.10').focus();
    await page.keyboard.press('End');
    await expect(cell('1004.10')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(cell('1001.20')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(board.getByRole('rowheader', { name: 'CNC 2' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('button', { name: 'Collapse Machining' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await expect(cell('1001.10')).toBeFocused();

    // The focused block lies inside the scroller, past the sticky machine column (WCAG 2.4.11).
    await page.keyboard.press('End');
    const grid = await board.boundingBox();
    const block = await cell('1004.10').boundingBox();
    const column = await board.getByRole('rowheader', { name: 'CNC 1' }).boundingBox();
    expect(grid !== null && block !== null && column !== null).toBe(true);
    if (grid === null || block === null || column === null) return;
    expect(block.x).toBeGreaterThanOrEqual(column.x + column.width);
    expect(block.x).toBeLessThan(grid.x + grid.width);

    // Tab leaves the grid.
    await page.keyboard.press('Tab');
    await expect(board.locator(':focus')).toHaveCount(0);
  });
});
