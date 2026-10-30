// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { type GanttDataSource, g1DataSource } from '../../../src/modules/planning/gantt-data.ts';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { phase1Reason } from '../../../src/modules/planning/mock-reasons.ts';
import { politeRegionId } from '../../../src/ui/lib/announce.ts';
import { renderGanttRoute, sourceOf } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The job order table of the page, once it has rendered. */
async function findTable(): Promise<HTMLElement> {
  return screen.findByRole('table', { name: /^Job orders, / });
}

/** The status line above the table, "8 job orders in W45, ...". */
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

describe('the job orders page (plan 18, the job order table; design #660, T1)', () => {
  it('T1 lists the job orders of the range sorted by machine, then start, with the fixture notice', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'jobOrders');
    const table = await findTable();

    expect(table.getAttribute('aria-label')).toBe('Job orders, W45, Mon 2 Nov to Sun 8 Nov');
    expect(rowNumbers(table)).toEqual([
      '1001.10',
      '1003.10',
      '1004.10',
      '1001.20',
      '1002.10',
      '1003.20',
      '1004.20',
      '1006.10',
    ]);
    expect(statusLine()).toBe(
      '8 job orders in W45, Mon 2 Nov to Sun 8 Nov, 2 late. Sorted by machine, then start.',
    );
    expect(screen.getByText('Showing fixture G1.')).toBeTruthy();
    expect(
      within(table).getByRole('columnheader', { name: 'Machine' }).getAttribute('aria-sort'),
    ).toBe('ascending');
    const late = within(table).getByRole('row', { name: /^1003\.20 / });
    expect(late.textContent).toContain('Late 15 h 15 min');
    expect(late.textContent).toContain('Gear blank 32');
    const locked = within(table).getByRole('row', { name: /^1002\.10 / });
    expect(locked.textContent).toContain('Locked');
    expect(screen.getByText('Rows 1 to 8 of 8')).toBeTruthy();
    // The job order number opens the Gantt with the order selected and its start in view.
    expect(within(late).getByRole('link', { name: '1003.20' }).getAttribute('href')).toBe(
      '/plant-a/planning/gantt?zoom=week&from=2026-11-04&order=po-1003',
    );
  });

  it('T1 Late only keeps the rows of late orders and writes late=1 to the URL', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'jobOrders');
    const table = await findTable();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Late only' }));

    await waitFor(() => expect(rowNumbers(table)).toEqual(['1003.10', '1003.20']));
    expect(router.state.location.search).toEqual({ zoom: 'week', from: '2026-11-02', late: 1 });
    const line =
      '2 job orders in W45, Mon 2 Nov to Sun 8 Nov, 2 late, late only. Sorted by machine, then start.';
    expect(statusLine()).toBe(line);
    // The change is announced once through the app's polite region, not by a live status line.
    await waitFor(() => expect(document.getElementById(politeRegionId)?.textContent).toBe(line));
  });

  it('T1 a sortable header sorts the rows, sets aria-sort and goes to the URL', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'jobOrders');
    const table = await findTable();

    await userEvent.click(within(table).getByRole('button', { name: 'Deadline' }));

    await waitFor(() =>
      expect(
        within(table).getByRole('columnheader', { name: 'Deadline' }).getAttribute('aria-sort'),
      ).toBe('ascending'),
    );
    expect(rowNumbers(table).slice(0, 3)).toEqual(['1003.10', '1003.20', '1002.10']);
    expect(router.state.location.search).toEqual({
      zoom: 'week',
      from: '2026-11-02',
      sort: 'deadline',
    });
    expect(statusLine()).toContain('Sorted by deadline, ascending.');

    await userEvent.click(within(table).getByRole('button', { name: 'Deadline' }));

    await waitFor(() => expect(rowNumbers(table)[0]).toBe('1006.10'));
    expect(router.state.location.search).toEqual({
      zoom: 'week',
      from: '2026-11-02',
      sort: '-deadline',
    });
  });

  it('T1 the late facts of a late row open under it with the deadline rule, the delay and the binding row', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'jobOrders');
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

  it('T1 the Columns menu hides a column and keeps Job order', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'jobOrders');
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

  it('T1 the Columns icon sits in the last header cell, every row has an empty cell under it that assistive technology skips, and the late facts span it (#875)', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'jobOrders');
    const table = await findTable();
    const headers = within(table).getAllByRole('columnheader');
    const last = headers[headers.length - 1] as HTMLElement;
    expect(within(last).getByRole('button', { name: 'Columns' })).toBeTruthy();
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

  it('T1 Move is drawn but disabled with its reason, and the row menu leads to the Gantt and the board', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'jobOrders');
    const table = await findTable();
    const row = within(table).getByRole('row', { name: /^1001\.10 / });

    const move = within(row).getByRole('button', { name: 'Move' });
    expect(move.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(phase1Reason)).toBeTruthy();

    await userEvent.click(within(row).getByRole('button', { name: 'Actions for 1001.10' }));

    expect(screen.getByRole('menuitem', { name: 'Open on Gantt' }).getAttribute('href')).toBe(
      '/plant-a/planning/gantt?zoom=week&from=2026-11-03&order=po-1001',
    );
    expect(screen.getByRole('menuitem', { name: 'Show on board' }).getAttribute('href')).toBe(
      '/plant-a/planning/board?zoom=week&from=2026-11-03&order=po-1001',
    );
  });

  it('T1 a later range keeps the rows of a late order, as the Gantt does, and Now returns to the snapshot week', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-12-07' }, undefined, 'jobOrders');
    const table = await findTable();

    expect(table.getAttribute('aria-label')).toBe('Job orders, W50, Mon 7 Dec to Sun 13 Dec');
    expect(rowNumbers(table)).toEqual(['1003.10', '1003.20']);
    expect(statusLine()).toBe(
      '2 job orders in W50, Mon 7 Dec to Sun 13 Dec, 2 late. Sorted by machine, then start.',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Now' }));

    await waitFor(() =>
      expect(router.state.location.search).toEqual({ zoom: 'week', from: '2026-11-02' }),
    );
    expect(
      screen.getByRole('table', { name: 'Job orders, W45, Mon 2 Nov to Sun 8 Nov' }),
    ).toBeTruthy();
  });

  it('LI7 while another range loads the rows and the status line stay those of the range before, busy, and a failed load shows the error state', async () => {
    const snapshot = g1Snapshot();
    let hold: 'none' | 'wait' | 'fail' = 'none';
    let release: (() => void) | undefined;
    const source: GanttDataSource = {
      ...g1DataSource,
      load: () => {
        if (hold === 'fail') return Promise.reject(new Error('The plan server is down'));
        if (hold === 'none') return Promise.resolve(snapshot);
        return new Promise((resolve) => {
          release = () => resolve(snapshot);
        });
      },
    };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, source, 'jobOrders');
    const table = await findTable();
    await waitFor(() => expect(statusLine()).toContain('8 job orders in W45'));

    hold = 'wait';
    await userEvent.click(screen.getByRole('button', { name: 'Show later range' }));

    await waitFor(() =>
      expect(statusLine()).toBe(
        'Loading W46, Mon 9 Nov to Sun 15 Nov. Showing 8 job orders in W45, Mon 2 Nov to Sun 8 Nov, 2 late until it loads.',
      ),
    );
    expect(table.getAttribute('aria-busy')).toBe('true');
    expect(rowNumbers(table)).toHaveLength(8);

    release?.();

    await waitFor(() =>
      expect(statusLine()).toBe(
        '5 job orders in W46, Mon 9 Nov to Sun 15 Nov, 2 late. Sorted by machine, then start.',
      ),
    );
    expect(table.getAttribute('aria-busy')).toBeNull();

    hold = 'fail';
    await userEvent.click(screen.getByRole('button', { name: 'Show later range' }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Could not load the job orders' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
    expect(statusLine()).toBe('Could not load W47, Mon 16 Nov to Sun 22 Nov.');
  });

  it('T1 a plant without job orders in the range shows the empty state with Show the next range', async () => {
    const empty = { ...g1Snapshot(), productionOrders: [] };
    const router = renderGanttRoute(
      { zoom: 'week', from: '2026-11-02' },
      sourceOf({ ...empty, analysis: { jobOrders: {}, orders: {}, workload: [] } }),
      'jobOrders',
    );

    expect(
      await screen.findByRole('heading', { level: 2, name: 'No job orders in this range' }),
    ).toBeTruthy();
    expect(statusLine()).toBe(
      '0 job orders in W45, Mon 2 Nov to Sun 8 Nov. Sorted by machine, then start.',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Show the next range' }));

    await waitFor(() =>
      expect(router.state.location.search).toEqual({ zoom: 'week', from: '2026-11-09' }),
    );
  });
});
