// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import type { Locator, Page } from '@playwright/test';
import { expect, plant, test } from '../fixtures.ts';

// The slim bar above the timeline (ADR 0090, The bar above the timeline; #939): on the order Gantt
// and the planning board the page title and the bar share one row and the grid fills the rest of
// the viewport; the zoom buttons sit over the time area and keep focus; Alt+Page Down moves one
// viewport width in time; the View menu works from the keyboard; My draft shows only with changes.
// Both views read the fixture G1.

test.use({ viewport: { width: 1280, height: 800 } });

/** A planning page of the seed plant with its search. */
function href(page: 'gantt' | 'board', search: Record<string, string>): string {
  return `${planningLinks[page]({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

/** The box of an element, once it is laid out. */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('The element is not laid out');
  return box;
}

/** The hours the URL's `from` lies after a start, both read as local times. */
function hoursAfter(page: Page, start: string): number {
  const from = new URL(page.url()).searchParams.get('from');
  return from === null ? 0 : (Date.parse(from) - Date.parse(start)) / 3_600_000;
}

/** The grid starts no lower than one bar row under the title row, and fills the viewport. */
async function expectGridUnderTitle(page: Page, grid: Locator, bar: Locator) {
  const heading = await boxOf(page.getByRole('heading', { level: 1 }));
  const barBox = await boxOf(bar);
  const gridBox = await boxOf(grid);
  // The bar is on the title row.
  expect(barBox.y).toBeLessThan(heading.y + heading.height);
  const titleRowBottom = Math.max(heading.y + heading.height, barBox.y + barBox.height);
  expect(gridBox.y - titleRowBottom).toBeLessThanOrEqual(barBox.height);
  // The grid reaches down to near the bottom of the viewport.
  expect(gridBox.y + gridBox.height).toBeGreaterThan(800 - 48);
}

test.describe('the slim bar above the timeline', () => {
  test('#939 on the Gantt the grid starts right under the title row, the View menu works from the keyboard, and each state passes axe', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(href('gantt', { from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
    const bar = page.getByRole('toolbar', { name: 'Gantt' });

    await expectGridUnderTitle(page, gantt, bar);
    await expect(bar.getByRole('button', { name: /^My draft/ })).toHaveCount(0);
    await checkA11y('the Gantt with the slim bar and no draft');

    const view = bar.getByRole('button', { name: 'View' });
    await view.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    const hide = menu.getByRole('menuitemcheckbox', { name: 'Hide closed time' });
    await expect(hide).toBeVisible();
    await checkA11y('the Gantt View menu');
    // The arrow keys reach Hide closed time and Space turns it.
    for (let step = 0; step < 6; step += 1) {
      if (await hide.evaluate((element) => element === document.activeElement)) break;
      await page.keyboard.press('ArrowDown');
    }
    await expect(hide).toBeFocused();
    await page.keyboard.press('Space');
    await expect(hide).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(view).toBeFocused();
  });

  test('#939 My draft shows with a change, passes axe, and leaves the bar with focus on Go to now once the draft is discarded', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await page.addInitScript(() =>
      window.localStorage.setItem(
        'northmes.planning.gantt.options',
        JSON.stringify({ cascade: false }),
      ),
    );
    await signIn(href('gantt', { zoom: 'day', from: '2026-11-04' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
    await gantt.locator('[data-row-id="jo-1003-10"]').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('m');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    const myDraft = page.getByRole('button', { name: 'My draft, 1 change' });
    await expect(myDraft).toBeVisible();
    await checkA11y('the Gantt with My draft in the bar');
    await myDraft.click();
    const drawer = page.locator('[role="dialog"][data-draft-drawer]');
    await drawer.getByRole('button', { name: 'Discard draft' }).click();
    await page.getByRole('button', { name: 'Discard 1 change' }).click();
    await expect(drawer.getByText('No changes in your draft')).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('button', { name: /^My draft/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Go to now' })).toBeFocused();
  });

  test('#939 the zoom buttons over the time area keep focus, and a focused block scrolled into view is never under them', async ({
    page,
    signIn,
  }) => {
    await signIn(href('gantt', { from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
    const zoom = page.getByRole('group', { name: 'Zoom' });
    const zoomIn = zoom.getByRole('button', { name: 'Zoom in' });

    await zoomIn.click();
    await expect(page).toHaveURL(/zoom=32\b/);
    await expect(zoomIn).toBeFocused();

    // A block put under the buttons' corner, then focused, is scrolled out from under them.
    const target = gantt.locator('[data-block="jo-1004-20"]');
    await target.scrollIntoViewIfNeeded();
    const overlay = await boxOf(zoom);
    const before = await boxOf(target);
    await gantt.evaluate(
      (element, shift) => {
        element.scrollLeft -= shift.x;
        element.scrollTop -= shift.y;
      },
      {
        x: overlay.x + overlay.width / 2 - before.x,
        y: overlay.y + overlay.height / 2 - (before.y + before.height / 2),
      },
    );
    await target.focus();
    const blockBox = await boxOf(target);
    const covered =
      blockBox.x < overlay.x + overlay.width &&
      blockBox.x + blockBox.width > overlay.x &&
      blockBox.y < overlay.y + overlay.height &&
      blockBox.y + blockBox.height > overlay.y;
    expect(covered).toBe(false);
  });

  test('#939 Alt+Page Down scrolls the Gantt one viewport width later and keeps focus on the row', async ({
    page,
    signIn,
  }) => {
    await signIn(href('gantt', { from: '2026-11-02T00:00' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
    const row = gantt.locator('[data-row-id="po-1003"]');
    await row.focus();

    await page.keyboard.press('Alt+PageDown');

    await expect
      .poll(() => new URL(page.url()).searchParams.get('from'))
      .toMatch(/^2026-11-0[4-9]T/);
    await expect(row).toBeFocused();
  });

  test('#939 on the board the grid starts right under the title row, with no View menu, and Alt+Page Down keeps focus in the row', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(href('board', { from: '2026-11-02T00:00' }));
    const board = page.getByRole('grid', { name: /board/ });
    await expect(board).not.toHaveAttribute('aria-busy', 'true');
    const bar = page.getByRole('toolbar', { name: 'Board' });

    await expectGridUnderTitle(page, board, bar);
    await expect(bar.getByRole('button', { name: 'View' })).toHaveCount(0);
    await expect(bar.getByRole('button', { name: /^My draft/ })).toHaveCount(0);
    await checkA11y('the board with the slim bar');

    const block = board.locator('[data-job-order="1001.10"]');
    const machineRow = block.locator('xpath=ancestor::*[@role="row"][1]');
    const rowName = await machineRow.getAttribute('aria-rowindex');
    // One viewport width of the time area at 16 px an hour, which is narrower than the grid.
    const widestHours = (await boxOf(board)).width / 16;
    await block.focus();
    await page.keyboard.press('Alt+PageDown');

    await expect.poll(() => hoursAfter(page, '2026-11-02T00:00')).toBeGreaterThan(24);
    expect(hoursAfter(page, '2026-11-02T00:00')).toBeLessThan(widestHours);
    const focusedRow = page.locator(':focus').locator('xpath=ancestor::*[@role="row"][1]');
    await expect(focusedRow).toHaveAttribute('aria-rowindex', rowName ?? '');
  });

  test("#939 My draft shows in the board's bar with a change, and passes axe", async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(href('board', { from: '2026-11-02' }));
    const board = page.getByRole('grid', { name: /board/ });
    await expect(board).not.toHaveAttribute('aria-busy', 'true');
    await board.locator('[role="gridcell"][data-job-order="1001.10"]').focus();
    await page.keyboard.press('m');
    await page.keyboard.press('ArrowRight');
    await expect(board.locator('[data-move-preview="jo-1001-10"]')).toHaveCount(1);
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('toolbar', { name: 'Board' }).getByRole('button', { name: /^My draft, / }),
    ).toBeVisible();
    await checkA11y('the board with My draft in the bar');
  });
});
