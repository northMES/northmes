// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { findGantt, planningHref, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The board grid, once it has loaded: while it loads, the grid's skeleton is busy. */
async function findBoard(): Promise<HTMLElement> {
  return waitFor(() => {
    const board = screen.getByRole('grid', { name: /board/ });
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

/** The machine row a cell lies in, by its row header. */
function machineOf(cell: HTMLElement): string {
  return cell.closest('[role="row"]')?.querySelector('[role="rowheader"]')?.textContent ?? '';
}

/** What the polite live region says. */
function spoken(): string {
  return document.getElementById('announcer-polite')?.textContent ?? '';
}

describe('moves on the planning board (plan 07, Moving without dragging; design D3, IN6)', () => {
  it('IN6 M enters move mode; Right steps a snap, Down the next allowed machine, Enter puts the move in my draft', async () => {
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1001.10').focus();

    await user.keyboard('m');
    expect(block(board, '1001.10').getAttribute('data-move-mode')).toBe('true');
    // Tue 11:30 plus the Week step of 4 h is Tue 15:30, closed, so the preview lands at Wed 06:00.
    await user.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(
        board.querySelector('[data-move-preview="jo-1001-10"]')?.getAttribute('data-from-ms'),
      ).toBe(String(Date.UTC(2026, 10, 4, 5)));
    });
    await waitFor(() => {
      expect(spoken()).toBe(
        'CNC 1, Wed 4 Nov 06:00 to Wed 4 Nov 12:15. 1 row moves with it. Not saved.',
      );
    });

    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(spoken()).toContain('CNC 2, Wed 4 Nov 06:00'));
    const preview = board.querySelector<HTMLElement>('[data-move-preview="jo-1001-10"]');
    expect(preview === null ? '' : machineOf(preview)).toBe('CNC 2');

    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(spoken()).toBe(
        '1001.10 moved to CNC 2, Wed 4 Nov 06:00 to Wed 4 Nov 12:15. 1 row moves with it. Not saved.',
      );
    });
    const moved = block(board, '1001.10');
    await waitFor(() => expect(document.activeElement).toBe(block(board, '1001.10')));
    expect(machineOf(moved)).toBe('CNC 2');
    expect(moved.getAttribute('data-states')).toContain('draft');
    expect(moved.getAttribute('data-move-mode')).toBeNull();
    expect(screen.getByRole('button', { name: 'My draft, 2 changes' })).toBeTruthy();
  });

  it('IN6 Escape cancels move mode and keeps the plan as it was', async () => {
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1001.10').focus();

    await user.keyboard('m{ArrowRight}{Escape}');
    await waitFor(() => expect(spoken()).toBe('Move cancelled.'));
    expect(board.querySelector('[data-move-preview]')).toBeNull();
    expect(machineOf(block(board, '1001.10'))).toBe('CNC 1');
    expect(screen.getByRole('button', { name: 'My draft' })).toBeTruthy();
  });

  it('IN6 a locked job order refuses move mode and says why', async () => {
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1002.10').focus();

    await user.keyboard('m');
    expect(block(board, '1002.10').getAttribute('data-move-mode')).toBeNull();
    // The app has one polite announcer; plan 07 asks for refusals to be assertive (a follow-up).
    await waitFor(() => expect(spoken()).toBe('Cannot move 1002.10: locked.'));
  });

  it('a move on the board shows on the Gantt and in the job order table, in the same draft', async () => {
    const user = userEvent.setup();
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1001.10').focus();
    await user.keyboard('m{ArrowRight}{ArrowDown}{Enter}');
    await waitFor(() => expect(spoken()).toContain('1001.10 moved to CNC 2'));

    await router.navigate({ href: planningHref('gantt', { zoom: 'week', from: '2026-11-02' }) });
    const gantt = await findGantt();
    await waitFor(() => {
      const ganttBlock = gantt.querySelector('[data-block="jo-1001-10"]');
      expect(ganttBlock?.getAttribute('aria-label')).toContain('CNC 2, Wed 4 Nov 06:00');
      expect(ganttBlock?.getAttribute('data-states')).toContain('draft');
    });
    expect(screen.getByRole('button', { name: 'My draft, 2 changes' })).toBeTruthy();

    await router.navigate({
      href: planningHref('jobOrders', { zoom: 'week', from: '2026-11-02' }),
    });
    const table = await screen.findByRole('table', { name: /^Job orders, / });
    const row = await within(table).findByRole('row', { name: /^1001\.10 / });
    expect(row.textContent).toContain('CNC 2');
    expect(row.textContent).toContain('Wed 4 Nov 06:00');
    expect(row.textContent).toContain('In my draft, not saved');
  });

  it('IN4 a pointer drag previews the snapped span and the drop puts the move in my draft', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const cell = block(board, '1001.10');

    // At Week a px is 3 min 45 s: 64 px is the 4 h step, Tue 15:30, which snaps to Wed 06:00.
    fireEvent.pointerDown(cell, { button: 0, clientX: 100, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(cell, { clientX: 132, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(cell, { clientX: 164, clientY: 10, pointerId: 1 });
    await waitFor(() => {
      expect(
        board.querySelector('[data-move-preview="jo-1001-10"]')?.getAttribute('data-from-ms'),
      ).toBe(String(Date.UTC(2026, 10, 4, 5)));
    });
    expect(board.querySelector('[data-drag-tooltip]')?.textContent).toBe(
      'Wed 4 Nov 06:00 to Wed 4 Nov 12:15, +1 row moves',
    );
    fireEvent.pointerUp(cell, { clientX: 164, clientY: 10, pointerId: 1, button: 0 });
    await waitFor(() => {
      expect(spoken()).toBe(
        '1001.10 moved to CNC 1, Wed 4 Nov 06:00 to Wed 4 Nov 12:15. 1 row moves with it. Not saved.',
      );
    });
    expect(block(board, '1001.10').getAttribute('data-states')).toContain('draft');
    expect(screen.getByRole('button', { name: 'My draft, 2 changes' })).toBeTruthy();
  });

  it('IN4 Escape during a drag cancels it and the block stays', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const cell = block(board, '1001.10');

    fireEvent.pointerDown(cell, { button: 0, clientX: 100, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(cell, { clientX: 164, clientY: 10, pointerId: 1 });
    await waitFor(() => expect(board.querySelector('[data-move-preview]')).not.toBeNull());
    fireEvent.keyDown(cell, { key: 'Escape' });
    await waitFor(() => expect(spoken()).toBe('Move cancelled.'));
    fireEvent.pointerUp(cell, { clientX: 164, clientY: 10, pointerId: 1, button: 0 });
    expect(board.querySelector('[data-move-preview]')).toBeNull();
    expect(screen.getByRole('button', { name: 'My draft' })).toBeTruthy();
  });
});
