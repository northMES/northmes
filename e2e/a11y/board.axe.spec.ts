// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the states of the planning board (plan 07, Gates; design D3):
// the populated board, a collapsed equipment group, a selected order with a hover card, Details,
// the 4 weeks preset and a range without job orders. The board reads the fixture G1, so every
// state is the same in every run. G1 has no two job orders close enough to share a cluster, so the cluster
// popover has no axe state here; planning-board.test.tsx checks its roles and focus.

/** The board page of the seed plant with its search. */
function boardHref(search: Record<string, string>): string {
  return `${planningLinks.board({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

test.describe('the planning board', () => {
  test('ADR0021 each state of the planning board passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(boardHref({ zoom: 'week', from: '2026-11-02' }));
    // The grid's skeleton has the same role and name while it loads, so wait for it to be done.
    const board = page.getByRole('grid', { name: /board/ });
    await expect(board).toBeVisible();
    await expect(board).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.getByText('Showing fixture G1.')).toBeVisible();
    await expect(board.locator('[data-job-order="1001.10"]')).toBeVisible();
    await checkA11y('the populated board');

    await page.getByRole('button', { name: 'Collapse Machining' }).click();
    await expect(page.getByRole('button', { name: 'Expand Machining' })).toBeVisible();
    await expect(board.getByRole('rowheader', { name: 'CNC 1' })).toHaveCount(0);
    await checkA11y('a collapsed equipment group');

    // A selected order, by Space, and the hover card that keyboard focus opens on the next job
    // order (D3 IN2).
    await page.getByRole('button', { name: 'Expand Machining' }).click();
    // The snapshot may scroll the grid back to its start, which moves the time buffer a viewport
    // earlier (ADR 0089), so the week opens again for the next states.
    await page.goto(boardHref({ zoom: 'week', from: '2026-11-02' }));
    await expect(board).not.toHaveAttribute('aria-busy', 'true');
    await board.locator('[data-job-order="1003.20"]').focus();
    await page.keyboard.press('Space');
    await expect(board.locator('[data-job-order="1003.10"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('ArrowRight');
    await expect(board.locator('[data-job-order="1004.20"]')).toBeFocused();
    // The card of 1003.20 may still be fading out, so the card is named.
    const card = page.getByRole('tooltip', { name: /^1004\.20 / });
    await expect(card).toBeVisible();
    await expect(card).toHaveCSS('opacity', '1');
    await checkA11y('a selected order with the hover card of its job order');

    // Details in the Gantt's drawer (Krister, 2026-10-21).
    await page.keyboard.press('Enter');
    const details = page.locator('[role="dialog"][data-details-drawer]');
    await expect(details).toBeVisible();
    await expect(details).toHaveCSS('opacity', '1');
    await expect(details.getByRole('heading', { level: 2 })).toHaveText('1004.20 Mill');
    await checkA11y('the Details drawer of a job order on the board');
    await page.keyboard.press('Escape');
    await expect(details).toBeHidden();

    // The 4 weeks preset, where G1's narrow job orders keep cells of 24 px (D3 BO10).
    await page.goto(boardHref({ zoom: '4weeks', from: '2026-11-02' }));
    await expect(board).toBeVisible();
    await expect(board).not.toHaveAttribute('aria-busy', 'true');
    await expect(board.locator('[data-job-order="1002.10"]')).toBeVisible();
    await checkA11y('the 4 weeks preset');

    await page.goto(boardHref({ zoom: 'week', from: '2026-11-16' }));
    await expect(board.getByRole('gridcell', { name: 'No jobs in this range' })).toHaveCount(3);
    await checkA11y('a range without job orders');
  });

  test('ADR0021 the page states of the planning board pass the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    // The preview key opens each page state of D3 on the fixture (DR17 to DR22).
    await signIn(boardHref({ zoom: 'week', from: '2026-11-02', preview: 'loading' }));
    await expect(page.getByRole('grid', { name: /board/ })).toHaveAttribute('aria-busy', 'true');
    await checkA11y('the board while it loads', { busy: true });

    await page.goto(boardHref({ preview: 'empty' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'No machines to plan at this plant yet' }),
    ).toBeVisible();
    await checkA11y('a plant without machines to plan');

    await page.goto(boardHref({ preview: 'error' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'The board could not be loaded' }),
    ).toBeVisible();
    await checkA11y('the board that could not be loaded');

    await page.goto(boardHref({ preview: 'forbidden' }));
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'You cannot see the planning board at this plant',
      }),
    ).toBeVisible();
    await checkA11y('the board without its permission');
  });
});
