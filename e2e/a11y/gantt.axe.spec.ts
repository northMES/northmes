// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the states of the order Gantt (plan 18, Gates): populated, an
// expanded order with its links, the chain highlight and the workload table. The Gantt reads the
// fixture G1 in phase 1, so every state is the same in every run. Move mode and the 640 px tabs
// come with the moves of phase 2.

/** The board href of the seed plant with the Gantt's search. */
function ganttHref(search: Record<string, string>): string {
  return `${planningLinks.board({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

test.describe('the order Gantt', () => {
  test('ADR0021 each state of the order Gantt passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(ganttHref({ view: 'gantt', zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();
    await expect(page.getByText('Showing fixture G1.')).toBeVisible();
    await checkA11y('the populated Gantt');

    await page.getByRole('button', { name: 'Collapse order 1001' }).click();
    await expect(page.getByRole('button', { name: 'Expand order 1001' })).toBeVisible();
    await checkA11y('a collapsed order');
    await page.getByRole('button', { name: 'Expand order 1001' }).click();
    await expect(gantt.locator('[data-link="jo-1001-10-jo-1001-20"]')).toHaveCount(1);
    await checkA11y('an expanded order with its links');

    await page.goto(
      ganttHref({ view: 'gantt', zoom: 'week', from: '2026-11-02', order: 'po-1003', chain: '1' }),
    );
    // The chain in the URL opens the order's Details with its explanation; the modal drawer keeps
    // the grid behind it hidden from the role query until it closes.
    const drawer = page.locator('[role="dialog"][data-details-drawer]');
    await expect(drawer).toBeVisible();
    // The drawer fades in; axe must read its colors once the transition has ended.
    await expect(drawer).toHaveCSS('opacity', '1');
    await expect(
      page.getByRole('region', { name: 'Critical chain, 3 rows, root 1001.10 on CNC 1' }),
    ).toBeVisible();
    await checkA11y('the chain highlight with its explanation in the Details drawer');
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(gantt).toBeVisible();
    await expect(gantt.locator('[data-row-id="po-1003"]')).toBeFocused();

    await gantt.locator('[data-block="jo-1001-20"]').click();
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveCSS('opacity', '1');
    await expect(drawer.getByRole('heading', { level: 2 })).toHaveText('1001.20 Mill');
    await checkA11y('the Details drawer of a job order');
    await drawer.getByRole('button', { name: 'Close' }).click();
    await expect(drawer).toBeHidden();

    await page.getByRole('button', { name: 'Board options' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Workload' }).click();
    await page.keyboard.press('Escape');
    // The menu fades out; axe must not read its text mid-transition.
    await expect(page.getByRole('menu')).toHaveCount(0);
    await page.getByRole('button', { name: 'Workload on CNC 1' }).click();
    await expect(page.getByRole('dialog', { name: 'Workload on CNC 1' })).toBeVisible();
    await checkA11y('the workload panel with the table of CNC 1 open');
  });

  test('plan 18 view=gantt fits the viewport without a page scrollbar and the time area scrolls sideways', async ({
    page,
    signIn,
  }) => {
    await signIn(ganttHref({ view: 'gantt', zoom: 'day', from: '2026-11-04' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(gantt).toBeVisible();
      // The grid measures its height again after the resize, so each value is polled.
      const measure = () =>
        page.evaluate(() => {
          const grid = document.querySelector('[role="treegrid"]') as HTMLElement;
          return {
            page: document.documentElement.scrollHeight - document.documentElement.clientHeight,
            x: grid.scrollWidth - grid.clientWidth,
            y: grid.scrollHeight - grid.clientHeight,
          };
        });
      await expect
        .poll(async () => (await measure()).page, { message: `page scroll at ${viewport.width}` })
        .toBeLessThanOrEqual(0);
      await expect
        .poll(async () => (await measure()).x, { message: `sideways scroll at ${viewport.width}` })
        .toBeGreaterThan(0);
      await expect
        .poll(async () => (await measure()).y, { message: `row scroll at ${viewport.width}` })
        .toBeGreaterThan(0);
    }
  });
});
