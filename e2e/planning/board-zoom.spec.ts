// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import type { Locator } from '@playwright/test';
import { expect, plant, test } from '../fixtures.ts';
import { ctrlWheelRun } from './ctrl-wheel.ts';

// The smooth zoom of the planning board (ADR 0090, Gestures, buttons and keys; #941), the same as
// the Gantt's: each Ctrl+wheel event over the time area zooms by exp(-deltaY * 0.002) and keeps the
// instant under the pointer at its x, Zoom in and Zoom out double and halve the width per hour, and
// minus and plus zoom with focus in the grid.

/** The board page of the seed plant with its search. */
function boardHref(search: Record<string, string>): string {
  return `${planningLinks.board({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

test.use({ viewport: { width: 1440, height: 900 } });

/** The box of a block in the viewport. */
async function boxOf(
  block: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await block.boundingBox();
  if (box === null) throw new Error('The block is not drawn');
  return box;
}

test.describe('the smooth zoom of the planning board', () => {
  test('#941 each Ctrl+wheel event of deltaY -4 zooms by a factor between 1.005 and 1.01, the instant under the pointer stays within 1 px, and the page does not zoom', async ({
    page,
    signIn,
  }) => {
    await signIn(boardHref({ from: '2026-11-02' }));
    const board = page.getByRole('grid', { name: /board/ });
    await expect(board).toBeVisible();
    await expect(board).not.toHaveAttribute('aria-busy', 'true');
    const block = board.locator('[data-job-order="1001.10"]');
    await block.scrollIntoViewIfNeeded();
    const start = await boxOf(block);
    const pointerX = Math.round(start.x + start.width / 2);
    const pointerY = Math.round(start.y + start.height / 2);
    const share = (pointerX - start.x) / start.width;

    const boxes = await ctrlWheelRun(page, {
      measure: '[role="grid"] [data-job-order="1001.10"]',
      x: pointerX,
      y: pointerY,
      deltaY: -4,
      count: 20,
    });
    let before: { readonly x: number; readonly width: number } = start;
    for (const [event, after] of boxes.entries()) {
      const factor = after.width / before.width;
      expect(factor, `event ${event}`).toBeGreaterThanOrEqual(1.005);
      expect(factor, `event ${event}`).toBeLessThanOrEqual(1.01);
      expect(Math.abs(after.x + share * after.width - pointerX), `event ${event}`).toBeLessThan(1);
      before = after;
    }
    await expect(page).toHaveURL(/zoom=18\.8\b/);

    // A Ctrl+wheel from the mouse has its default prevented, so the page does not zoom.
    await page.evaluate(() => {
      const seen: boolean[] = [];
      (window as unknown as { wheelPrevented: boolean[] }).wheelPrevented = seen;
      document.addEventListener('wheel', (event) => seen.push(event.defaultPrevented));
    });
    await page.mouse.move(pointerX, pointerY);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -4);
    await page.keyboard.up('Control');
    await expect(page).toHaveURL(/zoom=19(&|$)/);
    const prevented = await page.evaluate(
      () => (window as unknown as { wheelPrevented: boolean[] }).wheelPrevented,
    );
    expect(prevented.length).toBeGreaterThan(0);
    expect(prevented.every(Boolean)).toBe(true);
  });

  test('#941 Zoom in from 16 gives 32 and Zoom out gives 8, the menu and Zoom to fit set the zoom, and minus and plus zoom from the grid, and each state passes axe', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(boardHref({ from: '2026-11-02' }));
    const board = page.getByRole('grid', { name: /board/ });
    await expect(board).not.toHaveAttribute('aria-busy', 'true');
    const zoom = page.getByRole('group', { name: 'Zoom' });

    await zoom.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page).toHaveURL(/zoom=32\b/);
    await zoom.getByRole('button', { name: 'Zoom out' }).click();
    await expect(page).not.toHaveURL(/zoom=/);
    await zoom.getByRole('button', { name: 'Zoom out' }).click();
    await expect(page).toHaveURL(/zoom=8\b/);

    await zoom.getByRole('button', { name: 'Zoom level, Week' }).click();
    await checkA11y('the zoom level menu on the board');
    await page.getByRole('menuitemradio', { name: 'Quarter', exact: true }).click();
    await expect(page).toHaveURL(/zoom=0\.6\b/);
    await checkA11y('the board at Quarter');

    // Zoom to fit with nothing selected fits every loaded job order of G1, Tue 3 Nov to Tue 10 Nov.
    await zoom.getByRole('button', { name: 'Zoom to fit' }).click();
    await expect(page).not.toHaveURL(/zoom=0\.6\b/);

    const fitted = Number(new URL(page.url()).searchParams.get('zoom') ?? '16');
    await board.locator('[data-job-order]').first().focus();
    await page.keyboard.press('+');
    await expect
      .poll(() => Number(new URL(page.url()).searchParams.get('zoom') ?? '16'))
      .toBeCloseTo(fitted * 2, 0);
    await page.keyboard.press('-');
    await expect
      .poll(() => Number(new URL(page.url()).searchParams.get('zoom') ?? '16'))
      .toBeCloseTo(fitted, 0);
  });
});
