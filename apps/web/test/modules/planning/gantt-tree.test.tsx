// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { findDetails, findGantt, renderGanttRoute, sourceOf } from './gantt-fixtures.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.removeItem('northmes.planning.gantt.options');
});

/**
 * G1 with 1003.10 split in two parts of 300 pcs: the first keeps its place on CNC 1, the second
 * has no machine yet, so it sits in the Not placed row.
 */
function splitSource() {
  const snapshot = g1Snapshot();
  return sourceOf({
    ...snapshot,
    productionOrders: snapshot.productionOrders.map((order) => {
      if (order.number !== '1003') return order;
      const turn = order.jobOrders.find((each) => each.id === 'jo-1003-10');
      if (turn === undefined) throw new Error('G1 has no jo-1003-10');
      const { equipment: _, placement: __, ...unplaced } = turn;
      return {
        ...order,
        jobOrders: [
          ...order.jobOrders.map((each) => (each === turn ? { ...turn, quantity: 300 } : each)),
          { ...unplaced, id: 'jo-1003-10-2', quantity: 300 },
        ],
      };
    }),
  });
}

/** The row header of a row by its id. */
function headerOf(gantt: HTMLElement, rowId: string): HTMLElement {
  const row = gantt.querySelector<HTMLElement>(`[data-row-id="${rowId}"]`);
  if (row === null) throw new Error(`No row ${rowId}`);
  return within(row).getByRole('rowheader');
}

/** The rows of the tree at a level, under the treegrid. */
function rowsAtLevel(gantt: HTMLElement, level: number): HTMLElement[] {
  return within(gantt)
    .getAllByRole('row')
    .filter((row) => row.getAttribute('aria-level') === String(level));
}

describe('the order Gantt tree (plan 18, Rows and the tree)', () => {
  it('GT1 renders G1 as 6 order rows at level 1 and 10 job order rows at level 2 with their sizes and positions, and no level 3', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const orders = rowsAtLevel(gantt, 1);
    const jobOrders = rowsAtLevel(gantt, 2);
    expect(orders).toHaveLength(6);
    expect(jobOrders).toHaveLength(10);
    expect(rowsAtLevel(gantt, 3)).toHaveLength(0);
    expect(gantt.getAttribute('aria-rowcount')).toBe(String(16 + 2));
    // The autoplan order: deadline, then priority, then number, so 1003 (Wed) comes first and 1005 and 1006 (next week, no priority) last.
    expect(
      orders.map((row) => within(row).getByRole('rowheader').textContent?.slice(0, 4)),
    ).toEqual(['1003', '1002', '1001', '1004', '1005', '1006']);
    expect(orders[0]?.getAttribute('aria-setsize')).toBe('6');
    expect(orders[2]?.getAttribute('aria-posinset')).toBe('3');
    expect(orders[0]?.getAttribute('aria-expanded')).toBe('true');
    const mill = jobOrders.find((row) => row.getAttribute('data-row-id') === 'jo-1001-20');
    expect(mill?.getAttribute('data-row-kind')).toBe('jobOrder');
    expect(mill?.getAttribute('aria-setsize')).toBe('2');
    expect(mill?.getAttribute('aria-posinset')).toBe('2');
    expect(mill?.getAttribute('aria-expanded')).toBeNull();
  });

  it('GT1 heads a job order row with its operation number and name, then its machine, quantity and status', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const turn = gantt.querySelector('[data-row-id="jo-1003-10"]') as HTMLElement;
    const header = within(turn).getByRole('rowheader');
    expect(within(header).getByText('1003.10 Turn')).toBeTruthy();
    expect(within(header).getByText('CNC 1, 600 pcs, Planned')).toBeTruthy();
  });

  it('GT1 names a summary bar after its row header, its span and whether the order is on time, and draws one per order only', async () => {
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
    expect(within(gantt).getAllByRole('gridcell', { name: /^Order \d{4}, / })).toHaveLength(6);
    expect(within(gantt).queryAllByRole('gridcell', { name: /^Operation / })).toHaveLength(0);
  });

  it('GT1 collapsing an order hides its rows and keeps aria-setsize', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await userEvent.click(within(gantt).getByRole('button', { name: 'Collapse order 1001' }));

    const order = within(gantt).getByRole('row', { name: /^1001 / });
    expect(order.getAttribute('aria-expanded')).toBe('false');
    expect(order.getAttribute('aria-setsize')).toBe('6');
    expect(rowsAtLevel(gantt, 2)).toHaveLength(8);
    expect(gantt.getAttribute('aria-rowcount')).toBe(String(14 + 2));
    expect(gantt.querySelector('[data-row-id="jo-1001-10"]')).toBeNull();
    await userEvent.click(within(gantt).getByRole('button', { name: 'Expand order 1001' }));
    expect(rowsAtLevel(gantt, 2)).toHaveLength(10);
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

    // The columns are in the View menu (ADR 0090).
    await userEvent.click(screen.getByRole('button', { name: 'View' }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Late by' }));

    expect(within(gantt).getByRole('columnheader', { name: 'Late by' })).toBeTruthy();
    expect(within(order1003).getAllByRole('gridcell')[1]?.textContent).toBe('15 h 15 min');
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Deadline' }));
    expect(within(gantt).queryByRole('columnheader', { name: 'Deadline' })).toBeNull();
  });

  it('plan 18 the Machine and Lock columns fill on job order rows, with the hard lock of 1002.10, and stay empty on order rows', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await userEvent.click(screen.getByRole('button', { name: 'View' }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Machine' }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Lock' }));
    await userEvent.keyboard('{Escape}');
    await within(gantt).findByRole('columnheader', { name: 'Lock' });

    const cellsOf = (rowId: string) => {
      const row = gantt.querySelector<HTMLElement>(`[data-row-id="${rowId}"]`);
      if (row === null) throw new Error(`No row ${rowId}`);
      const headers = within(gantt)
        .getAllByRole('columnheader')
        .map((cell) => cell.getAttribute('aria-label') ?? cell.textContent);
      const cells = within(row).getAllByRole('gridcell');
      return {
        machine: cells[headers.indexOf('Machine') - 1]?.textContent,
        lock: cells[headers.indexOf('Lock') - 1]?.textContent,
      };
    };
    expect(cellsOf('jo-1002-10')).toEqual({ machine: 'CNC 2', lock: 'Hard lock' });
    expect(cellsOf('jo-1003-10')).toEqual({ machine: 'CNC 1', lock: '' });
    expect(cellsOf('po-1002')).toEqual({ machine: '', lock: '' });
  });

  it('plan 18 an order with no job orders is a leaf row: no aria-expanded and no Expand or Collapse button', async () => {
    const snapshot = g1Snapshot();
    renderGanttRoute(
      { zoom: 'week', from: '2026-11-02' },
      sourceOf({
        ...snapshot,
        productionOrders: snapshot.productionOrders.map((order) =>
          order.number === '1006' ? { ...order, jobOrders: [] } : order,
        ),
      }),
    );
    const gantt = await findGantt();

    const order = gantt.querySelector<HTMLElement>('[data-row-id="po-1006"]');
    expect(order?.getAttribute('aria-level')).toBe('1');
    expect(order?.hasAttribute('aria-expanded')).toBe(false);
    expect(within(gantt).getByRole('button', { name: 'Collapse order 1005' })).toBeTruthy();
    expect(
      within(gantt).queryByRole('button', { name: /^(Expand|Collapse) order 1006$/ }),
    ).toBeNull();
  });

  it('GT1 shows the Not placed row with no job order', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const notPlaced = within(gantt).getByRole('row', { name: /^Not placed/ });
    expect(notPlaced.textContent).toContain('No job orders without a place');
  });

  it('GT1 shows the hard lock of 1002.10 as a Locked badge on its job order row', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    expect(within(headerOf(gantt, 'jo-1002-10')).getByText('Locked')).toBeTruthy();
    expect(within(headerOf(gantt, 'jo-1003-10')).queryByText('Locked')).toBeNull();
  });

  it('plan 18 a split operation shows one job order row per part under its order, each with the operation number and its part marker', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, splitSource());
    const gantt = await findGantt();

    const order = within(gantt).getByRole('row', { name: /^1003 / });
    const rows = within(gantt).getAllByRole('row');
    const under = rows.slice(rows.indexOf(order) + 1, rows.indexOf(order) + 4);
    expect(under.map((row) => row.getAttribute('data-row-id'))).toEqual([
      'jo-1003-10',
      'jo-1003-10-2',
      'jo-1003-20',
    ]);
    expect(under.map((row) => row.getAttribute('aria-level'))).toEqual(['2', '2', '2']);
    expect(order.getAttribute('aria-level')).toBe('1');
    expect(within(headerOf(gantt, 'jo-1003-10')).getByText('1003.10 Turn (1 of 2)')).toBeTruthy();
    expect(within(headerOf(gantt, 'jo-1003-10-2')).getByText('1003.10 Turn (2 of 2)')).toBeTruthy();
    expect(within(headerOf(gantt, 'jo-1003-20')).getByText('1003.20 Mill')).toBeTruthy();
  });

  it('plan 18 the block, the hover card and the Details title of a part carry its part marker', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, splitSource());
    const gantt = await findGantt();

    const block = gantt.querySelector<HTMLElement>('[data-block="jo-1003-10"]');
    if (block === null) throw new Error('No block jo-1003-10');
    expect(block.getAttribute('aria-label')).toMatch(/^1003\.10 Turn \(1 of 2\), /);
    block.focus();
    expect((await screen.findByRole('tooltip')).textContent).toContain('1003.10 Turn (1 of 2)');
    await userEvent.keyboard('{Enter}');
    const details = await findDetails();
    expect(within(details).getByRole('heading', { level: 2 }).textContent).toBe(
      '1003.10 Turn (1 of 2)',
    );
  });

  it('plan 18 the part marker counts the parts in the row order, by start, not by id', async () => {
    const snapshot = g1Snapshot();
    const hour = 3_600_000;
    renderGanttRoute(
      { zoom: 'week', from: '2026-11-02' },
      sourceOf({
        ...snapshot,
        productionOrders: snapshot.productionOrders.map((order) => {
          if (order.number !== '1003') return order;
          const turn = order.jobOrders.find((each) => each.id === 'jo-1003-10');
          const placement = turn?.placement;
          if (turn === undefined || placement === undefined) throw new Error('G1 places 1003.10');
          // The first part by id starts two hours after the second.
          const later = {
            setupStartMs: placement.setupStartMs + 2 * hour,
            runStartMs: placement.runStartMs + 2 * hour,
            endMs: placement.endMs + 2 * hour,
            segments: placement.segments.map((segment) => ({
              fromMs: segment.fromMs + 2 * hour,
              toMs: segment.toMs + 2 * hour,
            })),
          };
          return {
            ...order,
            jobOrders: [
              ...order.jobOrders.map((each) =>
                each === turn ? { ...turn, quantity: 300, placement: later } : each,
              ),
              { ...turn, id: 'jo-1003-10-2', quantity: 300 },
            ],
          };
        }),
      }),
    );
    const gantt = await findGantt();

    const rows = within(gantt).getAllByRole('row');
    const order = within(gantt).getByRole('row', { name: /^1003 / });
    expect(
      rows
        .slice(rows.indexOf(order) + 1, rows.indexOf(order) + 3)
        .map((row) => row.getAttribute('data-row-id')),
    ).toEqual(['jo-1003-10-2', 'jo-1003-10']);
    expect(within(headerOf(gantt, 'jo-1003-10-2')).getByText('1003.10 Turn (1 of 2)')).toBeTruthy();
    expect(within(headerOf(gantt, 'jo-1003-10')).getByText('1003.10 Turn (2 of 2)')).toBeTruthy();
  });

  it('plan 18 a job order without a machine sits in the Not placed row and its own row says Not placed where the machine would be', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, splitSource());
    const gantt = await findGantt();

    expect(
      within(headerOf(gantt, 'jo-1003-10-2')).getByText('Not placed, 300 pcs, Planned'),
    ).toBeTruthy();
    const notPlaced = within(gantt).getByRole('row', { name: /^Not placed/ });
    expect(notPlaced.textContent).toContain('1003.10');
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

  it('plan 18 the Gantt page fills the viewport height, so the rows scroll inside the grid', async () => {
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

  it('#943 with every column shown the tree pane keeps 40 percent of the view, holds every column and has its own scrollbar', async () => {
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
      const scroller = gantt.querySelector<HTMLElement>('[data-tree-scroller]') as HTMLElement;
      expect(scroller.style.width).toBe('440px');
      expect((scroller.firstElementChild as HTMLElement).style.width).toBe('1206px');
      // The Name column keeps its least width, 160 px.
      expect(columns.style.gridTemplateColumns.split(' ')[0]).toBe('160px');
    } finally {
      window.localStorage.removeItem('northmes.planning.gantt.options');
    }
  });

  it('#943 the Name column takes what the pane leaves, and the pane has no scrollbar while its columns fit', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    // Name, Deadline and Float in 440 px less the pane's 1 px end border: Deadline 128 and Float
    // 96 leave 215 px to Name.
    const name = within(gantt).getAllByRole('columnheader')[0] as HTMLElement;
    const columns = name.closest('[data-tree-pane]')?.firstElementChild as HTMLElement;
    expect(columns.style.gridTemplateColumns).toBe('215px 128px 96px');
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

  it('#943 the splitter follows the pointer and sets the pane when the pointer is released', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const header = within(gantt).getAllByRole('row')[0] as HTMLElement;
    const paneTrack = () => header.style.gridTemplateColumns.split(' ')[0];

    const splitter = screen.getByRole('separator', { name: 'Resize the tree pane' });
    expect(splitter.getAttribute('aria-controls')).toBe(gantt.id);
    fireEvent.pointerDown(splitter, { pointerId: 1, clientX: 500, button: 0 });
    fireEvent.pointerMove(splitter, { pointerId: 1, clientX: 610, buttons: 1 });
    // The splitter shows where the pane will end; the grid lays out once, on release.
    expect(splitter.style.left).toBe('551px');
    expect(paneTrack()).toBe('440px');
    fireEvent.pointerUp(splitter, { pointerId: 1, clientX: 610 });

    expect(paneTrack()).toBe('550px');
    expect(splitter.getAttribute('aria-valuenow')).toBe('50');
  });

  it('#943 a splitter drag whose pointer capture is lost leaves the pane as it was', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const header = within(gantt).getAllByRole('row')[0] as HTMLElement;

    const splitter = screen.getByRole('separator', { name: 'Resize the tree pane' });
    fireEvent.pointerDown(splitter, { pointerId: 1, clientX: 500, button: 0 });
    fireEvent.pointerMove(splitter, { pointerId: 1, clientX: 610, buttons: 1 });
    fireEvent.lostPointerCapture(splitter, { pointerId: 1 });
    // A later hover with no button pressed moves nothing.
    fireEvent.pointerMove(splitter, { pointerId: 1, clientX: 700, buttons: 0 });

    expect(header.style.gridTemplateColumns.split(' ')[0]).toBe('440px');
    expect(splitter.style.left).toBe('441px');
  });

  it('#943 a pointer move with no button pressed ends a splitter drag, and a click on the grip keeps the width chosen', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const header = within(gantt).getAllByRole('row')[0] as HTMLElement;

    const splitter = screen.getByRole('separator', { name: 'Resize the tree pane' });
    fireEvent.pointerDown(splitter, { pointerId: 1, clientX: 500, button: 0 });
    fireEvent.pointerMove(splitter, { pointerId: 1, clientX: 610, buttons: 1 });
    // The release went elsewhere: the next move has no button pressed.
    fireEvent.pointerMove(splitter, { pointerId: 1, clientX: 650, buttons: 0 });
    expect(splitter.style.left).toBe('441px');
    fireEvent.pointerUp(splitter, { pointerId: 1, clientX: 650 });
    expect(header.style.gridTemplateColumns.split(' ')[0]).toBe('440px');

    // A press and release without a move saves nothing.
    fireEvent.pointerDown(splitter, { pointerId: 1, clientX: 500, button: 0 });
    fireEvent.pointerUp(splitter, { pointerId: 1, clientX: 500 });
    expect(window.localStorage.getItem('northmes.planning.gantt.options')).toBeNull();
  });

  it('#943 the View menu sets the tree pane width with one click, the alternative to the drag (WCAG 2.5.7)', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const header = within(gantt).getAllByRole('row')[0] as HTMLElement;

    await userEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(
      screen.getByRole('menuitemradio', { name: 'Medium tree pane' }).getAttribute('aria-checked'),
    ).toBe('true');
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Wide tree pane' }));

    expect(header.style.gridTemplateColumns.split(' ')[0]).toBe('660px');
    expect(
      screen.getByRole('separator', { name: 'Resize the tree pane' }).getAttribute('aria-valuenow'),
    ).toBe('60');
  });

  it("#943 a sideways wheel over the tree pane scrolls the pane and its vertical part the rows, a vertical wheel stays the grid's, and hiding columns brings the pane back within its columns", async () => {
    window.localStorage.setItem(
      'northmes.planning.gantt.options',
      JSON.stringify({ hiddenColumns: [] }),
    );
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const rowheader = within(within(gantt).getByRole('row', { name: /^1003 / })).getByRole(
      'rowheader',
    );

    const wheel = new WheelEvent('wheel', {
      deltaX: 300,
      deltaY: 40,
      bubbles: true,
      cancelable: true,
    });
    rowheader.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(gantt.style.getPropertyValue('--tree-scroll')).toBe('300px');
    // The vertical part of a diagonal swipe still scrolls the rows.
    expect(gantt.scrollTop).toBe(40);

    // A vertical wheel is the grid's own.
    const down = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    rowheader.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'View' }));
    for (const name of ['Machine', 'Quantity', 'Start', 'End', 'Working time', 'Late by']) {
      await userEvent.click(screen.getByRole('menuitemcheckbox', { name }));
    }
    // Deadline, Float, Status and Lock: 394 px beside Name's 160 in a 440 px pane.
    await waitFor(() => {
      expect(gantt.style.getPropertyValue('--tree-scroll')).toBe('115px');
    });
  });

  it("#943 the selection bar sits on the tree pane, not in its cells, so it stays at the pane's start edge", async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02', order: 'po-1003' });
    const gantt = await findGantt();
    const row = within(gantt).getByRole('row', { name: /^1003 / });

    const bar = row.querySelector('[data-tree-pane] > [data-selection-bar]');
    expect(bar).not.toBeNull();
    expect(
      within(gantt)
        .getByRole('row', { name: /^1002 / })
        .querySelector('[data-selection-bar]'),
    ).toBeNull();
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
