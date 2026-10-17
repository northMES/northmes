// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { findGantt, renderBoardRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The rows of the tree at a level, under the treegrid. */
function rowsAtLevel(gantt: HTMLElement, level: number): HTMLElement[] {
  return within(gantt)
    .getAllByRole('row')
    .filter((row) => row.getAttribute('aria-level') === String(level));
}

describe('the order Gantt tree (plan 18, Rows and the tree)', () => {
  it('GT1 renders G1 as 5 orders, 8 operations and 8 job order rows with their levels, sizes and positions', async () => {
    renderBoardRoute({ view: 'gantt', zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const orders = rowsAtLevel(gantt, 1);
    const operations = rowsAtLevel(gantt, 2);
    const jobOrders = rowsAtLevel(gantt, 3);
    expect(orders).toHaveLength(5);
    expect(operations).toHaveLength(8);
    expect(jobOrders).toHaveLength(8);
    expect(gantt.getAttribute('aria-rowcount')).toBe(String(21 + 2));
    // The autoplan order: deadline, then priority, so 1003 (Wed) comes first and 1006 (next week) last.
    expect(
      orders.map((row) => within(row).getByRole('rowheader').textContent?.slice(0, 4)),
    ).toEqual(['1003', '1002', '1001', '1004', '1006']);
    expect(orders[0]?.getAttribute('aria-setsize')).toBe('5');
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
    renderBoardRoute({ view: 'gantt', zoom: 'week', from: '2026-11-02' });
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
    renderBoardRoute({ view: 'gantt', zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await userEvent.click(within(gantt).getByRole('button', { name: 'Collapse order 1001' }));

    const order = within(gantt).getByRole('row', { name: /^1001 / });
    expect(order.getAttribute('aria-expanded')).toBe('false');
    expect(order.getAttribute('aria-setsize')).toBe('5');
    expect(rowsAtLevel(gantt, 2)).toHaveLength(6);
    expect(rowsAtLevel(gantt, 3)).toHaveLength(6);
    expect(gantt.getAttribute('aria-rowcount')).toBe(String(17 + 2));
    expect(within(gantt).queryByRole('row', { name: /^1001\.10 / })).toBeNull();
    await userEvent.click(within(gantt).getByRole('button', { name: 'Expand order 1001' }));
    expect(rowsAtLevel(gantt, 3)).toHaveLength(8);
  });

  it('GT1 shows the default tree columns and the Columns menu hides one', async () => {
    renderBoardRoute({ view: 'gantt', zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    expect(
      within(gantt)
        .getAllByRole('columnheader')
        .map((cell) => cell.getAttribute('aria-label') ?? cell.textContent),
    ).toEqual(['Name', 'Machine', 'Start', 'End', 'Deadline', 'Late by', 'Float', 'Time']);
    const order1003 = within(gantt).getByRole('row', { name: /^1003 / });
    const cells = within(order1003).getAllByRole('gridcell');
    expect(cells[3]?.textContent).toBe('Wed 4 Nov 15:00');
    expect(cells[4]?.textContent).toBe('15 h 15 min');

    await userEvent.click(screen.getByRole('button', { name: 'Columns' }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Machine' }));

    expect(within(gantt).queryByRole('columnheader', { name: 'Machine' })).toBeNull();
  });

  it('GT1 shows the Not placed row with no job order and an operation says how many it misses when one is unplaced', async () => {
    renderBoardRoute({ view: 'gantt', zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const notPlaced = within(gantt).getByRole('row', { name: /Not placed/ });
    expect(notPlaced.textContent).toContain('No job orders without a place');
  });
});
