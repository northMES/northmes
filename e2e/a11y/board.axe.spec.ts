// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the states of the planning board (plan 07, Gates; design D3):
// the populated board, a collapsed equipment group, a selected order with a hover card, the 4
// weeks preset and a range without job orders. The board reads the fixture G1, so every state is
// the same in every run. G1 has no job orders close enough to cluster; the cluster popover is
// checked in apps/web/test/modules/planning/planning-board.test.tsx.

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
    const board = page.getByRole('grid', { name: /board/ });
    await expect(board).toBeVisible();
    await expect(page.getByText('Showing fixture G1.')).toBeVisible();
    await expect(board.locator('[data-job-order="1001.10"]')).toBeVisible();
    await checkA11y('the populated board');

    await page.getByRole('button', { name: 'Collapse Machining' }).click();
    await expect(page.getByRole('button', { name: 'Expand Machining' })).toBeVisible();
    await expect(board.getByRole('rowheader', { name: 'CNC 1' })).toHaveCount(0);
    await checkA11y('a collapsed equipment group');

    // A selected order and the hover card of a block that keyboard focus opens (D3 IN2).
    await page.getByRole('button', { name: 'Expand Machining' }).click();
    await board.locator('[data-job-order="1003.20"]').click();
    await expect(board.locator('[data-job-order="1003.10"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const card = page.getByRole('tooltip');
    await expect(card).toBeVisible();
    await expect(card).toHaveCSS('opacity', '1');
    await checkA11y('a selected order with the hover card of its job order');

    // The clusters of the 4 weeks preset and the popover of one (D3 BO10, IN27).
    await page.goto(boardHref({ zoom: '4weeks', from: '2026-11-02' }));
    await expect(board).toBeVisible();
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
