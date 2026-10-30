// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findGantt, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

  it('ADR0089 the time area is a buffer of three viewport widths and scrolls sideways under the sticky tree pane', async () => {
    // The grid measures 900 px.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly report: ResizeObserverCallback) {}
        observe() {
          this.report([{ contentRect: { width: 900 } } as ResizeObserverEntry], this);
        }
        disconnect() {}
        unobserve() {}
      },
    );
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();

    const header = within(gantt).getAllByRole('row')[0] as HTMLElement;
    const [pane, time] = header.style.gridTemplateColumns.split(' ');
    // Three widths of the visible time area, the grid less its tree pane, with closed time
    // compressed into gaps of 6 px, so a gap cut at an edge may add a few pixels.
    const paneWidth = Number.parseFloat(pane ?? '0');
    expect(paneWidth).toBe(Number.parseFloat(gantt.style.scrollPaddingInlineStart));
    expect(Math.abs(Number.parseFloat(time ?? '0') - 3 * (900 - paneWidth))).toBeLessThanOrEqual(7);
    // The header and every row share the template, so the tree pane stays aligned with the rows.
    const row = within(gantt).getByRole('row', { name: /^1003 / });
    expect(row.style.gridTemplateColumns).toBe(header.style.gridTemplateColumns);
    // The tree cells of a row sit in one block, which sticks; position: sticky is read from
    // computed style in e2e/design-rules.spec.ts.
    const [name, deadline] = within(header).getAllByRole('columnheader');
    const headerPane = name?.closest('[data-tree-pane]');
    expect(headerPane).not.toBeNull();
    expect(headerPane?.contains(deadline as HTMLElement)).toBe(true);
    const rowPane = within(row).getByRole('rowheader').closest('[data-tree-pane]');
    expect(rowPane?.contains(within(row).getAllByRole('gridcell')[0] as HTMLElement)).toBe(true);
  });

  it('plan 18 view=gantt fills the viewport height, so the rows scroll inside the grid', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const fill = gantt.closest<HTMLElement>('[data-gantt-fill]');
    // happy-dom's window is 768 px high and lays nothing out, so the grid starts at the top and
    // main's bottom padding is 0: the fill is the whole window, above the least height of 15 rem.
    expect(fill?.style.height).toBe('768px');
  });

  it('plan 18 the fill keeps the least height of 15 rem in a window shorter than that', async () => {
    const { innerHeight } = window;
    try {
      Object.defineProperty(window, 'innerHeight', { value: 200, configurable: true });
      renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
      const gantt = await findGantt();

      const fill = gantt.closest<HTMLElement>('[data-gantt-fill]');
      expect(fill?.style.height).toBe('240px');
    } finally {
      Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true });
    }
  });

  it('#943 with every column shown the tree pane keeps 40 percent of the view and its columns scroll inside it', async () => {
    // Every column shown: 1206 px of tree columns against a pane of 40 percent of 1100 px.
    window.localStorage.setItem(
      'northmes.planning.gantt.options',
      JSON.stringify({ hiddenColumns: [] }),
    );
    try {
      renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
      const gantt = await findGantt();

      const headers = within(gantt).getAllByRole('columnheader');
      expect(headers).toHaveLength(12);
      const header = within(gantt).getAllByRole('row')[0] as HTMLElement;
      expect(header.style.gridTemplateColumns.split(' ')[0]).toBe('440px');
      // Every tree column sits in the one pane, which is wider inside than the pane itself.
      const pane = headers[0]?.closest<HTMLElement>('[data-tree-pane]');
      expect(headers.slice(0, -1).every((each) => pane?.contains(each))).toBe(true);
      const columns = pane?.firstElementChild as HTMLElement;
      expect(columns.style.width).toBe('1206px');
      // The pane's own scrollbar, as wide as the pane, scrolls the columns' full width.
      const scroller = gantt.querySelector<HTMLElement>('[data-tree-scroller]');
      expect(scroller?.style.width).toBe('440px');
      expect((scroller?.firstElementChild as HTMLElement).style.width).toBe('1206px');
      // The Name column keeps its least width, 160 px.
      expect(columns.style.gridTemplateColumns.split(' ')[0]).toBe('160px');
    } finally {
      window.localStorage.removeItem('northmes.planning.gantt.options');
    }
  });

  it('#943 the Name column takes what the pane leaves, and the pane has no scrollbar while its columns fit', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    // Name, Deadline and Float in 440 px: Deadline 128 and Float 96 leave 216 px to Name.
    const name = within(gantt).getAllByRole('columnheader')[0] as HTMLElement;
    const columns = name.closest('[data-tree-pane]')?.firstElementChild as HTMLElement;
    expect(columns.style.gridTemplateColumns).toBe('216px 128px 96px');
    expect(gantt.querySelector('[data-tree-scroller]')).toBeNull();
  });

  it('#943 the splitter is a separator the arrow keys, Home and End move, and the pane width it sets stays in this browser', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const header = within(gantt).getAllByRole('row')[0] as HTMLElement;
    const paneTrack = () => header.style.gridTemplateColumns.split(' ')[0];

    const splitter = screen.getByRole('separator', { name: 'Resize the tree pane' });
    expect(splitter.getAttribute('aria-orientation')).toBe('vertical');
    expect(splitter.getAttribute('aria-valuenow')).toBe('40');
    expect(splitter.tabIndex).toBe(0);

    splitter.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(splitter.getAttribute('aria-valuenow')).toBe('42');
    expect(paneTrack()).toBe('462px');
    expect(
      JSON.parse(window.localStorage.getItem('northmes.planning.gantt.options') ?? '{}'),
    ).toMatchObject({ treePaneShare: 0.42 });

    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(splitter.getAttribute('aria-valuenow')).toBe('38');
    // Home takes the least width, 160 px; End leaves the time area its least width, 160 px.
    await userEvent.keyboard('{Home}');
    expect(paneTrack()).toBe('160px');
    expect(splitter.getAttribute('aria-valuenow')).toBe(splitter.getAttribute('aria-valuemin'));
    await userEvent.keyboard('{End}');
    expect(paneTrack()).toBe('940px');
    expect(splitter.getAttribute('aria-valuenow')).toBe(splitter.getAttribute('aria-valuemax'));
    window.localStorage.removeItem('northmes.planning.gantt.options');
  });

  it('#943 the splitter moves with the pointer', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const header = within(gantt).getAllByRole('row')[0] as HTMLElement;

    const splitter = screen.getByRole('separator', { name: 'Resize the tree pane' });
    fireEvent.pointerDown(splitter, { pointerId: 1, clientX: 500, button: 0 });
    fireEvent.pointerMove(splitter, { pointerId: 1, clientX: 610 });
    fireEvent.pointerUp(splitter, { pointerId: 1, clientX: 610 });

    expect(header.style.gridTemplateColumns.split(' ')[0]).toBe('550px');
    expect(splitter.getAttribute('aria-valuenow')).toBe('50');
    window.localStorage.removeItem('northmes.planning.gantt.options');
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
        within(screen.getByRole('group', { name: 'Zoom' })).getByRole('button', {
          name: 'Zoom in',
        }),
      );

      await waitFor(() => {
        expect(Number.parseFloat(fill.style.height)).toBe(before + 100);
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true });
    }
  });
});
