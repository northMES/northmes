// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import {
  chooseDetailsAction,
  detailsOpen,
  findDetails,
  renderGanttRoute,
  sourceOf,
} from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The board grid, once it has loaded; while it loads, the grid's skeleton is busy. */
async function findBoard(): Promise<HTMLElement> {
  return waitFor(() => {
    const board = screen.getByRole('grid', { name: /board/, hidden: true });
    if (board.getAttribute('aria-busy') === 'true') throw new Error('The board is loading');
    return board;
  });
}

/** The board cell of a job order. */
function block(board: HTMLElement, job: string): HTMLElement {
  const cell = board.querySelector<HTMLElement>(`[role="gridcell"][data-job-order="${job}"]`);
  if (cell === null) throw new Error(`No cell for ${job}`);
  return cell;
}

/** What the polite live region says. */
function spoken(): string {
  return document.getElementById('announcer-polite')?.textContent ?? '';
}

describe('Details on the planning board (Krister, 2026-10-21: the Gantt drawer)', () => {
  it('Enter on a job order selects its order and opens Details, and Escape returns focus to the block', async () => {
    const user = userEvent.setup();
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1001.10').focus();

    await user.keyboard('{Enter}');
    const drawer = await findDetails();
    expect(within(drawer).getByRole('heading', { level: 2 }).textContent).toBe('1001.10 Turn');
    expect(router.state.location.search).toMatchObject({ order: 'po-1001' });

    await user.keyboard('{Escape}');
    await waitFor(() => expect(detailsOpen()).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(block(board, '1001.10')));
    expect(router.state.location.search).toMatchObject({ order: 'po-1001' });
  });

  it('Space on a job order only selects its order', async () => {
    const user = userEvent.setup();
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();

    block(board, '1003.10').focus();
    await user.keyboard(' ');
    expect(router.state.location.search).toMatchObject({ order: 'po-1003' });
    expect(detailsOpen()).toBe(false);
  });

  it('#886 a single click on a job order selects its order and leaves Details closed, as on the Gantt', async () => {
    const user = userEvent.setup();
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();

    await user.click(block(board, '1004.10'));

    expect(router.state.location.search).toMatchObject({ order: 'po-1004' });
    expect(block(board, '1004.10').getAttribute('aria-selected')).toBe('true');
    expect(detailsOpen()).toBe(false);
  });

  it('#886 a double click on a job order opens its Details, as on the Gantt, and Escape returns focus to the block', async () => {
    const user = userEvent.setup();
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();

    await user.dblClick(block(board, '1004.10'));

    const drawer = await findDetails();
    expect(within(drawer).getByRole('heading', { level: 2 }).textContent).toBe('1004.10 Turn');
    expect(router.state.location.search).toMatchObject({ order: 'po-1004' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(detailsOpen()).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(block(board, '1004.10')));
  });

  it('IN31 a link that names an order opens the Details of its first job order in the range', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02', order: 'po-1003' }, undefined, 'board');

    const drawer = await findDetails();
    expect(within(drawer).getByRole('heading', { level: 2 }).textContent).toBe('1003.10 Turn');
  });

  it("Details' Move, a step and Apply put the move in the draft and return focus to the block", async () => {
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1001.10').focus();
    await user.keyboard('{Enter}');
    const drawer = await findDetails();

    await chooseDetailsAction(drawer, 'Move');
    await user.click(within(drawer).getByRole('button', { name: 'Later' }));
    await user.click(within(drawer).getByRole('button', { name: 'Apply' }));
    await waitFor(() =>
      expect(spoken()).toBe(
        '1001.10 moved to CNC 1, Wed 4 Nov 06:00 to Wed 4 Nov 12:15. 1 row moves with it. Not saved.',
      ),
    );
    await waitFor(() => expect(detailsOpen()).toBe(false));
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('data-job-order')).toBe('1001.10'),
    );
  });

  it("Details' Show critical chain opens the order's chain on the Gantt", async () => {
    const user = userEvent.setup();
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1003.20').focus();
    await user.keyboard('{Enter}');
    const drawer = await findDetails();

    await chooseDetailsAction(drawer, 'Show critical chain');
    await waitFor(() => expect(router.state.location.pathname).toBe('/plant-a/planning/gantt'));
    expect(router.state.location.search).toMatchObject({ order: 'po-1003', chain: 1 });
  });

  it('#886 a Not placed chip selects its order on a click and opens its Details on a double click', async () => {
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

    await user.click(chip);
    expect(router.state.location.search).toMatchObject({ order: 'po-1005' });
    expect(detailsOpen()).toBe(false);

    await user.dblClick(chip);
    const drawer = await findDetails();
    expect(within(drawer).getByRole('heading', { level: 2 }).textContent).toBe('1005.20 Mill');
  });

  it('a Not placed chip opens its Details by Enter, and Space only selects', async () => {
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
    await user.keyboard(' ');
    expect(router.state.location.search).toMatchObject({ order: 'po-1005' });
    expect(detailsOpen()).toBe(false);
    await user.keyboard('{Enter}');
    const drawer = await findDetails();
    expect(within(drawer).getByRole('heading', { level: 2 }).textContent).toBe('1005.20 Mill');
  });

  it('plan 07 closing Details during its Move ends the move without a change', async () => {
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1001.10').focus();
    await user.keyboard('{Enter}');
    const drawer = await findDetails();

    await chooseDetailsAction(drawer, 'Move');
    await user.click(within(drawer).getByRole('button', { name: 'Later' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(detailsOpen()).toBe(false));
    expect(board.querySelector('[data-move-preview]')).toBeNull();
    expect(block(board, '1001.10').getAttribute('data-move-mode')).toBeNull();
    // My draft leaves the bar while the draft has no changes (ADR 0090).
    expect(screen.queryByRole('button', { name: /^My draft/ })).toBeNull();
  });

  it('IN27 a job order of a cluster opens its Details from the popover, and closing returns focus to the cluster', async () => {
    const user = userEvent.setup();
    const g1 = g1Snapshot();
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
    const cluster = board.querySelector<HTMLElement>(
      '[data-cluster="1003.10 1002.10"]',
    ) as HTMLElement;

    await user.click(cluster);
    const popover = await screen.findByRole('dialog', { name: /^2 jobs on CNC 1/ });
    await user.click(within(popover).getByRole('button', { name: /^1002\.10 Housing P/ }));
    const drawer = await findDetails();
    expect(within(drawer).getByRole('heading', { level: 2 }).textContent).toBe('1002.10 Turn');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(detailsOpen()).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(cluster));
  });

  it('URL state Back to the order before closes the Details of the order after', async () => {
    const user = userEvent.setup();
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1001.10').focus();
    await user.keyboard('{Enter}');
    await findDetails();

    router.history.back();
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('order'));
    await waitFor(() => expect(detailsOpen()).toBe(false));
  });
});
