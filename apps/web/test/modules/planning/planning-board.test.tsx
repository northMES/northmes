// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, within } from '@testing-library/react';
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
});
