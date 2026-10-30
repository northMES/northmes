// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import type { Locator } from '@playwright/test';
import { expect, plant, test } from '../fixtures.ts';

// The time scroller of the order Gantt: a sideways overscroll at an edge never navigates the
// browser history (#685), and the axis is endless (ADR 0089, #891): the time area is a buffer of
// three viewport widths that moves by one width near an edge, with the scroll position corrected
// so the view stays, and the toolbar's range text and `from` in the URL follow the view (#883).

/** The Gantt page of the seed plant with its search. */
function ganttHref(search: Record<string, string>): string {
  return `${planningLinks.gantt({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

/** Scrolls the grid to its right edge a number of times, each time waiting for the buffer to move. */
async function toRightEdge(grid: Locator, times: number): Promise<void> {
  for (let step = 0; step < times; step += 1) {
    await grid.evaluate(async (element) => {
      element.scrollLeft = element.scrollWidth;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
  }
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

  test('#891 scrolls far into the future and back with the date under a point kept at every step, and the range text follows the view', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(ganttHref({ zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();
    await expect(page.locator('[data-block="jo-1003-10"]')).toBeVisible();
    const rangeText = page.locator('[data-range-text]');
    await expect(rangeText).toHaveText(/^W45, Mon 2 Nov to /);
    const first = await rangeText.textContent();

    // Forty steps of a fifth of the view each way: the buffer moves every few steps, and each
    // header cell in view moves by exactly the step, so no move shifts the view.
    const far = await scrollSteps(gantt, 40, 1);
    expect(far.moves).toBeGreaterThan(5);
    expect(far.worst).toBeLessThanOrEqual(1);
    await expect(rangeText).not.toHaveText(/^W4[56], /);
    await expect
      .poll(() => new URL(page.url()).searchParams.get('from'))
      .toMatch(/^2026-1[12]-\d\dT/);
    await checkA11y('the order Gantt scrolled far into the future');

    const back = await scrollSteps(gantt, 40, -1);
    expect(back.moves).toBeGreaterThan(5);
    expect(back.worst).toBeLessThanOrEqual(1);
    await expect(rangeText).toHaveText(first ?? '');
    await expect(page.locator('[data-block="jo-1003-10"]')).toBeVisible();
  });

  for (const zoom of ['quarter-hours', 'hours', 'day', 'week', '4weeks', 'quarter', 'year']) {
    test(`ADR0089 at ${zoom}, after the view reaches both edges three times, the Name column stays at the grid's edge, no header labels overlap or start in a gap, and the range text names the start in the URL`, async ({
      page,
      signIn,
    }) => {
      await signIn(ganttHref({ zoom, from: '2026-11-04' }));
      const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
      await expect(gantt).toBeVisible();

      await toRightEdge(gantt, 3);
      await gantt.evaluate(async (grid) => {
        for (let step = 0; step < 3; step += 1) {
          grid.scrollLeft = 0;
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
        }
      });
      // The scroll rests, and the visible start goes to the URL unless the view came back to
      // the start the URL names.
      await page.waitForTimeout(400);

      const layout = await gantt.evaluate((grid) => {
        const box = (each: Element) => {
          const rect = each.getBoundingClientRect();
          return { left: rect.left, right: rect.right };
        };
        const header = grid.querySelector(
          '[role="columnheader"][aria-label="Time"]',
        ) as HTMLElement;
        const shown = (each: Element) => each.querySelector('[data-tick-label]')?.textContent ?? '';
        return {
          grid: grid.getBoundingClientRect().left + grid.clientLeft,
          name: (
            grid.querySelector('[aria-rowindex="1"] > [role="columnheader"]') as HTMLElement
          ).getBoundingClientRect().left,
          gaps: [...header.querySelectorAll('[data-header-gap]')].map(box),
          labels: [...header.querySelectorAll('[data-tier]')]
            .filter((each) => shown(each) !== '')
            .map((each) => ({
              ...box(each),
              tier: each.getAttribute('data-tier') ?? '',
              text: shown(each),
            })),
        };
      });
      expect(layout.name).toBeCloseTo(layout.grid, 0);
      for (const tier of ['top', 'bottom']) {
        const labels = layout.labels
          .filter((label) => label.tier === tier)
          .sort((a, b) => a.left - b.left);
        for (const [index, label] of labels.entries()) {
          const next = labels[index + 1];
          if (next === undefined) continue;
          expect(label.right, `${label.text} ends before ${next.text}`).toBeLessThanOrEqual(
            next.left + 0.5,
          );
        }
      }
      for (const label of layout.labels) {
        for (const gap of layout.gaps) {
          expect(
            label.left >= gap.left - 0.5 && label.left < gap.right - 0.5,
            `${label.text} starts inside a gap`,
          ).toBe(false);
        }
      }
      // The range text names the date of the start in the URL: its day and month, or its month at
      // the levels that span months.
      const from = new URL(page.url()).searchParams.get('from') ?? '';
      const [year, month, day] = from.slice(0, 10).split('-').map(Number);
      const monthName = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, 1)).toLocaleString('en-GB', {
        month: 'long',
        timeZone: 'UTC',
      });
      const expected =
        zoom === 'quarter' || zoom === 'year'
          ? `${monthName} ${year}`
          : `${day} ${monthName.slice(0, 3)}`;
      await expect(page.locator('[data-range-text]')).toContainText(expected);
    });
  }

  test('#883 the buffer stays three viewport widths however often the view reaches the right edge', async ({
    page,
    signIn,
  }) => {
    await signIn(ganttHref({ zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();
    const widthOf = () =>
      gantt.evaluate(
        (grid) =>
          (grid.querySelector('[data-overlay]') as HTMLElement).getBoundingClientRect().width,
      );
    const width = await widthOf();

    for (let step = 0; step < 6; step += 1) {
      await gantt.evaluate(async (grid) => {
        grid.scrollLeft = grid.scrollWidth;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      expect(Math.abs((await widthOf()) - width)).toBeLessThanOrEqual(7);
    }
  });

  // A sticky cell cannot leave its row, so a row only as wide as the grid let the tree columns
  // scroll away once the scroll position passed the row's width (#890).
  test('#890 the Name and Deadline columns stay in view after the buffer moves and the grid scrolls to the far right', async ({
    page,
    signIn,
  }) => {
    await signIn(ganttHref({ zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();

    // Scroll to the right edge a few times, so the buffer moves, then to its far right, measured
    // before the browser reports that scroll.
    await toRightEdge(gantt, 3);

    const edges = await gantt.evaluate((grid) => {
      grid.scrollLeft = grid.scrollWidth;
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
      // Scroll until the list's start meets the Name column's end, from where the view opened.
      grid.scrollLeft += list.getBoundingClientRect().left - name.getBoundingClientRect().right;
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
  test('#910 the workload labels stay in view, as wide as the sticky tree columns, after the buffer moves and the panel scrolls to the far right', async ({
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

    // Move the buffer as the #890 test does; the lanes are three views wide.
    await toRightEdge(gantt, 3);

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
    // The lanes keep the grid's scroll position, so the lane's track lines up with the time column.
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

    // Last: the full-page Argos snapshot leaves each sticky cell it stabilized at position
    // relative, so a sticky edge measured after it would scroll away (#926).
    await checkA11y('the workload panel on a narrow grid');
  });
});
