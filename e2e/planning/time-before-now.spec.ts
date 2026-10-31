// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import type { Locator, Page } from '@playwright/test';
import { expect, plant, test } from '../fixtures.ts';

// The time before now on the order Gantt and the planning board (ADR 0089, Time before now; #894):
// the time area before the now line takes a past tone in both themes, which passes the WCAG 2.2 AA
// rules of ADR 0021, and a drag whose start would fall before now shows the PAST refusal in its
// tooltip, is refused on the drop and leaves the draft empty. G1's now is Mon 2 Nov 09:40.

/** A planning page of the seed plant with its search. */
function planningHref(page: 'gantt' | 'board', search: Record<string, string>): string {
  return `${planningLinks[page]({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

/**
 * Puts the page in the D1 dark theme, as the theme switch does, or back in the light one, and
 * waits for the color transitions it starts, so axe reads the theme's colors.
 */
async function setTheme(locator: Locator, theme: 'light' | 'dark') {
  await locator.evaluate((_, value) => {
    if (value === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
  }, theme);
  // A color transition nested in another one, such as the order filter's controls in its field, is
  // cancelled and started again while the theme changes, so the wait is for no animation left.
  await expect.poll(() => locator.evaluate(() => document.getAnimations().length)).toBe(0);
}

/** The box of an element in the viewport. */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('The element is not drawn');
  return box;
}

/**
 * Presses a block at its middle and drags it in steps, along its row, until its left edge lies
 * 40 px before the now line, and holds it there.
 */
async function dragIntoPast(page: Page, block: Locator, now: Locator): Promise<void> {
  await block.scrollIntoViewIfNeeded();
  const from = await boxOf(block);
  const nowX = (await boxOf(now)).x;
  const x = from.x + from.width / 2;
  const y = from.y + from.height / 2;
  const dx = nowX - 40 - from.x;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1) {
    await page.mouse.move(x + (dx * step) / 10, y);
  }
}

const refusal = 'Cannot move 1001.10: it would start before now.';

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('the time before now', () => {
  test('#894 the order Gantt tones the time before now in both themes, and a drag into it is refused with PAST', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(planningHref('gantt', { zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();
    const past = gantt.locator('[data-row-id="jo-1001-10"] [data-past]');
    await expect(past).toBeVisible();
    const now = gantt.locator('[data-overlay] [data-marker="now"]');
    // The tone runs from the range start to the now line.
    expect(
      Math.abs((await boxOf(past)).x + (await boxOf(past)).width - (await boxOf(now)).x),
    ).toBeLessThanOrEqual(1);
    await checkA11y('the Gantt with the time before now in the light theme');
    await setTheme(gantt, 'dark');
    await checkA11y('the Gantt with the time before now in the dark theme');
    await setTheme(gantt, 'light');

    const block = gantt.locator('[data-block="jo-1001-10"]');
    await dragIntoPast(page, block, now);

    const tooltip = gantt.locator('[data-drag-tooltip]');
    await expect(tooltip).toHaveText(refusal);
    await expect(gantt.locator('[data-move-preview="jo-1001-10"]')).toHaveAttribute(
      'data-refused',
      'PAST',
    );
    await page.mouse.up();

    await expect(page.locator('#announcer-polite')).toHaveText(refusal);
    await expect(tooltip).toHaveCount(0);
    // My draft stays out of the bar: the refused drop left the draft without changes (ADR 0090).
    await expect(page.getByRole('button', { name: /^My draft/ })).toHaveCount(0);
  });

  test('#894 the planning board tones the time before now in both themes, and a drag into it is refused with PAST', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(planningHref('board', { zoom: 'week', from: '2026-11-02' }));
    const board = page.getByRole('grid', { name: /board/ });
    await expect(board).toBeVisible();
    await expect(board).not.toHaveAttribute('aria-busy', 'true');
    const row = board.getByRole('rowheader', { name: 'CNC 1' }).locator('xpath=..');
    const past = row.locator('[data-past]');
    await expect(past).toBeVisible();
    await checkA11y('the board with the time before now in the light theme');
    await setTheme(board, 'dark');
    await checkA11y('the board with the time before now in the dark theme');
    await setTheme(board, 'light');

    const block = board.locator('[role="gridcell"][data-job-order="1001.10"]');
    await dragIntoPast(page, block, board.locator('[data-marker="now"]'));

    const tooltip = board.locator('[data-drag-tooltip]');
    await expect(tooltip).toHaveText(refusal);
    await expect(board.locator('[data-move-preview="jo-1001-10"]')).toHaveAttribute(
      'data-refused',
      'PAST',
    );
    await page.mouse.up();

    await expect(page.locator('#announcer-polite')).toHaveText(refusal);
    await expect(tooltip).toHaveCount(0);
    // My draft stays out of the bar: the refused drop left the draft without changes (ADR 0090).
    await expect(page.getByRole('button', { name: /^My draft/ })).toHaveCount(0);
  });
});
