// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// Keyboard move mode on the order Gantt (plan 18, Gates): expand an order with Right, enter move
// mode on a job order row, step a machine with Down and two snaps with Right, Enter; the moved
// block is focused, lies inside the scroller, and the spoken text names the span and the cascade
// count. The Gantt reads the fixture G1, so the instants are the ones of GT1.

/** The Gantt page of the seed plant with its search. */
function ganttHref(search: Record<string, string>): string {
  return `${planningLinks.gantt({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

test.describe('keyboard move mode on the order Gantt', () => {
  test('ADR0021 a move by keyboard changes the machine and the start, announces both and keeps focus on the block', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(ganttHref({ zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();
    // The blocks come with their time chunks (ADR 0089); the grid is busy until they are in.
    await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
    const spoken = page.getByRole('status');

    // Collapse order 1001 and expand it again from the keyboard, then walk into its first row.
    await page.getByRole('button', { name: 'Collapse order 1001' }).click();
    const orderRow = gantt.locator('[data-row-id="po-1001"]');
    await orderRow.focus();
    await page.keyboard.press('ArrowRight');
    await expect(orderRow).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(gantt.locator('[data-row-id="jo-1001-10"]')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    const block = gantt.locator('[data-block="jo-1001-10"]');
    await expect(block).toBeFocused();

    await page.keyboard.press('m');
    await expect(block).toHaveAttribute('data-move-mode', 'true');
    await checkA11y('move mode on a job order row');
    // Tue 11:30 plus a Week step of 4 h is Tue 15:30, closed, so the first step lands at Wed 06:00;
    // the second steps from there to Wed 10:00.
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
    await expect(block).toBeFocused();
    await expect(block).not.toHaveAttribute('data-move-mode', 'true');
    await expect(block).toHaveAttribute('aria-label', /CNC 2, Wed 4 Nov 10:00 to Thu 5 Nov 07:00/);
    await expect(block).toHaveAttribute('aria-label', /changed in your draft, not saved/);
    // The moved block lies inside the grid's scroller, not under the sticky tree pane.
    const inside = await block.evaluate((element) => {
      const grid = element.closest('[role="treegrid"]') as HTMLElement;
      const tree = grid.querySelector('[role="rowheader"]') as HTMLElement;
      const rect = element.getBoundingClientRect();
      const gridRect = grid.getBoundingClientRect();
      return rect.left >= tree.getBoundingClientRect().right && rect.right <= gridRect.right;
    });
    expect(inside).toBe(true);
    await expect(page.getByRole('button', { name: 'My draft, 2 changes' })).toBeVisible();
    await checkA11y('a row changed in the draft');

    // Focus on the moved block keeps its hover card open, and the card lists the plant's hover
    // fields (#762), so it can cover the toolbar. Escape closes it and keeps focus (D3, IN2).
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(block).toBeFocused();
    await page.getByRole('button', { name: 'My draft, 2 changes' }).click();
    const drawer = page.locator('[role="dialog"][data-draft-drawer]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveCSS('opacity', '1');
    await expect(drawer.getByRole('heading', { level: 2 })).toHaveText('My draft, 2 changes');
    await expect(drawer.getByRole('button', { name: 'Save changes' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await checkA11y('the My draft drawer');
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    // Moving without dragging (WCAG 2.5.7): Move in Details, Later, Apply.
    await gantt.locator('[data-block="jo-1003-10"]').dblclick();
    const details = page.locator('[role="dialog"][data-details-drawer]');
    await expect(details).toBeVisible();
    await expect(details).toHaveCSS('opacity', '1');
    // Move sits in the actions menu of the drawer's heading (#917).
    await details.getByRole('button', { name: 'Actions for 1003.10' }).click();
    await page.getByRole('menuitem', { name: 'Move', exact: true }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    const controls = details.getByRole('group', { name: 'Move 1003.10' });
    await expect(controls).toBeVisible();
    await controls.getByRole('button', { name: 'Later' }).click();
    await expect(controls).toContainText(
      'CNC 1, Wed 4 Nov 12:00 to Thu 5 Nov 07:00. 1 row moves with it.',
    );
    await checkA11y('the Move controls in Details');
    await controls.getByRole('button', { name: 'Apply' }).click();
    await expect(details).toBeHidden();
    await expect(gantt.locator('[data-block="jo-1003-10"]')).toBeFocused();
    await expect(page.getByRole('button', { name: 'My draft, 4 changes' })).toBeVisible();
  });
});
