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
    // Closed time is hidden by default, so the closed weekend has no label (#892): the next span
    // shows from its first open weekday.
    await expect(header).not.toContainText('Mon 9 Nov');

    await gantt.evaluate((grid) => {
      grid.scrollLeft = grid.scrollWidth;
    });

    await expect(header).toContainText('Mon 9 Nov');
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

    // Scroll to the right edge until the content is several views wide, as the range grows. The
    // scroll event is dispatched as well, so a growth does not wait for the browser's next frame;
    // a second call at the same position changes nothing.
    await expect
      .poll(() =>
        gantt.evaluate((grid) => {
          grid.scrollLeft = grid.scrollWidth;
          grid.dispatchEvent(new Event('scroll'));
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

  // The workload lanes had the treegrid rows' defect: a lane as wide as its scroller took its
  // sticky label with it once the scroll passed the lane's width (#910).
  test('#910 the workload labels stay in view, as wide as the sticky tree columns, after the range grows and the panel scrolls to the far right', async ({
    page,
    signIn,
  }) => {
    await signIn(ganttHref({ zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();
    await page.getByRole('button', { name: 'Board options' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Workload' }).click();
    await page.keyboard.press('Escape');
    const label = page.getByRole('button', { name: 'Workload on CNC 1' });
    await expect(label).toBeVisible();

    // Grow the range as the #890 test does, so the lanes are several views wide.
    await expect
      .poll(() =>
        gantt.evaluate((grid) => {
          grid.scrollLeft = grid.scrollWidth;
          grid.dispatchEvent(new Event('scroll'));
          return grid.scrollWidth / grid.clientWidth;
        }),
      )
      .toBeGreaterThan(4);

    // The grid is wide enough for every tree column to stick, so the tree headers sit side by side
    // at the grid's start edge: the label sticks as wide as all of them.
    const tree = await gantt.evaluate((grid) => {
      const headers = [
        ...grid.querySelectorAll<HTMLElement>('[aria-rowindex="1"] > [role="columnheader"]'),
      ].slice(0, -1);
      const first = headers[0] as HTMLElement;
      const last = headers.at(-1) as HTMLElement;
      return last.getBoundingClientRect().right - first.getBoundingClientRect().left;
    });
    const edges = await label.evaluate((button) => {
      const cell = button.parentElement as HTMLElement;
      // The lanes' scroller is the lane's parent.
      const panel = (cell.parentElement as HTMLElement).parentElement as HTMLElement;
      panel.scrollLeft = panel.scrollWidth;
      return {
        scrolled: panel.scrollLeft,
        client: panel.clientWidth,
        panel: panel.getBoundingClientRect().left + panel.clientLeft,
        label: cell.getBoundingClientRect().left,
        width: cell.getBoundingClientRect().width,
      };
    });
    // The position passed a lane as wide as the panel, where the bug showed.
    expect(edges.scrolled).toBeGreaterThan(edges.client);
    expect(edges.label).toBeCloseTo(edges.panel, 0);
    expect(edges.width).toBeCloseTo(tree, 0);
  });

  // On a narrow grid only the treegrid's Name column sticks (WCAG 1.4.10); the workload label
  // follows the same rule, so it never covers more of the lane than the Name column does, and the
  // lane's bars still start under the time column (#910).
  test('#910 on a narrow grid the workload label sticks only the Name column wide, clips a long name and keeps the bars under the time column', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await signIn(ganttHref({ zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();
    await page.getByRole('button', { name: 'Board options' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Workload' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    const label = page.getByRole('button', { name: 'Workload on CNC 1' });
    await expect(label).toBeVisible();
    await checkA11y('the workload panel on a narrow grid');

    const grid = await gantt.evaluate((element) => {
      const header = (selector: string) =>
        (element.querySelector(selector) as HTMLElement).getBoundingClientRect();
      return {
        name: header('[aria-rowindex="1"] > [role="columnheader"]').width,
        time: header('[aria-rowindex="1"] > [role="columnheader"]:last-child').left,
      };
    });
    const lane = await page
      .locator('[data-lane="CNC1"]')
      .evaluate((track) => track.getBoundingClientRect().left);
    // Both scrollers are at their start, so the lane's track lines up with the time column.
    expect(lane).toBeCloseTo(grid.time, 0);

    const edges = await label.evaluate((button) => {
      const cell = button.parentElement as HTMLElement;
      const panel = (cell.parentElement as HTMLElement).parentElement as HTMLElement;
      panel.scrollLeft = panel.scrollWidth;
      // A machine name far wider than the Name column stays inside the label.
      const text = button.querySelector('span') as HTMLElement;
      text.textContent = 'Workload on Horizontal machining center with pallet changer 2';
      return {
        scrolled: panel.scrollLeft,
        client: panel.clientWidth,
        panel: panel.getBoundingClientRect().left + panel.clientLeft,
        label: cell.getBoundingClientRect().left,
        width: cell.getBoundingClientRect().width,
        cellEnd: cell.getBoundingClientRect().right,
        buttonEnd: button.getBoundingClientRect().right,
      };
    });
    expect(edges.width).toBeCloseTo(grid.name, 0);
    expect(edges.scrolled).toBeGreaterThan(edges.client);
    expect(edges.label).toBeCloseTo(edges.panel, 0);
    expect(edges.buttonEnd).toBeLessThanOrEqual(edges.cellEnd);
  });
});
