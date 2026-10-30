// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { GanttSnapshot } from '../../../src/modules/planning/gantt-data.ts';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { findGantt, renderGanttRoute, sourceOf } from './gantt-fixtures.tsx';

afterEach(cleanup);

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
