// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  GanttDataSource,
  GanttJobOrder,
  GanttSnapshot,
} from '../../../src/modules/planning/gantt-data.ts';
import { g1DataSource } from '../../../src/modules/planning/gantt-data.ts';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { phase1Reason } from '../../../src/modules/planning/mock-reasons.ts';
import { politeRegionId } from '../../../src/ui/lib/announce.ts';
import { renderGanttRoute, sourceOf } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The job order table of the page, once it has rendered. */
async function findTable(): Promise<HTMLElement> {
  return screen.findByRole('table', { name: 'Job orders' });
}

/** The status line above the table, "10 job orders, 2 late. Sorted by start.". */
function statusLine(): string {
  return document.querySelector('[data-job-orders-status]')?.textContent ?? '';
}

/** The display numbers of the body rows, in their order. */
function rowNumbers(table: HTMLElement): string[] {
  return within(table)
    .getAllByRole('row')
    .filter((row) => row.getAttribute('data-job-order') !== null)
    .map((row) => row.getAttribute('data-job-order') ?? '');
}

/** A filter menu's button, apart from a sort header of the same name. */
function filterButton(label: string): HTMLElement {
  const button = screen
    .getAllByRole('button', { name: label })
    .find((each) => each.getAttribute('aria-haspopup') === 'menu');
  if (button === undefined) throw new Error(`No ${label} filter menu`);
  return button;
}

/** G1 with some job orders changed, each by its display number. */
function g1With(changes: Record<string, (row: GanttJobOrder) => GanttJobOrder>): GanttSnapshot {
  const snapshot = g1Snapshot();
  return {
    ...snapshot,
    productionOrders: snapshot.productionOrders.map((order) => ({
      ...order,
      jobOrders: order.jobOrders.map((row) => changes[row.displayNumber]?.(row) ?? row),
    })),
  };
}

/** G1 with 1006.10 finished, 1004.10 started and 1005.20 not placed. */
function g1WithStatuses(): GanttSnapshot {
  return g1With({
    '1006.10': (row) => ({ ...row, status: 'finished' }),
    '1004.10': (row) => ({ ...row, status: 'started' }),
    '1005.20': ({ equipment: _, placement: __, ...row }) => row,
  });
}

/** The ten job orders of G1 by setup start. */
const byStart = [
  '1001.10',
  '1003.10',
  '1001.20',
  '1003.20',
  '1004.10',
  '1004.20',
  '1002.10',
  '1006.10',
  '1005.10',
  '1005.20',
];

describe('the job orders page (ADR 0091, a work list without a time range)', () => {
  it('lists every open job order sorted by start, with the fixture notice and no range controls', async () => {
    // A link from before ADR 0091 still carries zoom and from, which the page ignores.
    renderGanttRoute({ zoom: 'week', from: '2026-12-07' }, undefined, 'jobOrders');
    const table = await findTable();

    expect(rowNumbers(table)).toEqual(byStart);
    expect(statusLine()).toBe('10 job orders, 2 late. Sorted by start.');
    expect(screen.getByText('Showing fixture G1.')).toBeTruthy();
    expect(
      within(table).getByRole('columnheader', { name: 'Start' }).getAttribute('aria-sort'),
    ).toBe('ascending');
    const late = within(table).getByRole('row', { name: /^1003\.20 / });
    expect(late.textContent).toContain('Late 15 h 15 min');
    expect(late.textContent).toContain('Gear blank 32');
    expect(within(table).getByRole('row', { name: /^1002\.10 / }).textContent).toContain(
      'Locked',
    );
    expect(screen.getByText('Rows 1 to 10 of 10')).toBeTruthy();
    // The job order number opens the Gantt with the order selected and its start in view.
    expect(within(late).getByRole('link', { name: '1003.20' }).getAttribute('href')).toBe(
      '/plant-a/planning/gantt?from=2026-11-04&order=po-1003',
    );
    for (const name of ['Now', 'Show earlier range', 'Show later range', 'Hours', '4 weeks']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(screen.queryByLabelText('Go to date')).toBeNull();
  });

  it('shows a finished job order only under Status Finished, and a job order without a machine as Not placed, last', async () => {
    const router = renderGanttRoute({}, sourceOf(g1WithStatuses()), 'jobOrders');
    const table = await findTable();

    await waitFor(() =>
      expect(rowNumbers(table)).toEqual(byStart.filter((number) => number !== '1006.10')),
    );
    const notPlaced = within(table).getByRole('row', { name: /^1005\.20 / });
    expect(notPlaced.textContent).toContain('Not placed');
    expect(within(table).getByRole('row', { name: /^1004\.10 / }).textContent).toContain(
      'Started',
    );
    expect(statusLine()).toBe('9 job orders, 2 late, 1 not placed. Sorted by start.');

    await userEvent.click(filterButton('Status'));
    expect(screen.getByRole('menuitemcheckbox', { name: /^Finished/ }).textContent).toContain(
      '1',
    );
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /^Finished/ }));
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(rowNumbers(table)).toEqual(['1006.10']));
    expect(router.state.location.search).toEqual({ status: 'finished' });
  });

  it('narrows the rows by the search, Late only and the Machine filter, and writes them to the URL', async () => {
    const router = renderGanttRoute({}, sourceOf(g1WithStatuses()), 'jobOrders');
    const table = await findTable();
    await waitFor(() => expect(rowNumbers(table)).toHaveLength(9));

    await userEvent.click(screen.getByRole('checkbox', { name: 'Late only' }));

    await waitFor(() => expect(rowNumbers(table)).toEqual(['1003.10', '1003.20']));
    expect(router.state.location.search).toEqual({ late: 1 });
    const line = '2 job orders, 2 late, late only. Sorted by start.';
    expect(statusLine()).toBe(line);
    // The change is announced once through the app's polite region, not by a live status line.
    await waitFor(() => expect(document.getElementById(politeRegionId)?.textContent).toBe(line));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Late only' }));

    await userEvent.click(filterButton('Machine'));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /^Not placed/ }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /^Mill 1/ }));
    await userEvent.keyboard('{Escape}');

    await waitFor(() =>
      expect(rowNumbers(table)).toEqual(['1003.20', '1004.20', '1005.20']),
    );
    expect(router.state.location.search).toEqual({ machine: 'none,MILL1' });
    expect(screen.getByRole('button', { name: 'Machine, 2 selected' })).toBeTruthy();

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search job orders' }), 'Gear');

    await waitFor(() => expect(rowNumbers(table)).toEqual(['1003.20']));
    expect(router.state.location.search).toEqual({ machine: 'none,MILL1', q: 'Gear' });

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(rowNumbers(table)).toEqual(['1003.10', '1003.20']));
    expect(router.state.location.search).toEqual({ q: 'Gear' });
  });

  it('finds a job order by its own number and by its order number', async () => {
    const router = renderGanttRoute({ q: '1001.2' }, undefined, 'jobOrders');
    const table = await findTable();
    await waitFor(() => expect(rowNumbers(table)).toEqual(['1001.20']));

    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search job orders' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search job orders' }), '1004');

    await waitFor(() => expect(rowNumbers(table)).toEqual(['1004.10', '1004.20']));
    expect(router.state.location.search).toEqual({ q: '1004' });
  });

  it('groups the rows by machine in the plant order with Not placed last, and by start day', async () => {
    const router = renderGanttRoute({}, sourceOf(g1WithStatuses()), 'jobOrders');
    const table = await findTable();

    await userEvent.click(screen.getByRole('button', { name: 'Group by' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Machine' }));

    const groups = await within(table).findAllByRole('rowheader');
    expect(groups.map((group) => group.textContent)).toEqual([
      'CNC 1 4 job orders',
      'CNC 2 2 job orders',
      'Mill 1 2 job orders',
      'Not placed 1 job order',
    ]);
    expect(router.state.location.search).toEqual({ group: 'machine' });
    expect(statusLine()).toBe(
      '9 job orders, 2 late, 1 not placed. 4 groups by machine, job orders sorted by start.',
    );
    expect(rowNumbers(table)).toEqual([
      '1001.10',
      '1003.10',
      '1004.10',
      '1005.10',
      '1001.20',
      '1002.10',
      '1003.20',
      '1004.20',
      '1005.20',
    ]);

    const cnc1 = within(table).getByRole('button', { name: /^CNC 1/ });
    await userEvent.click(cnc1);
    expect(cnc1.getAttribute('aria-expanded')).toBe('false');
    await waitFor(() => expect(rowNumbers(table)).not.toContain('1001.10'));

    await userEvent.click(screen.getByRole('button', { name: 'Group by: Machine' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Start day' }));

    await waitFor(() =>
      expect(within(table).getAllByRole('rowheader').map((group) => group.textContent)).toEqual([
        'Tue 3 Nov 1 job order',
        'Wed 4 Nov 3 job orders',
        'Thu 5 Nov 3 job orders',
        'Mon 9 Nov 1 job order',
        'Not placed 1 job order',
      ]),
    );
    expect(router.state.location.search).toEqual({ group: 'startDay' });
  });

  it('sorts on a header, sets aria-sort and writes the sort to the URL', async () => {
    const router = renderGanttRoute({}, undefined, 'jobOrders');
    const table = await findTable();

    await userEvent.click(within(table).getByRole('button', { name: 'Deadline' }));

    await waitFor(() =>
      expect(
        within(table).getByRole('columnheader', { name: 'Deadline' }).getAttribute('aria-sort'),
      ).toBe('ascending'),
    );
    expect(rowNumbers(table).slice(0, 2)).toEqual(['1003.10', '1003.20']);
    expect(router.state.location.search).toEqual({ sort: 'deadline' });
    expect(statusLine()).toContain('Sorted by deadline, ascending.');

    await userEvent.click(within(table).getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(rowNumbers(table)).toEqual(byStart));
    expect(router.state.location.search).toEqual({});
  });

  it('opens the late facts of a late row under it with the deadline rule, the delay and the binding row', async () => {
    renderGanttRoute({}, undefined, 'jobOrders');
    const table = await findTable();
    const row = within(table).getByRole('row', { name: /^1003\.20 / });

    const toggle = within(row).getByRole('button', { name: 'Late facts for 1003.20' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const facts = screen.getByRole('region', { name: 'Late facts for 1003.20' });
    expect(facts.textContent).toContain('Order 1003 is late by 15 h 15 min');
    expect(facts.textContent).toContain('End of shift, 15:00 on the deadline date');
    expect(facts.textContent).toContain('Wed 4 Nov 15:00');
    expect(facts.textContent).toContain('Thu 5 Nov 06:15');
    expect(facts.textContent).toContain('15 h 15 min elapsed, 15 min of working time on Mill 1');
    expect(facts.textContent).toContain('1003.10 waits 6 h 50 min for 1001.10 on CNC 1');
    expect(within(table).queryByRole('button', { name: 'Late facts for 1001.10' })).toBeNull();
  });

  it('hides a column through the Columns menu and keeps Job order', async () => {
    renderGanttRoute({}, undefined, 'jobOrders');
    const table = await findTable();
    expect(within(table).getByRole('columnheader', { name: 'Soft lock' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Columns' }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Soft lock' }));

    await waitFor(() =>
      expect(within(table).queryByRole('columnheader', { name: 'Soft lock' })).toBeNull(),
    );
    expect(
      screen.getByRole('menuitemcheckbox', { name: /Job order/ }).getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('#875 the Group by and Columns icons sit in the last header cell, every row has an empty cell under them that assistive technology skips, and the late facts span it', async () => {
    renderGanttRoute({}, undefined, 'jobOrders');
    const table = await findTable();
    const headers = within(table).getAllByRole('columnheader');
    const last = headers[headers.length - 1] as HTMLElement;
    expect(within(last).getByRole('button', { name: 'Columns' })).toBeTruthy();
    expect(within(last).getByRole('button', { name: 'Group by' })).toBeTruthy();
    const rows = table.querySelectorAll('tr[data-job-order]');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const cells = row.querySelectorAll(':scope > td');
      expect(cells).toHaveLength(headers.length);
      expect(cells[cells.length - 1]?.getAttribute('aria-hidden')).toBe('true');
    }

    const row = within(table).getByRole('row', { name: /^1003\.20 / });
    await userEvent.click(within(row).getByRole('button', { name: 'Late facts for 1003.20' }));
    const facts = screen.getByRole('region', { name: 'Late facts for 1003.20' });
    expect(facts.closest('td')?.getAttribute('colspan')).toBe(String(headers.length));
  });

  it('draws Move disabled with its reason, and leads from a row to the Gantt and the board at its start, and from the page with its search', async () => {
    renderGanttRoute({ q: '1001' }, undefined, 'jobOrders');
    const table = await findTable();
    const row = within(table).getByRole('row', { name: /^1001\.10 / });

    const move = within(row).getByRole('button', { name: 'Move' });
    expect(move.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(phase1Reason)).toBeTruthy();

    await userEvent.click(within(row).getByRole('button', { name: 'Actions for 1001.10' }));

    expect(screen.getByRole('menuitem', { name: 'Open on Gantt' }).getAttribute('href')).toBe(
      '/plant-a/planning/gantt?from=2026-11-03&order=po-1001',
    );
    expect(screen.getByRole('menuitem', { name: 'Show on board' }).getAttribute('href')).toBe(
      '/plant-a/planning/board?from=2026-11-03&order=po-1001',
    );
    await userEvent.keyboard('{Escape}');

    await userEvent.click(screen.getByRole('button', { name: 'Table options' }));

    expect(screen.getByRole('menuitem', { name: 'Open the Gantt' }).getAttribute('href')).toBe(
      '/plant-a/planning/gantt?q=1001',
    );
    expect(
      screen.getByRole('menuitem', { name: 'Open the planning board' }).getAttribute('href'),
    ).toBe('/plant-a/planning/board?q=1001');
  });

  it('shows the error state when the job orders cannot be loaded, and Try again loads them', async () => {
    let fail = true;
    const source: GanttDataSource = {
      ...g1DataSource,
      load: (input) =>
        fail ? Promise.reject(new Error('The plan server is down')) : g1DataSource.load(input),
    };
    renderGanttRoute({}, source, 'jobOrders');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Could not load the job orders' }),
    ).toBeTruthy();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(rowNumbers(await findTable())).toEqual(byStart);
  });

  it('names the empty states: no job orders yet, none open, and none that match', async () => {
    const empty = { ...g1Snapshot(), productionOrders: [] };
    renderGanttRoute(
      {},
      sourceOf({ ...empty, analysis: { jobOrders: {}, orders: {}, workload: [] } }),
      'jobOrders',
    );
    expect(
      await screen.findByRole('heading', { level: 2, name: 'No job orders yet' }),
    ).toBeTruthy();
    expect(statusLine()).toBe('0 job orders. Sorted by start.');
    cleanup();

    const finished = Object.fromEntries(
      byStart.map((number) => [number, (row: GanttJobOrder) => ({ ...row, status: 'finished' as const })]),
    );
    renderGanttRoute({}, sourceOf(g1With(finished)), 'jobOrders');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'No open job orders' }),
    ).toBeTruthy();
    expect(screen.getByText('Pick Finished under Status to see the finished job orders.')).toBeTruthy();
    cleanup();

    const router = renderGanttRoute({ q: 'nothing', late: 1 }, undefined, 'jobOrders');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'No job orders match these filters' }),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(rowNumbers(await findTable())).toEqual(byStart);
  });
});
