// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import type { Locator, Page } from '@playwright/test';
import { expect, plant, test } from '../fixtures.ts';

// The left pane of the timelines (#943): the order Gantt's tree pane and the planning board's
// machine column cover whatever the time area draws under them at every scroll position. The
// Gantt's tree pane sticks as one block at the width its splitter sets and scrolls sideways on its
// own when its columns are wider. G1's now is Mon 2 Nov 09:40.

const optionsKey = 'northmes.planning.gantt.options';

/** A planning page of the seed plant with its search. */
function planningHref(page: 'gantt' | 'board', search: Record<string, string>): string {
  return `${planningLinks[page]({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

/** Every tree column shown, kept as the Columns menu keeps it, and the page loaded again. */
async function showEveryColumn(page: Page): Promise<void> {
  await page.evaluate((key) => {
    window.localStorage.setItem(key, JSON.stringify({ hiddenColumns: [] }));
  }, optionsKey);
  await page.reload();
}

/**
 * Scrolls the grid until the marker sits under the left pane, then reads, at the marker's x and the
 * row's vertical centre and at the centre of the cell over the marker, what the browser hits. The
 * buffer may move under a scroll, so the marker is found again after each one.
 */
async function coverOf(
  grid: Locator,
  marker: string,
  row: string,
): Promise<{ under: boolean; atMarker: boolean; atCentre: boolean; cell: string }> {
  return grid.evaluate(
    async (element, { marker, row }) => {
      const frames = () =>
        new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      // The pane of the header row: the Gantt's tree pane, the board's machine column header.
      const pane = (
        element.querySelector('[aria-rowindex="1"] [data-tree-pane]') ??
        element.querySelector('[aria-rowindex="1"] [role="columnheader"]')
      )?.getBoundingClientRect() as DOMRect;
      const target = pane.left + pane.width / 2;
      let box = (element.querySelector(marker) as HTMLElement).getBoundingClientRect();
      for (let attempt = 0; attempt < 4 && Math.abs(box.left - target) > 2; attempt += 1) {
        element.scrollLeft += box.left - target;
        await frames();
        box = (element.querySelector(marker) as HTMLElement).getBoundingClientRect();
      }
      const x = box.left + Math.min(1, box.width / 2);
      const line = element.querySelector(row) as HTMLElement;
      const cells = [
        ...line.querySelectorAll<HTMLElement>(
          '[data-tree-pane] [role="rowheader"], [data-tree-pane] [role="gridcell"], [role="rowheader"][data-sticky-column]',
        ),
      ];
      const cell = cells.find((each) => {
        const rect = each.getBoundingClientRect();
        return rect.left <= x && x < rect.right;
      }) as HTMLElement;
      const rect = cell.getBoundingClientRect();
      const y = rect.top + rect.height / 2;
      const hit = (px: number) => {
        const at = document.elementFromPoint(px, y);
        return at !== null && cell.contains(at);
      };
      return {
        under: x > pane.left && x < pane.right,
        atMarker: hit(x),
        atCentre: hit(rect.left + rect.width / 2),
        cell: cell.getAttribute('role') ?? '',
      };
    },
    { marker, row },
  );
}

test.describe('the left pane of the timelines', () => {
  test('#943 the Gantt tree pane covers the now line, the frozen window, a wait line and a deadline marker scrolled under it', async ({
    page,
    signIn,
  }) => {
    await signIn(planningHref('gantt', { zoom: 'day', from: '2026-11-04' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();
    // The blocks come with their time chunks (ADR 0089); the grid is busy until they are in.
    await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
    const firstJobOrder = '[data-row-kind="jobOrder"]';

    for (const [marker, row] of [
      ['[data-overlay] [data-marker="now"]', firstJobOrder],
      ['[data-overlay] [data-marker="frozen"]', firstJobOrder],
      ['[data-row-id="jo-1003-10"] [data-marker="wait"]', '[data-row-id="jo-1003-10"]'],
      ['[data-row-id="po-1003"] [data-marker="deadline"]', '[data-row-id="po-1003"]'],
    ] as const) {
      const cover = await coverOf(gantt, marker, row);
      expect(cover, marker).toEqual({
        under: true,
        atMarker: true,
        atCentre: true,
        cell: expect.any(String),
      });
    }
  });

  test('#943 the board machine column covers the now line and the frozen window scrolled under it', async ({
    page,
    signIn,
  }) => {
    await signIn(planningHref('board', { zoom: 'week', from: '2026-11-02' }));
    const board = page.getByRole('grid', { name: /board/ });
    await expect(board).toBeVisible();
    await expect(board).not.toHaveAttribute('aria-busy', 'true');

    for (const marker of ['[data-marker="now"]', '[data-marker="frozen"]']) {
      const cover = await coverOf(board, marker, '[role="row"][data-machine]');
      expect(cover, marker).toEqual({
        under: true,
        atMarker: true,
        atCentre: true,
        cell: 'rowheader',
      });
    }
  });

  test('#943 with every column shown the tree pane keeps its width, its header and rows scroll sideways together, and a sideways wheel over it leaves the time area', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(planningHref('gantt', { zoom: 'week', from: '2026-11-02' }));
    await showEveryColumn(page);
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
    await expect(gantt.getByRole('columnheader', { name: 'Lock' })).toBeAttached();

    // A sideways wheel over the pane scrolls the pane, not the time area. The hover may scroll the
    // grid, so the position is read after it.
    const name = gantt.locator('[data-row-id="po-1003"] [role="rowheader"]');
    await name.hover();
    const before = await gantt.evaluate((grid) => grid.scrollLeft);
    await page.mouse.wheel(300, 0);
    await expect
      .poll(() => gantt.evaluate((grid) => grid.style.getPropertyValue('--tree-scroll')))
      .toBe('300px');
    expect(await gantt.evaluate((grid) => grid.scrollLeft)).toBe(before);

    const layout = await gantt.evaluate((grid) => {
      const lefts = (selector: string) =>
        [...grid.querySelectorAll<HTMLElement>(selector)].map(
          (each) => each.getBoundingClientRect().left,
        );
      const pane = (
        grid.querySelector('[aria-rowindex="1"] [data-tree-pane]') as HTMLElement
      ).getBoundingClientRect();
      const time = grid.querySelector('[role="columnheader"][aria-label="Time"]') as HTMLElement;
      // Past the splitter's grab area at the pane's end.
      const at = document.elementFromPoint(pane.right + 8, pane.top + pane.height / 2);
      return {
        header: lefts('[aria-rowindex="1"] [data-tree-pane] [role="columnheader"]'),
        order: lefts('[data-row-id="po-1003"] [data-tree-pane] > * > *'),
        jobOrder: lefts('[data-row-id="jo-1003-10"] [data-tree-pane] > * > *'),
        paneLeft: pane.left,
        paneWidth: pane.width,
        gridWidth: grid.clientWidth,
        time: at !== null && time.contains(at),
      };
    });
    // The cells sit 300 px into the pane, in line with the header in every row.
    expect(layout.header[0]).toBeCloseTo(layout.paneLeft - 300, 0);
    expect(layout.order).toEqual(layout.header);
    expect(layout.jobOrder).toEqual(layout.header);
    // The pane keeps 40 percent of the view, its border included.
    expect(Math.abs(layout.paneWidth - layout.gridWidth * 0.4)).toBeLessThanOrEqual(2);
    expect(layout.time).toBe(true);
    await checkA11y('the Gantt with every tree column shown');
  });

  test('#943 a header that takes focus scrolls into the pane while the time area stays, and the pane scrollbar scrolls the pane', async ({
    page,
    signIn,
  }) => {
    await signIn(planningHref('gantt', { zoom: 'week', from: '2026-11-02' }));
    await showEveryColumn(page);
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
    const time = () => gantt.evaluate((grid) => ({ left: grid.scrollLeft, top: grid.scrollTop }));
    const inPane = (name: string) =>
      gantt.evaluate((grid, name) => {
        const pane = (
          grid.querySelector('[aria-rowindex="1"] [data-tree-pane]') as HTMLElement
        ).getBoundingClientRect();
        const header = [...grid.querySelectorAll<HTMLElement>('[role="columnheader"]')].find(
          (each) => each.textContent === name,
        ) as HTMLElement;
        const box = header.getBoundingClientRect();
        return box.left >= pane.left - 0.5 && box.right <= pane.right + 0.5;
      }, name);

    // Lock, the last column, lies past the pane; Tab reaches it, and the pane scrolls to it.
    await page.getByRole('button', { name: /^Late by/ }).focus();
    const before = await time();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(gantt.getByRole('columnheader', { name: 'Lock' })).toBeFocused();
    expect(await inPane('Lock')).toBe(true);
    expect(await time()).toEqual(before);

    // Focus on the Name column's sort button scrolls the pane back to its start.
    await page.getByRole('button', { name: /^Name/ }).focus();
    await expect
      .poll(() => gantt.evaluate((grid) => grid.style.getPropertyValue('--tree-scroll')))
      .toBe('0px');
    expect(await time()).toEqual(before);

    // The pane's own scrollbar moves the columns in every row.
    await gantt.locator('[data-tree-scroller]').evaluate((bar) => {
      bar.scrollLeft = 200;
    });
    await expect
      .poll(() => gantt.evaluate((grid) => grid.style.getPropertyValue('--tree-scroll')))
      .toBe('200px');
  });

  test('#943 the splitter moves with the pointer and the arrow keys, and the width stays after a reload', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(planningHref('gantt', { zoom: 'week', from: '2026-11-02' }));
    await showEveryColumn(page);
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
    const splitter = page.getByRole('separator', { name: 'Resize the tree pane' });
    const paneWidth = () =>
      gantt
        .locator('[aria-rowindex="1"] [data-tree-pane]')
        .evaluate((pane) => pane.getBoundingClientRect().width);
    const start = await paneWidth();

    // The grip sits over the header row.
    const box = (await splitter.boundingBox()) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 150, y, { steps: 5 });
    await page.mouse.up();
    expect(Math.abs((await paneWidth()) - (start - 150))).toBeLessThanOrEqual(1);
    await expect(splitter).toHaveAttribute('aria-valuenow', /^\d+$/);

    await splitter.focus();
    const narrowed = await paneWidth();
    await page.keyboard.press('ArrowLeft');
    expect(await paneWidth()).toBeLessThan(narrowed);
    await checkA11y('the Gantt with the tree pane narrowed');

    const kept = await paneWidth();
    await page.reload();
    await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
    expect(Math.abs((await paneWidth()) - kept)).toBeLessThanOrEqual(1);
  });
});
