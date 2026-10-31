// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type GanttDataSource, g1DataSource } from '../../../src/modules/planning/gantt-data.ts';
import { PlanningRefusal } from '../../../src/modules/planning/planning-preview.ts';
import { politeRegionId } from '../../../src/ui/lib/announce.ts';
import { findGantt, measureGridsAt, renderGanttRoute } from './gantt-fixtures.tsx';

// The order filter above the timeline (ADR 0090, The order filter; #940): `q` in the URL, the
// matching orders drawn, every job order still loaded for the move rules.

beforeEach(() => measureGridsAt(1400));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.removeItem('northmes.planning.gantt.options');
});

/** The order numbers of the Gantt's order rows, in their order. */
const orderRows = (gantt: HTMLElement) =>
  [...gantt.querySelectorAll('[data-row-id^="po-"]')].map((row) => row.getAttribute('data-row-id'));

/** The job orders the board draws, by their numbers. */
const boardBlocks = (board: HTMLElement) =>
  [...board.querySelectorAll('[role="gridcell"][data-job-order]')].map((cell) =>
    cell.getAttribute('data-job-order'),
  );

/** The board grid, once it has loaded. */
async function findBoard(): Promise<HTMLElement> {
  return waitFor(() => {
    const board = screen.getByRole('grid', { name: /board/ });
    if (board.getAttribute('aria-busy') === 'true') throw new Error('The board is loading');
    return board;
  });
}

/** A source that counts the row list's reads by their filter, and may hold the filtered ones. */
function countingRows(hold?: Promise<void>) {
  const searches: (string | undefined)[] = [];
  const chunkFilters: unknown[] = [];
  const source: GanttDataSource = {
    ...g1DataSource,
    loadRows: async (filter, page, options) => {
      searches.push(filter.search);
      if (filter.search !== undefined && hold !== undefined) await hold;
      return g1DataSource.loadRows(filter, page, options);
    },
    loadChunk: (from, to, filter, options) => {
      chunkFilters.push(filter);
      return g1DataSource.loadChunk(from, to, filter, options);
    },
  };
  return { source, searches, chunkFilters };
}

describe('the order filter on the order Gantt (ADR 0090)', () => {
  it('#940 typing an order number shows only that order, writes q, and loads the rows by it while the chunks load every job order', async () => {
    const { source, searches, chunkFilters } = countingRows();
    const router = renderGanttRoute({ from: '2026-11-02' }, source);
    const gantt = await findGantt();
    const filter = screen.getByRole('searchbox', { name: 'Filter orders' });

    await userEvent.type(filter, '1003');

    await waitFor(() => expect(orderRows(gantt)).toEqual(['po-1003']));
    expect(router.state.location.search.q).toBe('1003');
    expect(searches).toContain('1003');
    expect(chunkFilters.every((each) => JSON.stringify(each) === '{}')).toBe(true);
  });

  it('#940 a link with q opens filtered at its start, and Clear filter brings every order back, keeps the scroll position and focuses the field', async () => {
    // 1003 starts on Wed 4 Nov; the link's start, Mon 2 Nov 06:00, stays.
    const router = renderGanttRoute({ from: '2026-11-02T06:00', q: '1003' });
    const gantt = await findGantt();
    await waitFor(() => expect(orderRows(gantt)).toEqual(['po-1003']));
    expect(router.state.location.search.from).toBe('2026-11-02T06:00');
    const left = gantt.scrollLeft;

    await userEvent.click(screen.getByRole('button', { name: 'Clear filter' }));

    await waitFor(() => expect(orderRows(gantt)).toHaveLength(6));
    expect('q' in router.state.location.search).toBe(false);
    expect(gantt.scrollLeft).toBe(left);
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Filter orders' }));
  });

  it('#940 Escape in the field empties it and brings every order back', async () => {
    renderGanttRoute({ from: '2026-11-02', q: '1003' });
    const gantt = await findGantt();
    await waitFor(() => expect(orderRows(gantt)).toEqual(['po-1003']));

    screen.getByRole('searchbox', { name: 'Filter orders' }).focus();
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(orderRows(gantt)).toHaveLength(6));
  });

  it('#940 with no match the grid shows an empty state that names the filter and offers Clear filter', async () => {
    const router = renderGanttRoute({ from: '2026-11-02', q: '9999' });

    expect(
      await screen.findByRole('heading', { level: 2, name: 'No orders match 9999' }),
    ).toBeTruthy();
    // The empty state's own Clear filter, after the field's in the bar.
    const clear = screen.getAllByRole('button', { name: 'Clear filter' }).at(-1) as HTMLElement;
    expect(clear.closest('[role="toolbar"]')).toBeNull();
    await userEvent.click(clear);

    await waitFor(() => expect('q' in router.state.location.search).toBe(false));
    const gantt = await findGantt();
    await waitFor(() => expect(orderRows(gantt)).toHaveLength(6));
  });

  it('#940 a q of 101 characters falls back to no filter with the status message', async () => {
    const router = renderGanttRoute({ from: '2026-11-02', q: 'x'.repeat(101) });
    const gantt = await findGantt();

    await waitFor(() =>
      expect(document.getElementById(politeRegionId)?.textContent).toBe(
        'This link had 1 setting that no longer applies, so it was ignored.',
      ),
    );
    await waitFor(() => expect('q' in router.state.location.search).toBe(false));
    expect(orderRows(gantt)).toHaveLength(6);
  });

  it("#940 the time area scrolls to the first match's span, only when the first match changes", async () => {
    const router = renderGanttRoute({ from: '2026-11-02' });
    const gantt = await findGantt();
    const filter = screen.getByRole('searchbox', { name: 'Filter orders' });

    await userEvent.type(filter, '1005');
    // Order 1005 starts on Mon 9 Nov 06:00 plant time.
    await waitFor(() => expect(router.state.location.search.from).toMatch(/^2026-11-0[89]T/));

    // The planner scrolls on; a filter whose first match is still 1005 leaves the view there.
    gantt.scrollLeft += 400;
    fireEvent.scroll(gantt);
    await waitFor(() => expect(router.state.location.search.from).toMatch(/^2026-11-(09T1|1)/));
    const scrolled = router.state.location.search.from;
    await userEvent.clear(filter);
    await userEvent.type(filter, '100');
    await userEvent.type(filter, '5');
    await waitFor(() => expect(router.state.location.search.q).toBe('1005'));
    expect(router.state.location.search.from).toBe(scrolled);
  });

  it('#940 a link whose filter matches nothing, then a filter that matches, scrolls to the match', async () => {
    const router = renderGanttRoute({ from: '2026-11-02T06:00', q: '9999' });
    await screen.findByRole('heading', { level: 2, name: 'No orders match 9999' });
    const filter = screen.getByRole('searchbox', { name: 'Filter orders' });

    await userEvent.clear(filter);
    await userEvent.type(filter, '1005');

    await waitFor(() => expect(router.state.location.search.from).toMatch(/^2026-11-0[89]T/));
  });

  it('#940 the result is announced: how many orders match, or none', async () => {
    renderGanttRoute({ from: '2026-11-02' });
    await findGantt();

    await userEvent.type(screen.getByRole('searchbox', { name: 'Filter orders' }), '1003');

    await waitFor(() =>
      expect(document.getElementById(politeRegionId)?.textContent).toBe('1 order matches 1003'),
    );
  });

  it('#940 a filter typed while the full row list is refused as too many still draws the matching orders', async () => {
    const source: GanttDataSource = {
      ...g1DataSource,
      loadRows: (filter, page, options) =>
        filter.search === undefined
          ? Promise.reject(new PlanningRefusal('planning.gantt.too_many_orders'))
          : g1DataSource.loadRows(filter, page, options),
    };
    renderGanttRoute({ from: '2026-11-02', q: '1003' }, source);

    const gantt = await findGantt();
    await waitFor(() => expect(orderRows(gantt)).toEqual(['po-1003']));
  });

  it('#940 under a filter, a move waits for every order: with the full row list refused, M starts no move', async () => {
    const source: GanttDataSource = {
      ...g1DataSource,
      loadRows: (filter, page, options) =>
        filter.search === undefined
          ? Promise.reject(new PlanningRefusal('planning.gantt.too_many_orders'))
          : g1DataSource.loadRows(filter, page, options),
    };
    renderGanttRoute({ zoom: 'day', from: '2026-11-04', q: '1003' }, source);
    const gantt = await findGantt();
    await waitFor(() => expect(orderRows(gantt)).toEqual(['po-1003']));
    const block = gantt.querySelector<HTMLElement>('[data-block="jo-1003-10"]') as HTMLElement;
    block.focus();

    fireEvent.keyDown(block, { key: 'm' });

    // The move rules would miss the job orders of the orders not loaded, so no move begins.
    await waitFor(() =>
      expect(document.getElementById(politeRegionId)?.textContent).toMatch(/^1 order matches 1003/),
    );
    expect(block.getAttribute('data-move-mode')).toBeNull();
  });

  it('#940 under a filter, a move starts once every order has loaded', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04', q: '1003' });
    const gantt = await findGantt();
    await waitFor(() => expect(orderRows(gantt)).toEqual(['po-1003']));
    const block = gantt.querySelector<HTMLElement>('[data-block="jo-1003-10"]') as HTMLElement;
    block.focus();

    fireEvent.keyDown(block, { key: 'm' });

    await waitFor(() => expect(block.getAttribute('data-move-mode')).toBe('true'));
    fireEvent.keyDown(block, { key: 'Escape' });
  });

  it('#940 the grid is busy while the first page of the matching orders loads', async () => {
    const hold = new Promise<void>(() => {});
    const { source } = countingRows(hold);
    renderGanttRoute({ from: '2026-11-02', q: '1003' }, source);
    const gantt = await screen.findByRole('treegrid', { name: /order Gantt/ });

    await waitFor(() => expect(gantt.getAttribute('aria-busy')).toBe('true'));
    expect(screen.queryByText(/orders loaded/)).toBeNull();
  });

  it('#940 a selection made within the pause of the filter stays', async () => {
    const router = renderGanttRoute({ from: '2026-11-02' });
    const gantt = await findGantt();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter orders' }), {
      target: { value: '100' },
    });
    // Within 250 ms of the last key, the planner selects order 1003.
    fireEvent.click(gantt.querySelector('[data-row-id="po-1003"]') as HTMLElement);
    await waitFor(() => expect(router.state.location.search.order).toBe('po-1003'));

    await waitFor(() => expect(router.state.location.search.q).toBe('100'));
    expect(router.state.location.search.order).toBe('po-1003');
  });

  it('#940 the rows of other orders go at once, before the filtered page answers', async () => {
    let release = () => {};
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { source } = countingRows(hold);
    const router = renderGanttRoute({ from: '2026-11-02' }, source);
    const gantt = await findGantt();

    await userEvent.type(screen.getByRole('searchbox', { name: 'Filter orders' }), '1003');
    await waitFor(() => expect(router.state.location.search.q).toBe('1003'));

    expect(orderRows(gantt)).toEqual(['po-1003']);
    release();
  });

  it('#940 the workload counts every order on a machine under a filter', async () => {
    window.localStorage.setItem(
      'northmes.planning.gantt.options',
      JSON.stringify({ workload: true }),
    );
    const thursdayOnCnc1 = async () => {
      await userEvent.click(await screen.findByRole('button', { name: 'Workload on CNC 1' }));
      const table = within(await screen.findByRole('dialog')).getByRole('table');
      const text = within(table)
        .getByRole('rowheader', { name: 'Thu 5 Nov' })
        .closest('tr')?.textContent;
      await userEvent.keyboard('{Escape}');
      return text;
    };
    renderGanttRoute({ from: '2026-11-02' });
    await findGantt();
    const unfiltered = await thursdayOnCnc1();
    cleanup();

    // 1004.10 runs on CNC 1 on Thursday; the filter shows only 1003.
    renderGanttRoute({ from: '2026-11-02', q: '1003' });
    const gantt = await findGantt();
    await waitFor(() => expect(orderRows(gantt)).toEqual(['po-1003']));

    expect(await thursdayOnCnc1()).toBe(unfiltered);
  });
});

describe('the order filter on the planning board (ADR 0090)', () => {
  it("#940 the machine rows stay and only the matching order's job orders show; Clear filter brings the rest back", async () => {
    const router = renderGanttRoute({ from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const machines = board.querySelectorAll('[role="rowheader"]').length;

    await userEvent.type(screen.getByRole('searchbox', { name: 'Filter orders' }), '1003');

    await waitFor(() => expect(boardBlocks(board)).toEqual(['1003.10', '1003.20']));
    expect(router.state.location.search.q).toBe('1003');
    expect(board.querySelectorAll('[role="rowheader"]')).toHaveLength(machines);

    await userEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
    await waitFor(() => expect(boardBlocks(board).length).toBeGreaterThan(2));
  });

  it('#940 a link with q opens the board filtered', async () => {
    renderGanttRoute({ from: '2026-11-02', q: '1004' }, undefined, 'board');
    const board = await findBoard();

    await waitFor(() => expect(boardBlocks(board)).toEqual(['1004.10', '1004.20']));
  });

  it('#940 with q=1003 a move of 1003.10 onto the time of 1004.10 on CNC 1 is judged against it: OVERLAP', async () => {
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02', q: '1003' }, undefined, 'board');
    const board = await findBoard();
    await waitFor(() => expect(boardBlocks(board)).toEqual(['1003.10', '1003.20']));
    (board.querySelector('[role="gridcell"][data-job-order="1003.10"]') as HTMLElement).focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');
    await user.click(await screen.findByRole('menuitem', { name: 'Move' }));
    const dialog = await screen.findByRole('dialog', { name: /^Move 1003\.10/ });
    const start = within(dialog).getByRole('textbox', { name: /^Start, plant time/ });

    // 1004.10 runs on CNC 1 from Thu 5 Nov 06:00.
    await user.clear(start);
    await user.type(start, '2026-11-05 08:00');
    // The move rules see 1004.10, which the filter does not draw: the dialog names the overlap,
    // and the draft holds it as an OVERLAP conflict.
    await waitFor(() => expect(dialog.textContent).toMatch(/Overlaps 1004\.10/));
    await user.click(within(dialog).getByRole('button', { name: 'Move' }));

    await user.click(await screen.findByRole('button', { name: /^My draft, / }));
    const drawer = await screen.findByRole('dialog', { name: /My draft/ });
    expect(drawer.textContent).toMatch(
      /1003\.10 and 1004\.10 overlap on the same machine \(OVERLAP\)/,
    );
  });

  it('#940 the board shows an empty state with Clear filter when no order matches', async () => {
    const router = renderGanttRoute({ from: '2026-11-02', q: '9999' }, undefined, 'board');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'No orders match 9999' }),
    ).toBeTruthy();
    const clear = screen.getAllByRole('button', { name: 'Clear filter' }).at(-1) as HTMLElement;
    fireEvent.click(clear);

    await waitFor(() => expect('q' in router.state.location.search).toBe(false));
  });

  it('#940 a match outside the loaded time is no "No orders match": the board scrolls to it from the row list', async () => {
    // At Day zoom the buffer holds about three days from Mon 2 Nov; 1005 starts on Mon 9 Nov.
    const router = renderGanttRoute({ zoom: 'day', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();

    await userEvent.type(screen.getByRole('searchbox', { name: 'Filter orders' }), '1005');

    await waitFor(() => expect(router.state.location.search.from).toMatch(/^2026-11-0[89]T/));
    await waitFor(() => expect(boardBlocks(board)).toContain('1005.10'));
    expect(screen.queryByRole('heading', { name: /No orders match/ })).toBeNull();
  });

  it('#940 a machine without a matching job order says so under a filter', async () => {
    renderGanttRoute({ from: '2026-11-02', q: '1003' }, undefined, 'board');
    const board = await findBoard();
    await waitFor(() => expect(boardBlocks(board)).toEqual(['1003.10', '1003.20']));

    expect(board.textContent).toContain('No job orders of the filtered orders in this range');
    expect(board.textContent).not.toContain('No jobs in this range');
  });

  it('#940 the board says when the matching orders could not be loaded, with Try again', async () => {
    const source: GanttDataSource = {
      ...g1DataSource,
      loadRows: (filter, page, options) =>
        filter.search === undefined
          ? g1DataSource.loadRows(filter, page, options)
          : Promise.reject(new Error('network')),
    };
    renderGanttRoute({ from: '2026-11-02', q: '1003' }, source, 'board');

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'The matching orders could not be loaded',
      }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('#940 with no machines to plan the board says so, also with a filter', async () => {
    renderGanttRoute({ from: '2026-11-02', q: '1003', preview: 'empty' }, undefined, 'board');

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'No machines to plan at this plant yet',
      }),
    ).toBeTruthy();
  });
});
