// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the states of the order Gantt (plan 18, Gates): populated, an
// expanded order with its links, the chain highlight, a focused block described by its hover card
// fields (#902) and the workload table. The Gantt reads the fixture G1, so every state is the same
// in every run. Move mode, a row in the draft and the My draft drawer are checked in
// e2e/planning/gantt-keyboard.spec.ts; the 640 px tabs are a later story.
// The review step of a run and the run row (plan 18, Runs) are checked here.

/** The Gantt page of the seed plant with its search. */
function ganttHref(search: Record<string, string>): string {
  return `${planningLinks.gantt({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

test.describe('the order Gantt', () => {
  // ADR 0021's check of each state, one test per group of states, so that no test runs more than
  // three axe passes over the full grid inside the 60 s budget of the config.
  test('ADR0021 the populated Gantt, a collapsed order and an expanded order with its links pass the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(ganttHref({ zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();
    // The blocks come with their time chunks (ADR 0089); the grid is busy until they are in.
    await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.getByText('Showing fixture G1.')).toBeVisible();
    await checkA11y('the populated Gantt');

    await page.getByRole('button', { name: 'Collapse order 1001' }).click();
    await expect(page.getByRole('button', { name: 'Expand order 1001' })).toBeVisible();
    await checkA11y('a collapsed order');
    await page.getByRole('button', { name: 'Expand order 1001' }).click();
    await expect(gantt.locator('[data-link="jo-1001-10-jo-1001-20"]')).toHaveCount(1);
    await checkA11y('an expanded order with its links');
  });

  test('ADR0021 the chain highlight and the Details drawer of a job order pass the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(ganttHref({ zoom: 'week', from: '2026-11-02', order: 'po-1003', chain: '1' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
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
    // The blocks come with their time chunks (ADR 0089); the grid is busy until they are in.
    await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
    await expect(gantt.locator('[data-row-id="po-1003"]')).toBeFocused();

    await gantt.locator('[data-block="jo-1001-20"]').dblclick();
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveCSS('opacity', '1');
    await expect(drawer.getByRole('heading', { level: 2 })).toHaveText('1001.20 Mill');
    await checkA11y('the Details drawer of a job order');
  });

  test('ADR0021 the review step of a run and the run row above its orders pass the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(ganttHref({ zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();
    // The blocks come with their time chunks (ADR 0089); the grid is busy until they are in.
    await expect(gantt).not.toHaveAttribute('aria-busy', 'true');

    // A run (plan 18, Runs), by keyboard: Space selects 1001, Shift+Space adds 1005, Shift+F10
    // opens the row menu, Combine into a run opens the review step, and Combine draws the run row
    // above its orders.
    await gantt.locator('[data-row-id="po-1001"]').focus();
    await page.keyboard.press('Space');
    await expect(gantt.locator('[data-row-id="po-1001"]')).toHaveAttribute('aria-selected', 'true');
    for (let step = 0; step < 10; step += 1) await page.keyboard.press('ArrowDown');
    await expect(gantt.locator('[data-row-id="po-1005"]')).toBeFocused();
    await page.keyboard.press('Shift+Space');
    await expect(gantt.locator('[data-row-id="po-1005"]')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menu', { name: 'Actions for order 1005' })).toBeVisible();
    // The popup is anchored to the row's button, which the grid may have scrolled out of the
    // viewport, so the item takes its click as an event rather than a pointer.
    await page.getByRole('menuitem', { name: 'Combine into a run' }).dispatchEvent('click');
    const review = page.getByRole('dialog', { name: 'Combine into a run' });
    await expect(review).toBeVisible();
    await expect(review).toHaveCSS('opacity', '1');
    await expect(review.getByRole('list', { name: 'Saved retools' })).toHaveText(
      '1005.10 follows 1001.10 on CNC 1, saves 30 min of retool',
    );
    await checkA11y('the review step of a run');
    await review.getByRole('button', { name: 'Combine' }).click();
    await expect(review).toBeHidden();
    const run = gantt.locator('[data-row-id="run:po-1001+po-1005"]');
    await expect(run).toHaveAttribute('aria-level', '1');
    await expect(gantt.locator('[data-row-id="po-1005"]')).toHaveAttribute('aria-level', '2');
    await expect(gantt.locator('[data-block="jo-1005-10"] [data-setup-hatch]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'My draft, 1 change' })).toBeVisible();
    await checkA11y('the run row above its orders');
    await run.focus();
    await page.keyboard.press('Shift+F10');
    await expect(
      page.getByRole('menu', { name: 'Actions for the run of Bracket L' }),
    ).toBeVisible();
    await page.getByRole('menuitem', { name: 'Split run' }).dispatchEvent('click');
    await expect(run).toHaveCount(0);
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('ADR0021 #902 a focused block described by its hover card passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(ganttHref({ zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();
    // The blocks come with their time chunks (ADR 0089); the grid is busy until they are in.
    await expect(gantt).not.toHaveAttribute('aria-busy', 'true');

    // Right moves focus from the row into its block, and focus opens the hover card.
    await gantt.locator('[data-row-id="jo-1006-10"]').focus();
    await page.keyboard.press('ArrowRight');
    const block = gantt.locator('[data-block="jo-1006-10"]');
    await expect(block).toBeFocused();
    const card = page.getByRole('tooltip');
    await expect(card).toBeVisible();
    // The card fades in; axe must read its colors once the transition has ended.
    await expect(card).toHaveCSS('opacity', '1');
    await expect(block).toHaveAccessibleDescription(/Working 3 h working/);
    await expect(block).toHaveAccessibleDescription(/Constraints 4 hold/);
    await expect(block).not.toHaveAccessibleDescription(/1006\.10 Mill/);
    await checkA11y('a focused block with its hover card as its description');
  });

  test('ADR0021 the workload panel passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(ganttHref({ zoom: 'week', from: '2026-11-02' }));
    await expect(page.getByRole('treegrid', { name: /order Gantt/ })).toBeVisible();

    await page.getByRole('button', { name: 'Board options' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Workload' }).click();
    await page.keyboard.press('Escape');
    // The menu fades out; axe must not read its text mid-transition.
    await expect(page.getByRole('menu')).toHaveCount(0);
    await page.getByRole('button', { name: 'Workload on CNC 1' }).click();
    await expect(page.getByRole('dialog', { name: 'Workload on CNC 1' })).toBeVisible();
    await checkA11y('the workload panel with the table of CNC 1 open');
  });

  test('plan 18 the Gantt page fits the viewport without a page scrollbar and the time area scrolls sideways', async ({
    page,
    signIn,
  }) => {
    await signIn(ganttHref({ zoom: 'day', from: '2026-11-04' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(gantt).toBeVisible();
      // The blocks come with their time chunks (ADR 0089); the grid is busy until they are in.
      await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
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
