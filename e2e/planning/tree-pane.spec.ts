// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import type { Locator, Page } from '@playwright/test';
import { expect, plant, test } from '../fixtures.ts';

// The left pane of the timelines (#943): the order Gantt's tree pane and the planning board's
// machine column cover whatever the time area draws under them at every scroll position. The
// Gantt's tree pane sticks as one block at the width its splitter sets and scrolls sideways on its
// own when its columns are wider. Every tree column but Name, and the board's machine column,
// resizes by its header edge and from the keyboard. G1's now is Mon 2 Nov 09:40.

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
    await signIn(planningHref('gantt', { zoom: 'day', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    const firstJobOrder = '[data-row-kind="jobOrder"]';

    // Each marker from a view that holds it, at Day zoom, where the wait lines show: now and the
    // frozen window on Monday, 1003's wait and deadline on Wednesday.
    for (const [from, marker, row] of [
      ['2026-11-02', '[data-overlay] [data-marker="now"]', firstJobOrder],
      ['2026-11-02', '[data-overlay] [data-marker="frozen"]', firstJobOrder],
      [
        '2026-11-04',
        '[data-row-id="jo-1003-10"] [data-marker="wait"]',
        '[data-row-id="jo-1003-10"]',
      ],
      ['2026-11-04', '[data-row-id="po-1003"] [data-marker="deadline"]', '[data-row-id="po-1003"]'],
    ] as const) {
      await page.goto(planningHref('gantt', { zoom: 'day', from }));
      // The blocks come with their time chunks (ADR 0089); the grid is busy until they are in.
      await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
      await expect(gantt.locator(marker)).toBeAttached();
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
      // Past the splitter's grip, which reaches 12 px over the time header.
      const at = document.elementFromPoint(pane.right + 20, pane.top + pane.height / 2);
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

    // Lock, the last column, lies past the pane; Tab reaches it, and the pane scrolls to it. The
    // browser's own focus scroll of the grid is undone at the next scroll event, so the position
    // is read before any focus and polled after.
    const before = await time();
    // From Late by's sort button: its resize handle, then Float's, Status's and Lock's.
    await page.getByRole('button', { name: /^Late by/ }).focus();
    for (let step = 0; step < 4; step += 1) await page.keyboard.press('Tab');
    await expect(gantt.getByRole('separator', { name: 'Resize the Lock column' })).toBeFocused();
    await expect.poll(() => inPane('Lock')).toBe(true);
    await expect.poll(time).toEqual(before);

    // Focus on the Name column's sort button scrolls the pane back to its start.
    await page.getByRole('button', { name: /^Name/ }).focus();
    await expect
      .poll(() => gantt.evaluate((grid) => grid.style.getPropertyValue('--tree-scroll')))
      .toBe('0px');
    await expect.poll(time).toEqual(before);

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

    // The View menu offers the widths in one click (WCAG 2.5.7).
    await page.getByRole('button', { name: 'View' }).click();
    await expect(page.getByRole('menuitemradio', { name: 'Wide tree pane' })).toBeVisible();
    await checkA11y('the Gantt View menu with the tree pane widths');
    await page.keyboard.press('Escape');

    const kept = await paneWidth();
    await page.reload();
    await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
    expect(Math.abs((await paneWidth()) - kept)).toBeLessThanOrEqual(1);
  });

  test('#943 a Gantt column resizes by its header edge, the last one beside the splitter too, by the keys and by Narrower and Wider, keeps its least width, and keeps the width after a reload', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(planningHref('gantt', { zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
    const width = (name: string) =>
      gantt
        .getByRole('columnheader', { name, exact: true })
        .evaluate((header) => header.getBoundingClientRect().width);
    const handle = gantt.getByRole('separator', { name: 'Resize the Deadline column' });
    const start = await width('Deadline');

    // While every column has its default width, Float, the last one, ends at the pane's edge
    // beside the splitter's grip; its handle still takes a drag there.
    const float = gantt.getByRole('separator', { name: 'Resize the Float column' });
    const floatBox = (await float.boundingBox()) as { x: number; y: number; height: number };
    const floatWidth = await width('Float');
    await page.mouse.move(floatBox.x + 6, floatBox.y + floatBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(floatBox.x + 22, floatBox.y + floatBox.height / 2, { steps: 4 });
    await page.mouse.up();
    expect(Math.abs((await width('Float')) - (floatWidth + 16))).toBeLessThanOrEqual(1);

    const box = (await handle.boundingBox()) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width - 4, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 36, y, { steps: 4 });
    await page.mouse.up();
    expect(Math.abs((await width('Deadline')) - (start + 40))).toBeLessThanOrEqual(1);
    // The release did not sort.
    await expect(gantt.getByRole('columnheader', { name: 'Deadline' })).toHaveAttribute(
      'aria-sort',
      'none',
    );

    await gantt.getByRole('button', { name: /^Deadline/ }).focus();
    await page.keyboard.press('Alt+ArrowRight');
    expect(Math.abs((await width('Deadline')) - (start + 48))).toBeLessThanOrEqual(1);

    // The least width, 72 px for Float, holds however often Left is pressed.
    const least = 72;
    await float.focus();
    for (let step = 0; step < 12; step += 1) await page.keyboard.press('ArrowLeft');
    await expect(float).toHaveAttribute('aria-valuenow', String(least));
    expect(Math.abs((await width('Float')) - least)).toBeLessThanOrEqual(1);

    // A click on a handle shows Narrower and Wider, the one-click alternative to the drag.
    await gantt.getByRole('separator', { name: 'Resize the Deadline column' }).click();
    await expect(gantt.getByRole('group', { name: 'Deadline column width' })).toBeVisible();
    await checkA11y('the Gantt with resized tree columns and the width buttons of Deadline');
    await gantt.getByRole('button', { name: 'Widen the Deadline column' }).click();
    expect(Math.abs((await width('Deadline')) - (start + 64))).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');

    await page.reload();
    await expect(gantt).not.toHaveAttribute('aria-busy', 'true');
    expect(Math.abs((await width('Deadline')) - (start + 64))).toBeLessThanOrEqual(1);
    expect(Math.abs((await width('Float')) - least)).toBeLessThanOrEqual(1);
  });

  test('#943 the board machine column resizes by its header edge and Alt with the arrows in the grid, and keeps the width after a reload', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(planningHref('board', { zoom: 'week', from: '2026-11-02' }));
    const board = page.getByRole('grid', { name: /board/ });
    await expect(board).not.toHaveAttribute('aria-busy', 'true');
    const width = () =>
      board
        .locator('[aria-rowindex="1"] [role="columnheader"]')
        .first()
        .evaluate((header) => header.getBoundingClientRect().width);
    const start = await width();

    const handle = board.getByRole('separator', { name: 'Resize the Machines column' });
    const box = (await handle.boundingBox()) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width - 4, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 36, y, { steps: 4 });
    // The column waits for the release; a line shows where its edge goes.
    await expect(board.locator('[data-column-resize-line]')).toBeVisible();
    expect(await width()).toBe(start);
    await page.mouse.up();
    expect(Math.abs((await width()) - (start + 40))).toBeLessThanOrEqual(1);

    const machine = board.getByRole('rowheader', { name: 'CNC 1' });
    await machine.focus();
    await page.keyboard.press('Alt+ArrowLeft');
    expect(Math.abs((await width()) - (start + 32))).toBeLessThanOrEqual(1);
    await expect(machine).toBeFocused();
    await checkA11y('the board with the machine column resized');

    await page.reload();
    await expect(board).not.toHaveAttribute('aria-busy', 'true');
    expect(Math.abs((await width()) - (start + 32))).toBeLessThanOrEqual(1);
  });
});
