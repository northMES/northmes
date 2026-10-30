// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import type { Locator, Page } from '@playwright/test';
import { expect, plant, test } from '../fixtures.ts';

// The zoom of the order Gantt (ADR 0089, Zoom levels; #896): Ctrl+wheel over the time area steps
// one level and keeps the instant under the pointer at its x, the toolbar steps, picks and fits a
// level, and minus and plus step a level with focus in the grid. The Gantt reads the fixture G1.

/** The Gantt page of the seed plant with its search. */
function ganttHref(search: Record<string, string>): string {
  return `${planningLinks.gantt({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

/** The pixels per hour of the levels the specs step between (ADR 0089 ladder). */
const pxPerHour = { day: 48, week: 16 } as const;

test.use({ viewport: { width: 1440, height: 900 } });

/** Records whether each wheel event that reached the document had its default prevented. */
async function watchWheel(page: Page): Promise<void> {
  await page.evaluate(() => {
    const seen: boolean[] = [];
    (window as unknown as { wheelPrevented: boolean[] }).wheelPrevented = seen;
    document.addEventListener('wheel', (event) => seen.push(event.defaultPrevented));
  });
}

/** The left edge of a block in the viewport, once its row is drawn. */
async function leftOf(block: Locator): Promise<number> {
  const box = await block.boundingBox();
  if (box === null) throw new Error('The block is not drawn');
  return box.x;
}

test.describe('the zoom of the order Gantt', () => {
  test('#896 Ctrl+wheel over the time area steps one level in and out and keeps the instant under the pointer within 1 px, and the page does not zoom', async ({
    page,
    signIn,
  }) => {
    await signIn(ganttHref({ zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();
    const block = gantt.locator('[data-block="jo-1001-10"]');
    await block.scrollIntoViewIfNeeded();
    await watchWheel(page);

    const box = await block.boundingBox();
    if (box === null) throw new Error('The block is not drawn');
    const pointerX = Math.round(box.x + box.width / 2);
    const pointerY = Math.round(box.y + box.height / 2);
    // The instant under the pointer is pointerX - left px after the block's setup start; at the
    // next level that offset grows by the ratio of the widths, and the pointer's x stays put.
    const offsetPx = pointerX - box.x;
    await page.mouse.move(pointerX, pointerY);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');

    await expect(page).toHaveURL(/zoom=day/);
    await expect(page.getByRole('button', { name: 'Zoom level, Day' })).toBeVisible();
    const expectedLeft = pointerX - (offsetPx * pxPerHour.day) / pxPerHour.week;
    await expect
      .poll(async () => Math.abs((await leftOf(block)) - expectedLeft))
      .toBeLessThanOrEqual(1);

    // A pause ends the gesture; the next one, down, steps back out to Week.
    await page.waitForTimeout(300);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, 100);
    await page.keyboard.up('Control');
    await expect(page).toHaveURL(/zoom=week/);
    await expect.poll(async () => Math.abs((await leftOf(block)) - box.x)).toBeLessThanOrEqual(1);

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
    await signIn(ganttHref({ zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();
    const zoom = page.getByRole('group', { name: 'Zoom' });

    await zoom.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page).toHaveURL(/zoom=day/);
    await zoom.getByRole('button', { name: 'Zoom out' }).click();
    await expect(page).toHaveURL(/zoom=week/);

    await zoom.getByRole('button', { name: 'Zoom level, Week' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitemradio')).toHaveText([
      'Quarter hours',
      'Hours',
      'Day',
      'Week',
      '4 weeks',
      'Quarter',
      'Year',
    ]);
    await checkA11y('the zoom level menu');
    await menu.getByRole('menuitemradio', { name: 'Year', exact: true }).click();
    await expect(page).toHaveURL(/zoom=year/);
    await expect(zoom.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    await checkA11y('the Gantt at Year');

    // Zoom to fit on a link at Year with order 1003 selected fits its job orders, Wed 4 Nov 08:00
    // to Thu 5 Nov 06:15, at a level finer than Year with both blocks in view.
    await page.goto(ganttHref({ zoom: 'year', from: '2026-11-01', order: 'po-1003' }));
    await expect(gantt.locator('[data-block="jo-1003-10"]')).toHaveCount(1);
    await zoom.getByRole('button', { name: 'Zoom to fit' }).click();
    await expect(page).not.toHaveURL(/zoom=year/);
    await expect(gantt.locator('[data-block="jo-1003-10"]')).toBeInViewport();
    await expect(gantt.locator('[data-block="jo-1003-20"]')).toBeInViewport();

    // Minus and plus with focus in the grid step a level around the centre of the view.
    const level = page.url().match(/zoom=([a-z0-9-]+)/)?.[1];
    await gantt.locator('[data-row-id="po-1003"]').focus();
    await page.keyboard.press('-');
    await expect(page).not.toHaveURL(new RegExp(`zoom=${level}\\b`));
    await page.keyboard.press('+');
    await expect(page).toHaveURL(new RegExp(`zoom=${level}\\b`));
  });

  test('#896 plus with focus on a block zooms at the block, which stays in view', async ({
    page,
    signIn,
  }) => {
    await signIn(ganttHref({ zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();
    const block = gantt.locator('[data-block="jo-1004-20"]');
    await block.scrollIntoViewIfNeeded();
    await block.focus();
    const before = await leftOf(block);

    await page.keyboard.press('+');

    await expect(page).toHaveURL(/zoom=day/);
    await expect.poll(async () => Math.abs((await leftOf(block)) - before)).toBeLessThanOrEqual(1);
    await expect(block).toBeFocused();
    await expect(block).toBeInViewport();
  });
});
