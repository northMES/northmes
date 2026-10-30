// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import type { Locator } from '@playwright/test';
import { expect, plant, test } from '../fixtures.ts';

// The zoom of the planning board (ADR 0089, Zoom levels; #896), the same as the Gantt's: Ctrl+wheel
// over the time area steps one level and keeps the instant under the pointer at its x, the
// toolbar steps, picks and fits a level, and minus and plus step a level with focus in the grid.

/** The board page of the seed plant with its search. */
function boardHref(search: Record<string, string>): string {
  return `${planningLinks.board({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

/** The pixels per hour of the levels the specs step between (ADR 0089 ladder). */
const pxPerHour = { day: 48, week: 16 } as const;

test.use({ viewport: { width: 1440, height: 900 } });

/** The left edge of a block in the viewport. */
async function leftOf(block: Locator): Promise<number> {
  const box = await block.boundingBox();
  if (box === null) throw new Error('The block is not drawn');
  return box.x;
}

test.describe('the zoom of the planning board', () => {
  test('#896 Ctrl+wheel over the time area steps one level and keeps the instant under the pointer within 1 px, and the page does not zoom', async ({
    page,
    signIn,
  }) => {
    await signIn(boardHref({ zoom: 'week', from: '2026-11-02' }));
    const board = page.getByRole('grid', { name: /board/ });
    await expect(board).toBeVisible();
    await expect(board).not.toHaveAttribute('aria-busy', 'true');
    const block = board.locator('[data-job-order="1001.10"]');
    await block.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const seen: boolean[] = [];
      (window as unknown as { wheelPrevented: boolean[] }).wheelPrevented = seen;
      document.addEventListener('wheel', (event) => seen.push(event.defaultPrevented));
    });

    const box = await block.boundingBox();
    if (box === null) throw new Error('The block is not drawn');
    const pointerX = Math.round(box.x + box.width / 2);
    const offsetPx = pointerX - box.x;
    await page.mouse.move(pointerX, Math.round(box.y + box.height / 2));
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');

    await expect(page).toHaveURL(/zoom=day/);
    const expectedLeft = pointerX - (offsetPx * pxPerHour.day) / pxPerHour.week;
    await expect
      .poll(async () => Math.abs((await leftOf(block)) - expectedLeft))
      .toBeLessThanOrEqual(1);
    const prevented = await page.evaluate(
      () => (window as unknown as { wheelPrevented: boolean[] }).wheelPrevented,
    );
    expect(prevented.length).toBeGreaterThan(0);
    expect(prevented.every(Boolean)).toBe(true);
  });

  test('#896 the toolbar steps, picks and fits a level, and minus and plus step a level from the grid, and each state passes axe', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(boardHref({ zoom: 'week', from: '2026-11-02' }));
    const board = page.getByRole('grid', { name: /board/ });
    await expect(board).not.toHaveAttribute('aria-busy', 'true');
    const zoom = page.getByRole('group', { name: 'Zoom' });

    await zoom.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page).toHaveURL(/zoom=day/);
    await zoom.getByRole('button', { name: 'Zoom out' }).click();
    await expect(page).toHaveURL(/zoom=week/);

    await zoom.getByRole('button', { name: 'Zoom level, Week' }).click();
    await checkA11y('the zoom level menu on the board');
    await page.getByRole('menuitemradio', { name: 'Quarter' }).click();
    await expect(page).toHaveURL(/zoom=quarter(&|$)/);
    await checkA11y('the board at Quarter');

    // Zoom to fit with nothing selected fits every loaded job order of G1, Tue 3 Nov to Tue 10 Nov.
    await zoom.getByRole('button', { name: 'Zoom to fit' }).click();
    await expect(page).toHaveURL(/zoom=(week|4weeks)\b/);

    const level = page.url().match(/zoom=([a-z0-9-]+)/)?.[1];
    await board.locator('[data-job-order]').first().focus();
    await page.keyboard.press('+');
    await expect(page).not.toHaveURL(new RegExp(`zoom=${level}\\b`));
    await page.keyboard.press('-');
    await expect(page).toHaveURL(new RegExp(`zoom=${level}\\b`));
  });
});
