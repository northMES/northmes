// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import type { Locator, Page } from '@playwright/test';
import { expect, plant, test } from '../fixtures.ts';

// The Details drawer leads with the move decision and folds the rest (#917): with every section
// closed, the first view of each G1 job order fits the 320 px sheet at a 768 px tall viewport, on
// the order Gantt and on the board, and a section toggles from the keyboard. The Gantt and the
// board read the fixture G1, so every job order is the same in every run.

test.use({ viewport: { width: 1280, height: 768 } });

/** The open Details drawer, once its fade in has ended, so its size and colors are final. */
async function openedDrawer(page: Page): Promise<Locator> {
  const drawer = page.locator('[role="dialog"][data-details-drawer]');
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveCSS('opacity', '1');
  return drawer;
}

/** Whether the drawer shows all of its content without scrolling. */
async function fitsWithoutScrolling(drawer: Locator): Promise<boolean> {
  return drawer.evaluate((element) => element.scrollHeight <= element.clientHeight);
}

test.describe('the Details drawer (#917)', () => {
  test('#917 the first view of every G1 job order fits the sheet at 768 px tall on the Gantt', async ({
    page,
    signIn,
  }) => {
    await signIn(planningLinks.gantt({ plant }, { zoom: 'week', from: '2026-11-02' }).href);
    for (const from of ['2026-11-02', '2026-11-09']) {
      await page.goto(planningLinks.gantt({ plant }, { zoom: 'week', from }).href);
      const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
      await expect(gantt).toBeVisible();
      const rows = await gantt
        .locator('[data-row-id^="jo-"]')
        .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-row-id')));
      expect(rows.length).toBeGreaterThan(0);
      for (const id of rows) {
        await gantt.locator(`[data-row-id="${id}"]`).focus();
        await page.keyboard.press('Enter');
        const drawer = await openedDrawer(page);
        await expect(drawer.locator('[data-section-toggle][aria-expanded="true"]')).toHaveCount(
          id === 'jo-1004-10' ? 1 : 0,
        );
        // 1004.10 is short of material, which opens its Material section by itself; closed, it fits.
        if (id === 'jo-1004-10') {
          await drawer.getByRole('button', { name: /^Material, / }).click();
        }
        expect(await fitsWithoutScrolling(drawer), `${id} at ${from}`).toBe(true);
        await page.keyboard.press('Escape');
        await expect(drawer).toBeHidden();
      }
    }
  });

  test('ADR0021 #917 a job order on the Gantt toggles a section by keyboard and passes the WCAG 2.2 AA rules open and closed', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(planningLinks.gantt({ plant }, { zoom: 'week', from: '2026-11-02' }).href);
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await gantt.locator('[data-block="jo-1001-20"]').dblclick();
    const drawer = await openedDrawer(page);
    await expect(drawer.getByRole('heading', { level: 2 })).toHaveText('1001.20 Mill');
    expect(await fitsWithoutScrolling(drawer)).toBe(true);
    await checkA11y('the Details drawer of a job order with its sections closed');

    const toggle = drawer.getByRole('button', { name: 'Float and timing, total float 12 h' });
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer.getByRole('region', { name: 'Float and timing' })).toContainText(
      'Starts at its release: 1001.10 end plus 1 h lead.',
    );
    await drawer.getByRole('button', { name: /^Constraints, / }).click();
    await drawer.getByRole('button', { name: /^Setup and run, / }).click();
    await checkA11y('the Details drawer of a job order with its sections open');
    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // The actions menu works from the keyboard and lists the disabled actions with their reason.
    await drawer.getByRole('button', { name: 'Actions for 1001.20' }).focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu', { name: 'Actions for 1001.20' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Lock' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(menu.getByRole('menuitem', { name: 'Lock' })).toHaveAccessibleDescription(
      'Moves and changes come with the live data; this view reads the fixture G1.',
    );
    await checkA11y('the actions menu of the Details drawer');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('ADR0021 #917 the board opens the same drawer, which fits without scrolling and passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(planningLinks.board({ plant }, { zoom: 'week', from: '2026-11-02' }).href);
    const board = page.getByRole('grid', { name: /board/ });
    await expect(board).toBeVisible();
    await board.locator('[data-job-order="1003.20"]').focus();
    await page.keyboard.press('Enter');
    const drawer = await openedDrawer(page);
    await expect(drawer.getByRole('heading', { level: 2 })).toHaveText('1003.20 Mill');
    await expect(drawer.locator('[data-exception]')).toHaveText(
      'Ends 15 h 15 min after the order deadline',
    );
    expect(await fitsWithoutScrolling(drawer)).toBe(true);
    await checkA11y('the Details drawer on the board with its sections closed');

    await drawer.getByRole('button', { name: /^Constraints, / }).click();
    await expect(drawer.getByRole('region', { name: /^Constraints, / })).toBeVisible();
    await checkA11y('the Details drawer on the board with a section open');
  });
});
