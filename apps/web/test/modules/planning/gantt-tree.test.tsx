// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { naturalWidthPx, rangeOf } from '../../../src/modules/planning/timeline/time-scale.ts';
import { findGantt, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The rows of the tree at a level, under the treegrid. */
function rowsAtLevel(gantt: HTMLElement, level: number): HTMLElement[] {
  return within(gantt)
    .getAllByRole('row')
    .filter((row) => row.getAttribute('aria-level') === String(level));
}

describe('the order Gantt tree (plan 18, Rows and the tree)', () => {
  it('GT1 renders G1 as 6 orders, 10 operations and 10 job order rows with their levels, sizes and positions', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const orders = rowsAtLevel(gantt, 1);
    const operations = rowsAtLevel(gantt, 2);
    const jobOrders = rowsAtLevel(gantt, 3);
    expect(orders).toHaveLength(6);
    expect(operations).toHaveLength(10);
    expect(jobOrders).toHaveLength(10);
    expect(gantt.getAttribute('aria-rowcount')).toBe(String(26 + 2));
    // The autoplan order: deadline, then priority, then number, so 1003 (Wed) comes first and 1005 and 1006 (next week, no priority) last.
    expect(
      orders.map((row) => within(row).getByRole('rowheader').textContent?.slice(0, 4)),
    ).toEqual(['1003', '1002', '1001', '1004', '1005', '1006']);
    expect(orders[0]?.getAttribute('aria-setsize')).toBe('6');
    expect(orders[2]?.getAttribute('aria-posinset')).toBe('3');
    expect(orders[0]?.getAttribute('aria-expanded')).toBe('true');
    const op = operations.find((row) =>
      within(row).getByRole('rowheader').textContent?.startsWith('1001.20'),
    );
    expect(op?.getAttribute('aria-setsize')).toBe('2');
    expect(op?.getAttribute('aria-posinset')).toBe('2');
    expect(within(op as HTMLElement).getByRole('rowheader').textContent).toContain(
      '2 machines, default CNC 2',
    );
    expect(jobOrders[0]?.getAttribute('aria-expanded')).toBeNull();
  });

  it('GT1 names a summary bar after its row header, its span and whether the order is on time', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    expect(
      within(gantt).getByRole('gridcell', {
        name: 'Order 1001, Tue 3 Nov 11:30 to Thu 5 Nov 10:45, on time',
      }),
    ).toBeTruthy();
    expect(
      within(gantt).getByRole('gridcell', {
        name: 'Order 1003, Wed 4 Nov 08:00 to Thu 5 Nov 06:15, late by 15 h 15 min',
      }),
    ).toBeTruthy();
    expect(
      within(gantt).getByRole('gridcell', {
        name: 'Operation 1001.10 Turn, Tue 3 Nov 11:30 to Wed 4 Nov 08:00',
      }),
    ).toBeTruthy();
  });

  it('GT1 collapsing an order hides its rows and keeps aria-setsize', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await userEvent.click(within(gantt).getByRole('button', { name: 'Collapse order 1001' }));

    const order = within(gantt).getByRole('row', { name: /^1001 / });
    expect(order.getAttribute('aria-expanded')).toBe('false');
    expect(order.getAttribute('aria-setsize')).toBe('6');
    expect(rowsAtLevel(gantt, 2)).toHaveLength(8);
    expect(rowsAtLevel(gantt, 3)).toHaveLength(8);
    expect(gantt.getAttribute('aria-rowcount')).toBe(String(22 + 2));
    expect(within(gantt).queryByRole('row', { name: /^1001\.10 / })).toBeNull();
    await userEvent.click(within(gantt).getByRole('button', { name: 'Expand order 1001' }));
    expect(rowsAtLevel(gantt, 3)).toHaveLength(10);
  });

  it('GT1 shows the default tree columns and the Columns menu shows and hides one', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    expect(
      within(gantt)
        .getAllByRole('columnheader')
        .map((cell) => cell.getAttribute('aria-label') ?? cell.textContent),
    ).toEqual(['Name', 'Deadline', 'Float', 'Time']);
    const order1003 = within(gantt).getByRole('row', { name: /^1003 / });
    // The zone label shows when the host's zone differs from the plant's, as on a CI runner in UTC.
    expect(within(order1003).getAllByRole('gridcell')[0]?.textContent).toMatch(
      /^Wed 4 Nov 15:00( CET)?$/,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Columns' }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Late by' }));

    expect(within(gantt).getByRole('columnheader', { name: 'Late by' })).toBeTruthy();
    expect(within(order1003).getAllByRole('gridcell')[1]?.textContent).toBe('15 h 15 min');
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Deadline' }));
    expect(within(gantt).queryByRole('columnheader', { name: 'Deadline' })).toBeNull();
  });

  it('GT1 shows the Not placed row with no job order and an operation says how many it misses when one is unplaced', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const notPlaced = within(gantt).getByRole('row', { name: /Not placed/ });
    expect(notPlaced.textContent).toContain('No job orders without a place');
  });

  it("plan 18 the time area takes the preset's natural width and scrolls sideways under the sticky tree cells", async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();

    expect(gantt.className).toContain('overflow-auto');
    const header = within(gantt).getAllByRole('row')[0] as HTMLElement;
    const tracks = header.style.gridTemplateColumns.split(' ');
    const timeTrack = Number.parseFloat(tracks[tracks.length - 1] ?? '0');
    const natural = naturalWidthPx(
      rangeOf('2026-11-04', 'day', 'Europe/Stockholm', '06:00'),
      'day',
    );
    expect(timeTrack).toBeGreaterThanOrEqual(natural);
    // The header and every row share the template, so the tree pane stays aligned with the rows.
    const row = within(gantt).getByRole('row', { name: /^1003 / });
    expect(row.style.gridTemplateColumns).toBe(header.style.gridTemplateColumns);
    const [name, deadline] = within(header).getAllByRole('columnheader');
    expect(name?.className).toContain('sticky');
    expect(name?.style.insetInlineStart).toBe('0px');
    expect(deadline?.className).toContain('sticky');
    expect(deadline?.style.insetInlineStart).toBe(`${Number.parseFloat(tracks[0] ?? '0')}px`);
    const cells = within(row).getAllByRole('gridcell');
    expect(cells[0]?.style.insetInlineStart).toBe(deadline?.style.insetInlineStart);
  });

  it('plan 18 view=gantt fills the viewport height, so the rows scroll inside the grid', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const fill = gantt.closest<HTMLElement>('[data-gantt-fill]');
    const top = fill?.getBoundingClientRect().top ?? 0;
    // The gap under the grid is main's bottom padding, which the test's stylesheet-free page has
    // as 0; the least height is 15 rem.
    const main = fill?.closest('main');
    const gap =
      main === null || main === undefined
        ? 0
        : Number.parseFloat(getComputedStyle(main).paddingBottom) || 0;
    expect(fill?.style.height).toBe(`${Math.max(15 * 16, window.innerHeight - top - gap)}px`);
    expect(gantt.className).toContain('min-h-0');
    expect(gantt.className).toContain('flex-1');
    const header = within(gantt).getAllByRole('row')[0] as HTMLElement;
    expect(header.className).toContain('sticky');
    expect(within(gantt).getByRole('row', { name: /Not placed/ }).className).toContain('sticky');
  });

  it("WCAG 1.4.10 only the Name column sticks when the shown columns exceed the pane's cap", async () => {
    // Every column shown: 1320 px of tree against a cap of 40 percent of 1100 px.
    window.localStorage.setItem(
      'northmes.planning.gantt.options',
      JSON.stringify({ hiddenColumns: [] }),
    );
    try {
      renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
      const gantt = await findGantt();

      const headers = within(gantt).getAllByRole('columnheader');
      expect(headers).toHaveLength(12);
      expect(headers[0]?.className).toContain('sticky');
      expect(headers[1]?.className).not.toContain('sticky');
      const row = within(gantt).getByRole('row', { name: /^1003 / });
      expect(within(row).getByRole('rowheader').className).toContain('sticky');
      expect(within(row).getAllByRole('gridcell')[0]?.className).not.toContain('sticky');
    } finally {
      window.localStorage.removeItem('northmes.planning.gantt.options');
    }
  });

  it('plan 18 the fill height is measured again when the window or the zoom changes', async () => {
    const { innerHeight } = window;
    try {
      renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
      const gantt = await findGantt();
      const fill = gantt.closest<HTMLElement>('[data-gantt-fill]') as HTMLElement;
      const before = Number.parseFloat(fill.style.height);

      Object.defineProperty(window, 'innerHeight', {
        value: innerHeight + 100,
        configurable: true,
      });
      await userEvent.click(
        within(screen.getByRole('group', { name: 'Zoom' })).getByRole('button', { name: 'Day' }),
      );

      await waitFor(() => {
        expect(Number.parseFloat(fill.style.height)).toBe(before + 100);
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true });
    }
  });
});
