// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The keyboard of the planning board grid (plan 07, Grid semantics and focus, Gates; design D3,
// TA10, TA11, IN6 to IN8): one Tab stop that enters at the job order nearest now, the arrow keys
// along and between machine rows, the row header column and the group button; move mode, which
// changes the machine and the start and announces both, the My draft drawer, the block menu and
// the Move dialog. The board reads the fixture G1, so the cells are the same in every run.

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

  test('ADR0021 move mode changes the machine and the start, announces both and puts the move in the draft', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(boardHref({ zoom: 'week', from: '2026-11-02' }));
    // The grid's skeleton has the same role and name while it loads, so wait for it to be done.
    const board = page.getByRole('grid', { name: /board/ });
    await expect(board).not.toHaveAttribute('aria-busy', 'true');
    const spoken = page.locator('#announcer-polite');
    const block = board.locator('[role="gridcell"][data-job-order="1001.10"]');
    await expect(block).toBeVisible();
    await block.focus();

    await page.keyboard.press('m');
    await expect(block).toHaveAttribute('data-move-mode', 'true');
    await checkA11y('move mode on the board');
    // Tue 11:30 plus a Week step of 4 h is Tue 15:30, closed, so the first step lands at Wed 06:00;
    // the second steps from there to Wed 10:00. Down steps to CNC 2, the next allowed machine.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await expect(spoken).toHaveText(
      'CNC 2, Wed 4 Nov 10:00 to Thu 5 Nov 07:00. 1 row moves with it. Not saved.',
    );
    await page.keyboard.press('Enter');
    await expect(spoken).toHaveText(
      '1001.10 moved to CNC 2, Wed 4 Nov 10:00 to Thu 5 Nov 07:00. 1 row moves with it. Not saved.',
    );
    const moved = board.locator('[role="gridcell"][data-job-order="1001.10"]');
    await expect(moved).toBeFocused();
    await expect(moved).toHaveAttribute('data-states', /draft/);
    await expect(page.getByRole('button', { name: 'My draft, 2 changes' })).toBeVisible();
    await checkA11y('a job order changed in the draft on the board');

    await page.getByRole('button', { name: 'My draft, 2 changes' }).click();
    const drawer = page.locator('[role="dialog"][data-draft-drawer]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveCSS('opacity', '1');
    await checkA11y('the My draft drawer on the board');
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    // The block menu and the Move dialog (D3 IN7, IN8).
    await board.locator('[role="gridcell"][data-job-order="1003.10"]').focus();
    await page.keyboard.press('Shift+F10');
    const menu = page.getByRole('menu', { name: 'Actions for 1003.10' });
    await expect(menu).toBeVisible();
    await checkA11y('the block menu');
    await page.getByRole('menuitem', { name: 'Move' }).click();
    const dialog = page.getByRole('dialog', { name: /^Move 1003\.10/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS('opacity', '1');
    // Focus starts on the current machine and stays in the dialog once the menu has faded out.
    await expect(dialog.getByRole('radio', { checked: true })).toBeFocused();
    await checkA11y('the Move dialog');
    await expect(dialog.getByRole('radio', { checked: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(board.locator('[role="gridcell"][data-job-order="1003.10"]')).toBeFocused();
  });
});
