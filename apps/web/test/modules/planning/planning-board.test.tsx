// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The board grid, once it has rendered. */
async function findBoard(): Promise<HTMLElement> {
  return screen.findByRole('grid', { name: /board/ });
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

describe('the planning board (plan 07, Planning board in release 1; design D3)', () => {
  it('BO1 shows the machines of G1 grouped by equipment group, each with its job orders in time order', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();

    expect(board.getAttribute('aria-label')).toBe('plant-a board, W45, Mon 2 Nov to Sun 8 Nov');
    expect(
      within(board).getByRole('button', { name: 'Collapse Machining' }).getAttribute('aria-expanded'),
    ).toBe('true');
    expect(within(board).getAllByRole('rowheader').map((header) => header.textContent)).toEqual(
      expect.arrayContaining(['CNC 1', 'CNC 2', 'Mill 1']),
    );
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
    expect(document.activeElement).toBe(within(board).getByRole('button', { name: 'Expand Machining' }));
    await user.keyboard(' ');
    expect(within(board).getByRole('rowheader', { name: 'CNC 1' })).toBeTruthy();
    await user.keyboard('{ArrowDown}{ArrowRight}');
    expect(document.activeElement?.getAttribute('data-job-order')).toBe('1001.10');
  });
});
