// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The time scroller of the planning board: the machine column sticks at the grid's start edge
// wherever the time column scrolls to.

/** The board page of the seed plant with its search. */
function boardHref(search: Record<string, string>): string {
  return `${planningLinks.board({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

test.describe('the time scroller of the planning board', () => {
  // A sticky cell cannot leave its row, so a row only as wide as the grid took the machine cells
  // with it once the scroll position passed the row's width (#910, as #890 on the Gantt).
  test('#910 the machine column stays in view when the grid scrolls to the far right', async ({
    page,
    signIn,
  }) => {
    await signIn(boardHref({ zoom: 'week', from: '2026-11-02' }));
    // The grid's skeleton has the same role and name while it loads, so wait for it to be done.
    const board = page.getByRole('grid', { name: /board/ });
    await expect(board).toBeVisible();
    await expect(board).not.toHaveAttribute('aria-busy', 'true');

    const edges = await board.evaluate((grid) => {
      grid.scrollLeft = grid.scrollWidth;
      const left = (selector: string) =>
        (grid.querySelector(selector) as HTMLElement).getBoundingClientRect().left;
      return {
        scrolled: grid.scrollLeft,
        client: grid.clientWidth,
        grid: grid.getBoundingClientRect().left + grid.clientLeft,
        header: left('[aria-rowindex="1"] > [role="columnheader"]'),
        notPlaced: left('[aria-rowindex="2"] > [role="rowheader"]'),
        group: left('[aria-rowindex="3"] > [role="rowheader"]'),
        machine: left('[role="row"][data-machine] > [role="rowheader"]'),
      };
    });
    // The position passed a row as wide as the grid, where the bug showed.
    expect(edges.scrolled).toBeGreaterThan(edges.client);
    expect(edges.header).toBeCloseTo(edges.grid, 0);
    expect(edges.notPlaced).toBeCloseTo(edges.grid, 0);
    expect(edges.group).toBeCloseTo(edges.grid, 0);
    expect(edges.machine).toBeCloseTo(edges.grid, 0);
  });
});
