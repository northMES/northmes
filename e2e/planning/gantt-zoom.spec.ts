// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import type { Locator, Page } from '@playwright/test';
import { expect, plant, test } from '../fixtures.ts';

// The smooth zoom of the order Gantt (ADR 0090, Gestures, buttons and keys; #941): Ctrl+wheel over
// the time area zooms by exp(-deltaY * 0.002) per event and keeps the instant under the pointer at
// its x, Zoom in and Zoom out double and halve the width per hour over a short animation that
// reduced motion turns off, Zoom to fit fits a span, and minus and plus zoom with focus in the
// grid. The Gantt reads the fixture G1.

/** The Gantt page of the seed plant with its search. */
function ganttHref(search: Record<string, string>): string {
  return `${planningLinks.gantt({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

test.use({ viewport: { width: 1440, height: 900 } });

/** Records whether each wheel event that reached the document had its default prevented. */
async function watchWheel(page: Page): Promise<void> {
  await page.evaluate(() => {
    const seen: boolean[] = [];
    (window as unknown as { wheelPrevented: boolean[] }).wheelPrevented = seen;
    document.addEventListener('wheel', (event) => seen.push(event.defaultPrevented));
  });
}

/** The box of a block in the viewport, once its row is drawn. */
async function boxOf(block: Locator): Promise<{ x: number; width: number }> {
  const box = await block.boundingBox();
  if (box === null) throw new Error('The block is not drawn');
  return box;
}

/** Waits for two animation frames, so a frame of the zoom has been laid out and painted. */
async function frames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

/** The Gantt at G1's week 45 with closed time shown, so a block's width is its hours. */
async function openGantt(page: Page, signIn: (href: string) => Promise<void>, zoom?: string) {
  await page.addInitScript(() =>
    window.localStorage.setItem(
      'northmes.planning.gantt.options',
      JSON.stringify({ hideClosed: false }),
    ),
  );
  await signIn(ganttHref({ ...(zoom !== undefined && { zoom }), from: '2026-11-02' }));
  const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
  await expect(gantt).toBeVisible();
  // The blocks come with their time chunks (ADR 0089); the grid is busy until they are in.
  await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
  return gantt;
}

test.describe('the smooth zoom of the order Gantt', () => {
  test('#941 each Ctrl+wheel event of deltaY -4 zooms by a factor between 1.005 and 1.01, the instant under the pointer stays within 1 px, and the page does not zoom', async ({
    page,
    signIn,
  }) => {
    const gantt = await openGantt(page, signIn);
    const block = gantt.locator('[data-block="jo-1001-10"]');
    await block.scrollIntoViewIfNeeded();
    await watchWheel(page);
    const start = await boxOf(block);
    const pointerX = Math.round(start.x + start.width / 2);
    // The instant under the pointer lies a share of the block's width after its start.
    const share = (pointerX - start.x) / start.width;
    const box = await block.boundingBox();
    await page.mouse.move(pointerX, Math.round((box?.y ?? 0) + (box?.height ?? 0) / 2));

    await page.keyboard.down('Control');
    let before = start;
    for (let event = 0; event < 20; event += 1) {
      await page.mouse.wheel(0, -4);
      await frames(page);
      const after = await boxOf(block);
      const factor = after.width / before.width;
      expect(factor, `event ${event}`).toBeGreaterThanOrEqual(1.005);
      expect(factor, `event ${event}`).toBeLessThanOrEqual(1.01);
      expect(Math.abs(after.x + share * after.width - pointerX), `event ${event}`).toBeLessThan(1);
      before = after;
    }
    await page.keyboard.up('Control');

    // The gesture ends 150 ms after its last event and writes the zoom: 16 * exp(0.16), 18.8.
    await expect(page).toHaveURL(/zoom=18\.8\b/);
    const prevented = await page.evaluate(
      () => (window as unknown as { wheelPrevented: boolean[] }).wheelPrevented,
    );
    expect(prevented.length).toBeGreaterThan(0);
    expect(prevented.every(Boolean)).toBe(true);
  });

  test('#941 Zoom in from 16 gives 32 and Zoom out gives 8, each is aria-disabled at its clamp, and each state passes axe', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await openGantt(page, signIn);
    const zoom = page.getByRole('group', { name: 'Zoom' });

    await zoom.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page).toHaveURL(/zoom=32\b/);
    await zoom.getByRole('button', { name: 'Zoom out' }).click();
    await expect(page).not.toHaveURL(/zoom=/);
    await zoom.getByRole('button', { name: 'Zoom out' }).click();
    await expect(page).toHaveURL(/zoom=8\b/);

    await zoom.getByRole('button', { name: 'Zoom level, Week' }).click();
    await checkA11y('the zoom level menu');
    await page.getByRole('menuitemradio', { name: 'Year', exact: true }).click();
    await expect(page).toHaveURL(/zoom=0\.15\b/);
    await expect(zoom.getByRole('button', { name: 'Zoom out' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await checkA11y('the Gantt at the coarsest clamp');

    await page.goto(ganttHref({ zoom: '240', from: '2026-11-04' }));
    await expect(zoom.getByRole('button', { name: 'Zoom in' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  test('#941 with reduced motion, Zoom in doubles the width at once', async ({ page, signIn }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const gantt = await openGantt(page, signIn);
    const block = gantt.locator('[data-block="jo-1001-10"]');
    await block.scrollIntoViewIfNeeded();
    const before = await boxOf(block);

    await page
      .getByRole('group', { name: 'Zoom' })
      .getByRole('button', { name: 'Zoom in' })
      .click();

    // No animation frame runs between the click and the doubled width.
    expect((await boxOf(block)).width / before.width).toBeCloseTo(2, 2);
  });

  test('#941 Zoom to fit fits the selected order, and minus and plus with focus in the grid zoom by a factor of 2', async ({
    page,
    signIn,
  }) => {
    await signIn(ganttHref({ zoom: 'year', from: '2026-11-01', order: 'po-1003' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt.locator('[data-block="jo-1003-10"]')).toHaveCount(1);

    await page
      .getByRole('group', { name: 'Zoom' })
      .getByRole('button', { name: 'Zoom to fit' })
      .click();
    // The fitted zoom reaches the URL as a number once the view has settled.
    await expect(page).toHaveURL(/zoom=\d/);
    await expect(page).not.toHaveURL(/zoom=0\.15\b/);
    await expect(gantt.locator('[data-block="jo-1003-10"]')).toBeInViewport();
    await expect(gantt.locator('[data-block="jo-1003-20"]')).toBeInViewport();

    const fitted = Number(new URL(page.url()).searchParams.get('zoom'));
    await gantt.locator('[data-row-id="po-1003"]').focus();
    await page.keyboard.press('-');
    await expect
      .poll(() => Number(new URL(page.url()).searchParams.get('zoom')))
      .toBeCloseTo(fitted / 2, 0);
    await page.keyboard.press('+');
    await expect
      .poll(() => Number(new URL(page.url()).searchParams.get('zoom')))
      .toBeCloseTo(fitted, 0);
  });

  test('#896 plus with focus on a block zooms at the block, which stays in view', async ({
    page,
    signIn,
  }) => {
    const gantt = await openGantt(page, signIn);
    const block = gantt.locator('[data-block="jo-1004-20"]');
    await block.scrollIntoViewIfNeeded();
    await block.focus();
    const before = (await boxOf(block)).x;

    await page.keyboard.press('+');

    await expect(page).toHaveURL(/zoom=32\b/);
    await expect.poll(async () => Math.abs((await boxOf(block)).x - before)).toBeLessThanOrEqual(1);
    await expect(block).toBeFocused();
    await expect(block).toBeInViewport();
  });
});
