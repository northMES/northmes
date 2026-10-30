// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { GanttSnapshot } from '../../../src/modules/planning/gantt-data.ts';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { findGantt, renderGanttRoute, sourceOf } from './gantt-fixtures.tsx';

afterEach(cleanup);

const pointer = { pointerId: 1, button: 0, isPrimary: true, clientY: 300 };
const refusal = 'Cannot move 1001.10: it would start before now.';

/**
 * Drags a block 500 px earlier at Week (16 px an hour), from Tue 3 Nov 11:30 to before G1's now,
 * Mon 2 Nov 09:40, checks the refusal in the preview, and lets go.
 */
async function dragIntoPast(view: HTMLElement, block: HTMLElement) {
  fireEvent.pointerDown(block, { ...pointer, clientX: 600 });
  fireEvent.pointerMove(block, { ...pointer, clientX: 595 });
  await waitFor(() => expect(view.querySelector('[data-move-preview]')).not.toBeNull());
  fireEvent.pointerMove(block, { ...pointer, clientX: 100 });
  await waitFor(() =>
    expect(view.querySelector('[data-move-preview]')?.getAttribute('data-refused')).toBe('PAST'),
  );
  expect(view.querySelector('[data-drag-tooltip]')?.textContent).toBe(refusal);
  fireEvent.pointerUp(block, { ...pointer, clientX: 100 });
  await waitFor(() =>
    expect(document.getElementById('announcer-polite')?.textContent).toBe(refusal),
  );
  expect(view.querySelector('[data-move-preview]')).toBeNull();
  expect(screen.getByRole('button', { name: 'My draft' })).toBeTruthy();
}

/** The board grid, once it has loaded. */
async function findBoard(): Promise<HTMLElement> {
  return waitFor(() => {
    const board = screen.getByRole('grid', { name: /board/ });
    if (board.getAttribute('aria-busy') === 'true') throw new Error('The board is loading');
    return board;
  });
}

/**
 * G1 at Tue 3 Nov 12:00 plant time, with 1004.10 finished: 1001.10 should have started at 11:30
 * and has not, so it is overdue.
 */
function withFinishedAndOverdue(): GanttSnapshot {
  const g1 = g1Snapshot();
  return {
    ...g1,
    nowMs: Date.UTC(2026, 10, 3, 11),
    productionOrders: g1.productionOrders.map((order) => ({
      ...order,
      jobOrders: order.jobOrders.map((row) =>
        row.displayNumber === '1004.10' ? { ...row, status: 'finished' as const } : row,
      ),
    })),
  };
}

describe('the time before now on the order Gantt (ADR 0089, Time before now)', () => {
  it('every job order row tones its time before now', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const now = String(g1Snapshot().nowMs);

    const rows = [...gantt.querySelectorAll<HTMLElement>('[data-row-id^="jo-"]')];
    expect(rows).toHaveLength(10);
    for (const row of rows) {
      expect(row.querySelector('[data-past]')?.getAttribute('data-to-ms')).toBe(now);
    }
  });

  it('draws a finished job order muted with its cue and "finished" in its name; an overdue one keeps its colour', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, sourceOf(withFinishedAndOverdue()));
    const gantt = await findGantt();
    const block = (id: string) =>
      gantt.querySelector<HTMLElement>(`[data-block="${id}"]`) as HTMLElement;

    const finished = block('jo-1004-10');
    expect(finished.getAttribute('data-finished')).toBe('true');
    expect(finished.style.background).toBe('var(--muted)');
    expect(finished.querySelector('[data-finished-cue]')).not.toBeNull();
    expect(finished.getAttribute('aria-label')).toMatch(/, finished$/);
    const overdue = block('jo-1001-10');
    expect(overdue.getAttribute('data-finished')).toBeNull();
    expect(overdue.style.background).toBe('var(--palette-1)');
  });
});

describe('a drag into the time before now (ADR 0089, Time before now)', () => {
  it('on the order Gantt shows the PAST refusal in the preview and refuses the drop', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await dragIntoPast(
      gantt,
      gantt.querySelector<HTMLElement>('[data-block="jo-1001-10"]') as HTMLElement,
    );
  });

  it('on the planning board shows the PAST refusal in the preview and refuses the drop', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();

    await dragIntoPast(
      board,
      board.querySelector<HTMLElement>(
        '[role="gridcell"][data-job-order="1001.10"]',
      ) as HTMLElement,
    );
  });
});

describe('the time before now on the planning board (ADR 0089, Time before now)', () => {
  it('every machine row tones its time before now', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const now = String(g1Snapshot().nowMs);

    const machines = g1Snapshot().equipment.map((machine) => machine.name);
    expect(machines.length).toBeGreaterThan(0);
    for (const machine of machines) {
      const row = within(board).getByRole('rowheader', { name: machine }).closest('[role="row"]');
      expect(row?.querySelector('[data-past]')?.getAttribute('data-to-ms')).toBe(now);
    }
  });

  it('draws a finished job order muted with its cue and "finished" in its name; an overdue one keeps its colour', async () => {
    renderGanttRoute(
      { zoom: 'week', from: '2026-11-02' },
      sourceOf(withFinishedAndOverdue()),
      'board',
    );
    const board = await findBoard();
    const block = (job: string) =>
      board.querySelector<HTMLElement>(`[role="gridcell"][data-job-order="${job}"]`) as HTMLElement;

    const finished = block('1004.10');
    expect(finished.getAttribute('data-states')).toBe('finished');
    expect(finished.style.background).toBe('var(--muted)');
    expect(finished.querySelector('[data-state-icon="finished"]')).not.toBeNull();
    expect(finished.textContent).toContain('finished');
    const overdue = block('1001.10');
    expect(overdue.getAttribute('data-states')).toBe('overdue');
    expect(overdue.style.background).toBe('var(--palette-1)');
  });
});
