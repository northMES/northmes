// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { GanttDataSource } from '../../../src/modules/planning/gantt-data.ts';
import { g1DataSource } from '../../../src/modules/planning/gantt-data.ts';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { renderGanttRoute, sourceOf } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The board grid, once it has loaded: while it loads, the grid's skeleton is busy. */
async function findBoard(): Promise<HTMLElement> {
  return waitFor(() => {
    const board = screen.getByRole('grid', { name: /board/ });
    if (board.getAttribute('aria-busy') === 'true') throw new Error('The board is loading');
    return board;
  });
}

/** The machine row whose row header names the machine. */
function machineRow(board: HTMLElement, machine: string): HTMLElement {
  const header = within(board).getByRole('rowheader', { name: machine });
  const row = header.closest<HTMLElement>('[role="row"]');
  if (row === null) throw new Error(`No row holds the row header ${machine}`);
  return row;
}

/**
 * A name matcher for a cell whose name joins nested spans, such as the article and its hidden
 * comma: happy-dom has no layout, so it reads every span as a block and puts a space around it,
 * where a browser joins inline spans without one.
 */
function named(text: string): (name: string) => boolean {
  return (name) => name.replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim() === text;
}

/** The job numbers of a row's job order cells, in DOM order. */
function jobNumbers(row: HTMLElement): string[] {
  return within(row)
    .getAllByRole('gridcell')
    .map((cell) => cell.getAttribute('data-job-order') ?? '');
}

/** G1 with one job order moved to a machine and a span, and with other changes to it. */
function withJobOrder(
  snapshot: ReturnType<typeof g1Snapshot>,
  job: string,
  change: {
    readonly equipment?: string;
    readonly fromMs?: number;
    readonly toMs?: number;
    readonly held?: boolean;
  },
): ReturnType<typeof g1Snapshot> {
  return {
    ...snapshot,
    productionOrders: snapshot.productionOrders.map((order) => ({
      ...order,
      jobOrders: order.jobOrders.map((row) => {
        if (row.displayNumber !== job || row.placement === undefined) return row;
        const setupStartMs = change.fromMs ?? row.placement.setupStartMs;
        const endMs = change.toMs ?? row.placement.endMs;
        return {
          ...row,
          ...(change.equipment !== undefined && { equipment: change.equipment }),
          ...(change.held !== undefined && { held: change.held }),
          placement: {
            setupStartMs,
            runStartMs: setupStartMs,
            endMs,
            segments: [{ fromMs: setupStartMs, toMs: endMs }],
          },
        };
      }),
    })),
  };
}

/** The IN27 board: 1002.10 on CNC 1 right after 1003.10, so at 4 weeks the two share a cluster. */
function clusterSnapshot(change: { readonly held?: boolean } = {}) {
  return withJobOrder(g1Snapshot(), '1002.10', {
    equipment: 'CNC1',
    fromMs: Date.UTC(2026, 10, 4, 11, 45),
    toMs: Date.UTC(2026, 10, 4, 15, 15),
    ...change,
  });
}

describe('the planning board (plan 07, Planning board in release 1; design D3)', () => {
  it('BO1 shows the machines of G1 grouped by equipment group, each with its job orders in time order', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();

    expect(board.getAttribute('aria-label')).toBe('plant-a board, W45, Mon 2 Nov to Sun 8 Nov');
    expect(
      within(board)
        .getByRole('button', { name: 'Collapse Machining' })
        .getAttribute('aria-expanded'),
    ).toBe('true');
    expect(
      within(board)
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual(expect.arrayContaining(['CNC 1', 'CNC 2', 'Mill 1']));
    expect(jobNumbers(machineRow(board, 'CNC 1'))).toEqual(['1001.10', '1003.10', '1004.10']);
    expect(jobNumbers(machineRow(board, 'CNC 2'))).toEqual(['1001.20', '1002.10']);
    expect(jobNumbers(machineRow(board, 'Mill 1'))).toEqual(['1003.20', '1004.20', '1006.10']);
    expect(
      within(machineRow(board, 'CNC 1')).getByRole('gridcell', {
        name: named('1001.10 Bracket L, 600 pcs, CNC 1, Tue 3 Nov 11:30 to Wed 4 Nov 08:00'),
      }),
    ).toBeTruthy();
  });

  it('TA10 keeps one Tab stop in the grid, which enters at the job order nearest now, and the arrow keys move along and between rows', async () => {
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const cell = (job: string) =>
      board.querySelector<HTMLElement>(`[data-job-order="${job}"][role="gridcell"]`);

    // The grid has one Tab stop: the first job order of CNC 1, the one nearest now (Mon 09:40).
    expect(board.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    expect(cell('1001.10')?.getAttribute('tabindex')).toBe('0');
    cell('1001.10')?.focus();

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(cell('1003.10'));
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(cell('1004.10'));
    // Down goes to the job order of CNC 2 that runs at 1004.10's start, Thu 5 Nov 06:00.
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(cell('1001.20'));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(cell('1003.20'));
    // Home on Mill 1 reaches 1003.20 at Wed 12:45; Up meets 1001.20, which runs then, and Up
    // again 1003.10, which runs at 1001.20's start, Wed 09:00.
    await user.keyboard('{Home}{ArrowUp}{ArrowUp}');
    expect(document.activeElement).toBe(cell('1003.10'));
    // Up from the first machine row reaches the Not placed row, which says none is missing.
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement?.textContent).toBe('No job orders without a place');
    // The roving tabindex follows focus.
    expect(document.activeElement?.getAttribute('tabindex')).toBe('0');
    expect(cell('1003.10')?.getAttribute('tabindex')).toBe('-1');
  });

  it('TA11 reaches the row headers and the group button from the first job order, and the group button collapses its machines', async () => {
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    board.querySelector<HTMLElement>('[data-job-order="1001.20"][role="gridcell"]')?.focus();

    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(within(board).getByRole('rowheader', { name: 'CNC 2' }));
    await user.keyboard('{ArrowUp}{ArrowUp}');
    const toggle = within(board).getByRole('button', { name: 'Collapse Machining' });
    expect(document.activeElement).toBe(toggle);

    await user.keyboard('{Enter}');
    expect(within(board).queryByRole('rowheader', { name: 'CNC 1' })).toBeNull();
    expect(
      within(board).getByRole('button', { name: 'Expand Machining' }).getAttribute('aria-expanded'),
    ).toBe('false');
    expect(document.activeElement).toBe(
      within(board).getByRole('button', { name: 'Expand Machining' }),
    );
    await user.keyboard(' ');
    expect(within(board).getByRole('rowheader', { name: 'CNC 1' })).toBeTruthy();
    await user.keyboard('{ArrowDown}{ArrowRight}');
    expect(document.activeElement?.getAttribute('data-job-order')).toBe('1001.10');
  });

  it("BO1 shades each machine's closed time from its own calendar, so a machine deviation shades only its row", async () => {
    const g1 = g1Snapshot();
    // Mill 1 does not work on Mon 2 Nov; the other machines keep the plant calendar.
    const snapshot = {
      ...g1,
      calendar: {
        ...g1.calendar,
        deviations: [
          {
            kind: 'nonWorking' as const,
            startsLocal: '2026-11-02T06:00',
            endsLocal: '2026-11-02T15:00',
            equipment: ['MILL1'],
          },
        ],
      },
    };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, sourceOf(snapshot), 'board');
    const board = await findBoard();
    const firstClosed = (machine: string) => {
      const shading = machineRow(board, machine).querySelector('[data-shading]');
      return [shading?.getAttribute('data-from-ms'), shading?.getAttribute('data-to-ms')].map(
        (value) => new Date(Number(value)).toISOString(),
      );
    };

    expect(firstClosed('CNC 1')).toEqual(['2026-11-01T23:00:00.000Z', '2026-11-02T05:00:00.000Z']);
    expect(firstClosed('Mill 1')).toEqual(['2026-11-01T23:00:00.000Z', '2026-11-03T05:00:00.000Z']);
  });

  it('DR18 gives each machine without job orders in the range one cell that says so', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-16' }, undefined, 'board');
    const board = await findBoard();

    for (const machine of ['CNC 1', 'CNC 2', 'Mill 1']) {
      expect(
        within(machineRow(board, machine)).getByRole('gridcell', { name: 'No jobs in this range' }),
      ).toBeTruthy();
    }
  });

  it('BO1 lists the job orders without a place as chips in the pinned Not placed row', async () => {
    const g1 = g1Snapshot();
    const snapshot = {
      ...g1,
      productionOrders: g1.productionOrders.map((order) =>
        order.number !== '1005'
          ? order
          : {
              ...order,
              jobOrders: order.jobOrders.map((row) => {
                if (row.displayNumber !== '1005.20') return row;
                const { placement: _, equipment: __, ...unplaced } = row;
                return unplaced;
              }),
            },
      ),
    };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, sourceOf(snapshot), 'board');
    const board = await findBoard();
    const notPlaced = within(board).getByRole('rowheader', {
      name: named('Not placed, 1 job order'),
    });
    const row = notPlaced.closest<HTMLElement>('[role="row"]') as HTMLElement;

    expect(row.getAttribute('aria-rowindex')).toBe('2');
    expect(
      within(row).getByRole('gridcell', { name: named('1005.20 Bracket L, 600 pcs, not placed') }),
    ).toBeTruthy();
  });

  it('BO1 opens at the week of now with the defaults out of the URL, and Later replaces from', async () => {
    const user = userEvent.setup();
    const router = renderGanttRoute({}, undefined, 'board');
    const board = await findBoard();

    expect(board.getAttribute('aria-label')).toBe('plant-a board, W45, Mon 2 Nov to Sun 8 Nov');
    expect(screen.getByRole('heading', { level: 1, name: 'Planning board' })).toBeTruthy();
    expect(screen.getByText('Showing fixture G1.')).toBeTruthy();
    expect(screen.getByText('ERP data as of Mon 2 Nov 06:40')).toBeTruthy();
    expect(router.state.location.search).toEqual({});

    await user.click(screen.getByRole('button', { name: 'Show later range' }));
    expect(
      await screen.findByRole('grid', { name: 'plant-a board, W46, Mon 9 Nov to Sun 15 Nov' }),
    ).toBeTruthy();
    expect(router.state.location.search).toEqual({ from: '2026-11-09' });
  });

  it('BO12 draws the states of G1 in shape and in the name: a locked job order and the late ones', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const block = (job: string) =>
      board.querySelector<HTMLElement>(`[role="gridcell"][data-job-order="${job}"]`) as HTMLElement;

    expect(block('1002.10').getAttribute('data-states')).toBe('locked');
    expect(
      within(board).getByRole('gridcell', {
        name: named(
          '1002.10 Housing P, 420 pcs, CNC 2, Thu 5 Nov 11:30 to Thu 5 Nov 15:00, locked',
        ),
      }),
    ).toBe(block('1002.10'));
    expect(block('1003.20').getAttribute('data-states')).toBe('late');
    expect(
      within(board).getByRole('gridcell', {
        name: named(
          '1003.20 Gear blank 32, 600 pcs, Mill 1, Wed 4 Nov 12:45 to Thu 5 Nov 06:15, late by 15 h 15 min',
        ),
      }),
    ).toBe(block('1003.20'));
    expect(block('1001.10').getAttribute('data-states')).toBeNull();
  });

  it('BO12 marks a held, a started and an overdue job order by icon, border and words', async () => {
    const g1 = g1Snapshot();
    const snapshot = {
      ...g1,
      // Tue 3 Nov 12:00 in plant time: 1001.10 should have started at 11:30.
      nowMs: Date.UTC(2026, 10, 3, 11),
      productionOrders: g1.productionOrders.map((order) => ({
        ...order,
        jobOrders: order.jobOrders.map((row) =>
          row.displayNumber === '1001.20'
            ? { ...row, held: true }
            : row.displayNumber === '1004.10'
              ? { ...row, status: 'started' as const }
              : row,
        ),
      })),
    };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, sourceOf(snapshot), 'board');
    const board = await findBoard();
    const block = (job: string) =>
      board.querySelector<HTMLElement>(`[role="gridcell"][data-job-order="${job}"]`) as HTMLElement;

    expect(block('1001.20').getAttribute('data-states')).toBe('held');
    expect(block('1001.20').querySelector('[data-marker="held"]')).not.toBeNull();
    expect(block('1001.20').querySelector('[data-state-icon="held"]')).not.toBeNull();
    expect(
      within(board).getByRole('gridcell', {
        name: named(
          '1001.20 Bracket L, 600 pcs, CNC 2, Wed 4 Nov 09:00 to Thu 5 Nov 10:45, being edited by another planner',
        ),
      }),
    ).toBe(block('1001.20'));
    expect(block('1004.10').getAttribute('data-states')).toBe('started');
    expect(block('1004.10').querySelector('[data-state-icon="started"]')).not.toBeNull();
    expect(
      within(board).getByRole('gridcell', {
        name: named(
          '1001.10 Bracket L, 600 pcs, CNC 1, Tue 3 Nov 11:30 to Wed 4 Nov 08:00, overdue, planned 11:30, not started',
        ),
      }),
    ).toBe(block('1001.10'));
  });

  it('BO1 selects the order of a clicked job order: the URL names it and every job order of it is selected', async () => {
    const user = userEvent.setup();
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const block = (job: string) =>
      board.querySelector<HTMLElement>(`[role="gridcell"][data-job-order="${job}"]`) as HTMLElement;

    await user.click(block('1001.10'));
    expect(router.state.location.search).toEqual({
      zoom: 'week',
      from: '2026-11-02',
      order: 'po-1001',
    });
    expect(block('1001.10').getAttribute('aria-selected')).toBe('true');
    expect(block('1001.20').getAttribute('aria-selected')).toBe('true');
    expect(block('1001.20').querySelector('[data-selection-bar]')).not.toBeNull();
    expect(block('1003.10').getAttribute('aria-selected')).toBe('false');
    expect(block('1003.10').querySelector('[data-selection-bar]')).toBeNull();

    // Escape clears the selection and keeps focus on the job order.
    await user.keyboard('{Escape}');
    expect(router.state.location.search).toEqual({ zoom: 'week', from: '2026-11-02' });
    expect(block('1001.10').getAttribute('aria-selected')).toBe('false');
    expect(document.activeElement).toBe(block('1001.10'));
  });

  it('TA8 enters the grid at the selected job order when the URL names an order', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02', order: 'po-1003' }, undefined, 'board');
    const board = await findBoard();

    expect(board.querySelector('[tabindex="0"]')?.getAttribute('data-job-order')).toBe('1003.10');
  });

  it('IN1 opens the hover card on hover and on focus with the job order, its states and its fields', async () => {
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const block = (job: string) =>
      board.querySelector<HTMLElement>(`[role="gridcell"][data-job-order="${job}"]`) as HTMLElement;

    await user.hover(block('1003.20'));
    const card = await screen.findByRole('tooltip');
    expect(within(card).getByText('1003.20 Gear blank 32')).toBeTruthy();
    expect(within(card).getByText('Late by 15 h 15 min')).toBeTruthy();
    const field = (label: string) =>
      Array.from(card.querySelectorAll('dt')).find((term) => term.textContent === label)
        ?.nextElementSibling?.textContent;
    expect(field('Operation')).toBe('20, Mill');
    expect(field('Quantity')).toBe('600 pcs');
    expect(field('Setup start')).toBe('Wed 4 Nov 12:45');
    expect(field('End')).toBe('Thu 5 Nov 06:15');
    expect(field('Planned')).toBe('Setup 0 min, run 2 h 30 min');
    expect(field('Machine')).toBe('Mill 1');
    expect(field('Order deadline')).toBe('Wed 4 Nov 15:00');
    expect(field('Status')).toBe('Planned');
    await user.unhover(block('1003.20'));

    block('1002.10').focus();
    const focused = await screen.findByRole('tooltip');
    expect(within(focused).getByText('1002.10 Housing P')).toBeTruthy();
    expect(within(focused).getByText('Locked')).toBeTruthy();
  });

  it('IN27 merges job orders under 24 px wide into one cluster cell with its counts, and Enter opens its popover', async () => {
    const user = userEvent.setup();
    const g1 = g1Snapshot();
    // 1002.10 moves onto CNC 1 right after 1003.10, so at 4 weeks the two lie within one 24 px target.
    const snapshot = {
      ...g1,
      productionOrders: g1.productionOrders.map((order) => ({
        ...order,
        jobOrders: order.jobOrders.map((row) => {
          if (row.displayNumber !== '1002.10' || row.placement === undefined) return row;
          const setupStartMs = Date.UTC(2026, 10, 4, 11, 45);
          const endMs = Date.UTC(2026, 10, 4, 15, 15);
          return {
            ...row,
            equipment: 'CNC1',
            placement: {
              setupStartMs,
              runStartMs: setupStartMs,
              endMs,
              segments: [{ fromMs: setupStartMs, toMs: endMs }],
            },
          };
        }),
      })),
    };
    renderGanttRoute({ zoom: '4weeks', from: '2026-11-02' }, sourceOf(snapshot), 'board');
    const board = await findBoard();
    const row = machineRow(board, 'CNC 1');
    const cluster = within(row).getByRole('gridcell', {
      name: named('2 jobs, Wed 4 Nov 08:00 to Wed 4 Nov 16:15, 1 late, 1 locked'),
    });

    expect(within(row).getAllByRole('gridcell')).toHaveLength(4);
    expect(cluster.getAttribute('aria-haspopup')).toBe('dialog');
    expect(Number.parseFloat(cluster.style.width)).toBeGreaterThanOrEqual(24);
    // A narrow job order alone keeps its own cell, 24 px wide.
    const lone = row.querySelector<HTMLElement>('[data-job-order="1005.10"]') as HTMLElement;
    expect(Number.parseFloat(lone.style.width)).toBeGreaterThanOrEqual(24);

    cluster.focus();
    await user.keyboard('{Enter}');
    const popover = await screen.findByRole('dialog', {
      name: '2 jobs on CNC 1, Wed 4 Nov 08:00 to Wed 4 Nov 16:15',
    });
    expect(cluster.getAttribute('aria-expanded')).toBe('true');
    const rows = within(popover).getAllByRole('button', { name: /^100/ });
    expect(rows.map((button) => button.textContent)).toEqual([
      '1003.10 Gear blank 32',
      '1002.10 Housing P',
    ]);
    expect(document.activeElement).toBe(rows[0]);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(cluster);
  });

  it('DR32 puts the Tab stop on the Not placed cell when no machine has a job order in the range', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-16' }, undefined, 'board');
    const board = await findBoard();

    const stops = board.querySelectorAll('[tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect(stops[0]?.textContent).toBe('No job orders without a place');
  });

  it('TA10 leaves the arrow keys with a modifier to the browser', async () => {
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const first = board.querySelector<HTMLElement>('[role="gridcell"][data-job-order="1001.10"]');
    first?.focus();

    await user.keyboard('{Shift>}{ArrowRight}{/Shift}{Control>}{End}{/Control}');
    expect(document.activeElement).toBe(first);
  });

  it('DR20 shows the error state when a later range fails to load, not the range before', async () => {
    const user = userEvent.setup();
    let loads = 0;
    const failingLater: GanttDataSource = {
      load: async (input) => {
        loads += 1;
        if (loads > 1 && input.from.startsWith('2026-11-08')) {
          throw new Error('The plan server did not answer');
        }
        return g1DataSource.load(input);
      },
    };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, failingLater, 'board');
    await findBoard();

    await user.click(screen.getByRole('button', { name: 'Show later range' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'The board could not be loaded' }),
    ).toBeTruthy();
    expect(screen.queryByRole('grid')).toBeNull();
  });

  it('plan 07 one Escape closes the hover card, and the next clears the selection', async () => {
    const user = userEvent.setup();
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const block = board.querySelector<HTMLElement>('[role="gridcell"][data-job-order="1003.20"]');
    block?.focus();
    await screen.findByRole('tooltip');
    await user.keyboard('{Enter}');
    expect(router.state.location.search).toMatchObject({ order: 'po-1003' });

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    expect(router.state.location.search).toMatchObject({ order: 'po-1003' });
    await user.keyboard('{Escape}');
    expect(router.state.location.search).toEqual({ zoom: 'week', from: '2026-11-02' });
    expect(document.activeElement).toBe(block);
  });

  it('ADR0021 a cluster with a late and a held job order names the late before the held', async () => {
    renderGanttRoute(
      { zoom: '4weeks', from: '2026-11-02' },
      sourceOf(clusterSnapshot({ held: true })),
      'board',
    );
    const board = await findBoard();

    expect(
      within(machineRow(board, 'CNC 1')).getByRole('gridcell', {
        name: named(
          '2 jobs, Wed 4 Nov 08:00 to Wed 4 Nov 16:15, 1 late, 1 being edited by another planner, 1 locked',
        ),
      }),
    ).toBeTruthy();
  });

  it('IN27 a row of the cluster popover selects its order, closes the popover and marks the cluster', async () => {
    const user = userEvent.setup();
    const router = renderGanttRoute(
      { zoom: '4weeks', from: '2026-11-02' },
      sourceOf(clusterSnapshot()),
      'board',
    );
    const board = await findBoard();
    const cluster = board.querySelector<HTMLElement>(
      '[data-cluster="1003.10 1002.10"]',
    ) as HTMLElement;

    await user.click(cluster);
    const popover = await screen.findByRole('dialog', { name: /^2 jobs on CNC 1/ });
    await user.click(within(popover).getByRole('button', { name: '1002.10 Housing P' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(router.state.location.search).toMatchObject({ order: 'po-1002' });
    expect(cluster.getAttribute('aria-selected')).toBe('true');
    expect(cluster.querySelector('[data-selection-bar]')).not.toBeNull();
    expect(board.querySelector('[tabindex="0"]')).toBe(cluster);
  });

  it('BO1 a Not placed chip selects its order by click or Enter and shows the selection', async () => {
    const user = userEvent.setup();
    const g1 = g1Snapshot();
    const snapshot = {
      ...g1,
      productionOrders: g1.productionOrders.map((order) => ({
        ...order,
        jobOrders: order.jobOrders.map((row) => {
          if (row.displayNumber !== '1005.20') return row;
          const { placement: _, equipment: __, ...unplaced } = row;
          return unplaced;
        }),
      })),
    };
    const router = renderGanttRoute(
      { zoom: 'week', from: '2026-11-02' },
      sourceOf(snapshot),
      'board',
    );
    const board = await findBoard();
    const chip = board.querySelector<HTMLElement>(
      '[aria-rowindex="2"] [data-job-order="1005.20"]',
    ) as HTMLElement;

    chip.focus();
    await user.keyboard('{Enter}');
    expect(router.state.location.search).toMatchObject({ order: 'po-1005' });
    expect(chip.getAttribute('aria-selected')).toBe('true');
    expect(chip.querySelector('[data-selection-bar]')).not.toBeNull();
  });

  it('URL state a change of the selected order adds a history entry, so Back returns to the order before', async () => {
    const user = userEvent.setup();
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const block = (job: string) =>
      board.querySelector<HTMLElement>(`[role="gridcell"][data-job-order="${job}"]`) as HTMLElement;

    await user.click(block('1001.10'));
    await user.click(block('1003.10'));
    expect(router.state.location.search).toMatchObject({ order: 'po-1003' });
    router.history.back();
    await waitFor(() => expect(router.state.location.search).toMatchObject({ order: 'po-1001' }));
  });

  it('plan 07 a hard-locked job order in the past is not overdue', async () => {
    const g1 = g1Snapshot();
    renderGanttRoute(
      { zoom: 'week', from: '2026-11-02' },
      sourceOf({ ...g1, nowMs: Date.UTC(2026, 10, 5, 12) }),
      'board',
    );
    const board = await findBoard();

    expect(
      board
        .querySelector('[role="gridcell"][data-job-order="1002.10"]')
        ?.getAttribute('data-states'),
    ).toBe('locked');
  });

  it('BO8 a wide job order after a narrow one keeps its own cell', async () => {
    const snapshot = withJobOrder(g1Snapshot(), '1004.10', {
      fromMs: Date.UTC(2026, 10, 4, 12),
      toMs: Date.UTC(2026, 10, 5, 13),
    });
    renderGanttRoute({ zoom: '4weeks', from: '2026-11-02' }, sourceOf(snapshot), 'board');
    const board = await findBoard();

    expect(jobNumbers(machineRow(board, 'CNC 1'))).toEqual([
      '1001.10',
      '1003.10',
      '1004.10',
      '1005.10',
    ]);
  });
  it('BO1 marks the board busy while a later range loads, and not once it has loaded', async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const slowLater: GanttDataSource = {
      load: async (input) => {
        if (input.from.startsWith('2026-11-08')) {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        return g1DataSource.load(input);
      },
    };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, slowLater, 'board');
    expect((await findBoard()).getAttribute('aria-busy')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Show later range' }));
    const board = await screen.findByRole('grid', {
      name: 'plant-a board, W46, Mon 9 Nov to Sun 15 Nov',
    });
    expect(board.getAttribute('aria-busy')).toBe('true');

    release();
    await waitFor(() => expect(board.getAttribute('aria-busy')).toBeNull());
  });

  // The D1 block text in pure black in both themes, and the group button's target height (WCAG
  // 2.5.8), are read from computed style in e2e/design-rules.spec.ts.

  it('BO1 lists a job order with a span but no machine in the Not placed row', async () => {
    const g1 = g1Snapshot();
    const snapshot = {
      ...g1,
      productionOrders: g1.productionOrders.map((order) => ({
        ...order,
        jobOrders: order.jobOrders.map((row) => {
          if (row.displayNumber !== '1001.20') return row;
          const { equipment: _, ...withoutMachine } = row;
          return withoutMachine;
        }),
      })),
    };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, sourceOf(snapshot), 'board');
    const board = await findBoard();

    const notPlaced = within(board).getByRole('rowheader', {
      name: named('Not placed, 1 job order'),
    });
    const row = notPlaced.closest<HTMLElement>('[role="row"]') as HTMLElement;
    expect(
      within(row).getByRole('gridcell', { name: named('1001.20 Bracket L, 600 pcs, not placed') }),
    ).toBeTruthy();
    expect(jobNumbers(machineRow(board, 'CNC 2'))).toEqual(['1002.10']);
  });
});
