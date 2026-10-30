// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import type { Locator } from '@playwright/test';
import { expect, plant, test } from '../fixtures.ts';

// The time scroller of the planning board: the machine column sticks at the grid's start edge
// wherever the time column scrolls to, and the axis is endless (ADR 0089, #891): the time area is
// a buffer of three viewport widths that moves by one width near an edge, with the scroll
// position corrected so the view stays, and the range text follows the view.

/** The board page of the seed plant with its search. */
function boardHref(search: Record<string, string>): string {
  return `${planningLinks.board({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

/**
 * Scrolls the grid by a fifth of its width a number of times in one direction. Before each step it
 * takes the header cell at three quarters of the view, and after the step finds that cell again by
 * its name: it must have moved by the step, also when the buffer moved under it. Returns how many
 * steps moved the buffer and the worst miss in pixels.
 */
async function scrollSteps(
  grid: Locator,
  steps: number,
  direction: 1 | -1,
): Promise<{ moves: number; worst: number }> {
  return grid.evaluate(
    async (element, { steps, direction }) => {
      const frames = () =>
        new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const cells = () => [...element.querySelectorAll<HTMLElement>('[data-tier="bottom"]')];
      const nameOf = (cell: HTMLElement) => cell.querySelector('.sr-only')?.textContent ?? '';
      const overlayStart = () =>
        (element.querySelector('[data-overlay]') as HTMLElement).getBoundingClientRect().left;
      const box = element.getBoundingClientRect();
      const x = box.left + box.width * 0.75;
      // A fifth of the visible time area, less than the quarter-width margin, so no step reaches past
      // the buffer's edge before it moves.
      const sticky = Number.parseFloat(getComputedStyle(element).scrollPaddingInlineStart) || 0;
      const step = Math.round((element.clientWidth - sticky) / 5) * direction;
      let moves = 0;
      let worst = 0;
      for (let index = 0; index < steps; index += 1) {
        // The cell nearest the point: with closed time hidden the point may lie in a gap.
        const cell = cells()
          .map((each) => {
            const rect = each.getBoundingClientRect();
            return { each, distance: Math.abs((rect.left + rect.right) / 2 - x) };
          })
          .sort((a, b) => a.distance - b.distance)[0]?.each;
        if (cell === undefined) throw new Error('No header cell');
        const name = nameOf(cell);
        const left = cell.getBoundingClientRect().left;
        const start = overlayStart();
        element.scrollLeft += step;
        await frames();
        const again = cells().find((each) => nameOf(each) === name);
        if (again === undefined) throw new Error(`The header cell ${name} is gone`);
        worst = Math.max(worst, Math.abs(left - step - again.getBoundingClientRect().left));
        // The time column moves by the step unless the buffer moved under it.
        if (Math.abs(start - step - overlayStart()) > 1) moves += 1;
      }
      return { moves, worst };
    },
    { steps, direction },
  );
}

test.describe('the time scroller of the planning board', () => {
  test('#891 scrolls far into the future and back with the date under a point kept at every step, and the range text follows the view', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    // The view starts at noon, so a scroll position the browser rounds stays on the same day.
    await signIn(boardHref({ zoom: 'week', from: '2026-11-04T12:00' }));
    const board = page.getByRole('grid', { name: /board/ });
    await expect(board).toBeVisible();
    await expect(board).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('[data-job-order="1003.20"]')).toBeVisible();
    const rangeText = page.locator('[data-range-text]');
    await expect(rangeText).toHaveText(/^W45, Wed 4 Nov to /);
    const first = await rangeText.textContent();

    const far = await scrollSteps(board, 40, 1);
    expect(far.moves).toBeGreaterThan(5);
    expect(far.worst).toBeLessThanOrEqual(1);
    await expect(rangeText).not.toHaveText(/^W4[56], /);
    await expect
      .poll(() => new URL(page.url()).searchParams.get('from'))
      .toMatch(/^2026-1[12]-\d\dT/);
    await expect(board).not.toHaveAttribute('aria-busy', 'true');
    await checkA11y('the planning board scrolled far into the future');

    const back = await scrollSteps(board, 40, -1);
    expect(back.moves).toBeGreaterThan(5);
    expect(back.worst).toBeLessThanOrEqual(1);
    await expect(rangeText).toHaveText(first ?? '');
    await expect(page.locator('[data-job-order="1003.20"]')).toBeVisible();
  });

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
