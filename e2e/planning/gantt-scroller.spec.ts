// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The time scroller of the order Gantt (#685): a sideways overscroll at an edge never navigates
// the browser history, and the loaded range grows by a span of the preset as the planner scrolls
// towards an edge, with the chosen start kept in the URL.

/** The Gantt page of the seed plant with its search. */
function ganttHref(search: Record<string, string>): string {
  return `${planningLinks.gantt({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

test.describe('the time scroller of the order Gantt', () => {
  // The browser turns a sideways overscroll at an edge into a history navigation only when the
  // scroller lets it through, and headless Chromium never does, so the computed style is the guard.
  test('#685 the grid contains its overscroll, so a wheel past an edge never navigates the history', async ({
    page,
    signIn,
  }) => {
    await signIn(ganttHref({ zoom: 'day', from: '2026-11-04' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();

    const overscroll = await gantt.evaluate((grid) => {
      const style = getComputedStyle(grid);
      return { x: style.overscrollBehaviorX, y: style.overscrollBehaviorY };
    });
    expect(overscroll).toEqual({ x: 'contain', y: 'contain' });
  });

  test('#685 scrolling to the right edge loads the next span of the preset and keeps from', async ({
    page,
    signIn,
  }) => {
    await signIn(ganttHref({ zoom: 'day', from: '2026-11-04' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();
    const header = gantt.getByRole('columnheader', { name: 'Time' });
    await expect(header).toContainText('Fri 6 Nov');
    await expect(header).not.toContainText('Sun 8 Nov');

    await gantt.evaluate((grid) => {
      grid.scrollLeft = grid.scrollWidth;
    });

    await expect(header).toContainText('Sun 8 Nov');
    expect(new URL(page.url()).searchParams.get('from')).toBe('2026-11-04');
    await expect(page.getByText('Wed 4 Nov to Fri 6 Nov')).toBeVisible();
    // The grid keeps scrolling: the content is wider than before and the rows kept their height.
    const widths = await gantt.evaluate((grid) => ({
      scroll: grid.scrollWidth,
      client: grid.clientWidth,
      row: (grid.querySelector('[data-row-id="jo-1003-10"]') as HTMLElement).getBoundingClientRect()
        .height,
    }));
    expect(widths.scroll).toBeGreaterThan(widths.client);
    expect(widths.row).toBeGreaterThan(40);
  });

  // A sticky cell cannot leave its row, so a row only as wide as the grid let the tree columns
  // scroll away once the scroll position passed the row's width (#890).
  test('#890 the Name and Deadline columns stay in view after the range grows and the grid scrolls to the far right', async ({
    page,
    signIn,
  }) => {
    await signIn(ganttHref({ zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();

    // Scroll to the right edge until the content is several views wide, as the range grows.
    await expect
      .poll(() =>
        gantt.evaluate((grid) => {
          grid.scrollLeft = grid.scrollWidth;
          return grid.scrollWidth / grid.clientWidth;
        }),
      )
      .toBeGreaterThan(4);
    await gantt.evaluate((grid) => {
      grid.scrollLeft = grid.scrollWidth;
    });

    const edges = await gantt.evaluate((grid) => {
      const rect = (selector: string) =>
        (grid.querySelector(selector) as HTMLElement).getBoundingClientRect();
      return {
        scrolled: grid.scrollLeft,
        client: grid.clientWidth,
        grid: grid.getBoundingClientRect().left + grid.clientLeft,
        header: rect('[aria-rowindex="1"] > [role="columnheader"]').left,
        nameEnd: rect('[aria-rowindex="1"] > [role="columnheader"]').right,
        deadline: rect('[aria-rowindex="1"] > [role="columnheader"]:nth-child(2)').left,
        notPlaced: rect('[aria-rowindex="2"] > [role="rowheader"]').left,
        order: rect('[data-row-kind="order"] > [role="rowheader"]').left,
        jobOrder: rect('[data-row-kind="jobOrder"] > [role="rowheader"]').left,
        orderDeadline: rect('[data-row-kind="order"] > [role="gridcell"]').left,
      };
    });
    // The position passed a row as wide as the grid, where the bug showed.
    expect(edges.scrolled).toBeGreaterThan(edges.client);
    expect(edges.header).toBeCloseTo(edges.grid, 0);
    expect(edges.notPlaced).toBeCloseTo(edges.grid, 0);
    expect(edges.order).toBeCloseTo(edges.grid, 0);
    expect(edges.jobOrder).toBeCloseTo(edges.grid, 0);
    // The grid is wide enough for every tree cell to stick, so the Deadline column stays beside Name.
    expect(edges.deadline).toBeCloseTo(edges.nameEnd, 0);
    expect(edges.orderDeadline).toBeCloseTo(edges.nameEnd, 0);
  });

  // On a narrow grid only the Name column sticks (WCAG 1.4.10), and the Not placed row follows the
  // same rule, so its list comes into view beside the Name column once the other tree columns
  // have scrolled away (#890).
  test('#890 on a narrow grid the Not placed list comes into view beside the Name column', async ({
    page,
    signIn,
  }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await signIn(ganttHref({ zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();

    const hit = await gantt.evaluate((grid) => {
      const name = grid.querySelector('[aria-rowindex="1"] > [role="columnheader"]') as HTMLElement;
      const list = grid.querySelector('[aria-rowindex="2"] > [role="gridcell"]') as HTMLElement;
      // Scroll until the list's start meets the Name column's end.
      grid.scrollLeft = list.getBoundingClientRect().left - name.getBoundingClientRect().right;
      const box = list.getBoundingClientRect();
      const at = document.elementFromPoint(box.left + 4, box.top + box.height / 2);
      return {
        onList: at !== null && list.contains(at),
        listLeft: box.left,
        nameEnd: name.getBoundingClientRect().right,
      };
    });
    expect(hit.listLeft).toBeCloseTo(hit.nameEnd, 0);
    expect(hit.onList).toBe(true);
  });
});
