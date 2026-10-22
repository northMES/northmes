// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the states of the planning board (plan 07, Gates; design D3):
// the populated board, a collapsed equipment group and a range without job orders. The board
// reads the fixture G1, so every state is the same in every run.

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

    await page.goto(boardHref({ zoom: 'week', from: '2026-11-16' }));
    await expect(board.getByRole('gridcell', { name: 'No jobs in this range' })).toHaveCount(3);
    await checkA11y('a range without job orders');
  });
});
