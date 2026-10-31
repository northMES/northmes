// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import {
  detailsOpen,
  findGantt,
  planningHref,
  renderGanttRoute,
  sourceOf,
} from './gantt-fixtures.tsx';

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(document, 'elementsFromPoint');
});

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

/**
 * A name matcher for text that joins nested spans: happy-dom has no layout, so it reads every span
 * as a block and puts a space around it, where a browser joins inline spans without one.
 */
function named(text: string): (name: string) => boolean {
  return (name) => name.replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim() === text;
}

/** What the polite live region says. */
function spoken(): string {
  return document.getElementById('announcer-polite')?.textContent ?? '';
}

/**
 * Points document.elementsFromPoint at the row of a machine for a drag: happy-dom has no layout,
 * so a test names the machine row under each pointer position.
 */
function rowsUnderPointer(board: HTMLElement, rowAt: (clientY: number) => string): void {
  Object.defineProperty(document, 'elementsFromPoint', {
    configurable: true,
    value: (_x: number, y: number) => {
      // During a move, a machine the operation may not use says so after its name (#944).
      const machine = rowAt(y);
      const header = within(board).getByRole('rowheader', {
        name: (name) => name === machine || name.startsWith(`${machine},`),
      });
      const row = header.closest('[role="row"]');
      return row === null ? [] : [row];
    },
  });
}

/** The machine rows greyed out as not allowed for the job order that moves, by machine name. */
function greyedRows(board: HTMLElement): string[] {
  return [...board.querySelectorAll<HTMLElement>('[role="row"][data-not-allowed]')].map(
    (row) => row.querySelector('[data-machine-name]')?.textContent ?? '',
  );
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

  it('IN7 IN8 Shift+F10 opens the block menu, and Move opens the Move dialog with every allowed machine and a start', async () => {
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1001.10').focus();

    await user.keyboard('{Shift>}{F10}{/Shift}');
    const menu = await screen.findByRole('menu', { name: 'Actions for 1001.10' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Move', 'Open order']);
    await user.click(within(menu).getByRole('menuitem', { name: 'Move' }));

    const dialog = await screen.findByRole('dialog', { name: 'Move 1001.10 Bracket L' });
    expect(
      within(dialog).getByText(
        'Choose a machine and a start. The move goes into your draft, and Save writes it to the plan.',
      ),
    ).toBeTruthy();
    const machines = within(dialog).getByRole('radiogroup', { name: 'Machine' });
    const radios = within(machines).getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(within(machines).getByRole('radio', { name: named('CNC 1, Current') })).toBe(radios[0]);
    await waitFor(() => expect(document.activeElement).toBe(radios[0]));
    const start = within(dialog).getByRole('textbox', { name: 'Start, plant time (CET)' });
    expect((start as HTMLInputElement).value).toBe('2026-11-03 11:30');

    await user.clear(start);
    await user.type(start, '2026-11-04 06:00');
    await waitFor(() => {
      expect(
        within(machines).getByRole('radio', {
          name: named('CNC 1, Current'),
          description: named(
            'Ends Wed 4 Nov 12:15 Overlaps 1003.10 Gear blank 32, until 12:45, late by 15 h 15 min',
          ),
        }),
      ).toBeTruthy();
    });
    await user.click(
      within(machines).getByRole('radio', {
        name: 'CNC 2',
        description: named('Ends Wed 4 Nov 12:15 Overlaps none'),
      }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Move' }));

    await waitFor(() => {
      expect(spoken()).toBe(
        '1001.10 moved to CNC 2, Wed 4 Nov 06:00 to Wed 4 Nov 12:15. 1 row moves with it. Not saved.',
      );
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(block(board, '1001.10')));
    expect(machineOf(block(board, '1001.10'))).toBe('CNC 2');
  });

  it('IN9 Move with a start that is not a date and time keeps the dialog open with the field error', async () => {
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1001.10').focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');
    await user.click(await screen.findByRole('menuitem', { name: 'Move' }));
    const dialog = await screen.findByRole('dialog', { name: 'Move 1001.10 Bracket L' });
    const start = within(dialog).getByRole('textbox', { name: 'Start, plant time (CET)' });

    await user.clear(start);
    await user.type(start, '2026-11-03 1130');
    await user.click(within(dialog).getByRole('button', { name: 'Move' }));

    const summary = within(dialog).getByRole('group', { name: '1 field needs attention' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(start.getAttribute('aria-invalid')).toBe('true');
    expect(within(dialog).getByText('Enter a date and time like 2026-11-03 11:30.')).toBeTruthy();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(block(board, '1001.10')));
    expect(screen.getByRole('button', { name: 'My draft' })).toBeTruthy();
  });
  it('ADR0089 Move with a start before now keeps the dialog open with the PAST refusal and writes nothing', async () => {
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1001.10').focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');
    await user.click(await screen.findByRole('menuitem', { name: 'Move' }));
    const dialog = await screen.findByRole('dialog', { name: 'Move 1001.10 Bracket L' });
    const start = within(dialog).getByRole('textbox', { name: 'Start, plant time (CET)' });

    // G1's now is Mon 2 Nov 09:40.
    await user.clear(start);
    await user.type(start, '2026-11-02 09:00');
    await user.click(within(dialog).getByRole('button', { name: 'Move' }));

    const summary = within(dialog).getByRole('group', { name: '1 field needs attention' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(start.getAttribute('aria-invalid')).toBe('true');
    expect(
      within(dialog).getByText(
        'Cannot move 1001.10: it would start before now. Enter a start at or after Mon 2 Nov 09:40.',
      ),
    ).toBeTruthy();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'My draft' })).toBeTruthy();
  });

  it('plan 07 a move that lands after the range moves the range with it and keeps focus on the block', async () => {
    const user = userEvent.setup();
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1006.10').focus();

    // Fri 13:00 plus the 4 h step is Fri 17:00, closed, so the move lands on Mon 9 Nov 06:00.
    await user.keyboard('m{ArrowRight}{Enter}');
    await waitFor(() => expect(spoken()).toContain('1006.10 moved to Mill 1, Mon 9 Nov 06:00'));
    // The buffer is rebuilt with the block at the centre of the view, so from is the visible
    // start before it (ADR 0089).
    await waitFor(() => expect(router.state.location.search.from).toMatch(/^2026-11-0[789]T/));
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('data-job-order')).toBe('1006.10'),
    );
  });

  it('IN6 in move mode the keys that would move focus stay with the moving block, and Escape cancels', async () => {
    const user = userEvent.setup();
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1001.10').focus();
    await user.keyboard(' ');

    await user.keyboard('m{ArrowRight}{Home}{End}{PageDown}');
    expect(document.activeElement).toBe(block(board, '1001.10'));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(spoken()).toBe('Move cancelled.'));
    expect(board.querySelector('[data-move-preview]')).toBeNull();
    expect(router.state.location.search).toMatchObject({ order: 'po-1001' });
  });

  it('IN6 Tab out of a moving block ends move mode without a change', async () => {
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1001.10').focus();

    await user.keyboard('m{ArrowRight}');
    await waitFor(() => expect(board.querySelector('[data-move-preview]')).not.toBeNull());
    await user.tab();
    await waitFor(() => expect(board.querySelector('[data-move-preview]')).toBeNull());
    expect(board.contains(document.activeElement)).toBe(false);
    expect(screen.getByRole('button', { name: 'My draft' })).toBeTruthy();
  });

  it('IN6 Down in move mode skips the machines of a collapsed group', async () => {
    const g1 = g1Snapshot();
    // A second group holds CNC 2, so collapsing it leaves 1001.10 one allowed machine to step to: none.
    const snapshot = {
      ...g1,
      equipmentGroups: [...g1.equipmentGroups, { code: 'TURN', name: 'Turning' }],
      equipment: g1.equipment.map((machine) =>
        machine.code === 'CNC2' ? { ...machine, group: 'TURN' } : machine,
      ),
    };
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, sourceOf(snapshot), 'board');
    const board = await findBoard();
    await user.click(within(board).getByRole('button', { name: 'Collapse Turning' }));
    block(board, '1001.10').focus();

    await user.keyboard('m{ArrowDown}');
    await waitFor(() => expect(spoken()).toContain('CNC 1, Tue 3 Nov 11:30'));
    expect(spoken()).not.toContain('CNC 2');
  });

  it('a cluster names a job order that the draft moved', async () => {
    const user = userEvent.setup();
    const g1 = g1Snapshot();
    // At Hours, two job orders of 6 min on CNC 1, 15 min apart: one 15 min step of 1003.10 puts
    // 1002.10 inside its 24 px target.
    const span = (
      row: (typeof g1.productionOrders)[number]['jobOrders'][number],
      fromMs: number,
    ) => ({
      ...row,
      equipment: 'CNC1',
      plannedSetupS: 0,
      plannedRunS: 360,
      placement: {
        setupStartMs: fromMs,
        runStartMs: fromMs,
        endMs: fromMs + 360_000,
        segments: [{ fromMs, toMs: fromMs + 360_000 }],
      },
    });
    const snapshot = {
      ...g1,
      productionOrders: g1.productionOrders.map((order) => ({
        ...order,
        jobOrders: order.jobOrders.map((row) =>
          row.displayNumber === '1003.10'
            ? span(row, Date.UTC(2026, 10, 4, 7))
            : row.displayNumber === '1002.10'
              ? span(row, Date.UTC(2026, 10, 4, 7, 21))
              : row,
        ),
      })),
    };
    renderGanttRoute({ zoom: 'hours', from: '2026-11-04' }, sourceOf(snapshot), 'board');
    const board = await findBoard();
    expect(board.querySelector('[data-cluster]')).toBeNull();
    block(board, '1003.10').focus();
    await user.keyboard('m{ArrowRight}{Enter}');
    await waitFor(() => expect(spoken()).toContain('1003.10 moved to CNC 1'));

    await waitFor(() =>
      expect(board.querySelector('[data-cluster]')?.getAttribute('aria-label') ?? '').toContain(
        '1 changed in your draft',
      ),
    );
  });

  it('My draft opens the drawer with the moves, and closing it returns focus to the button', async () => {
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1001.10').focus();
    await user.keyboard('m{ArrowRight}{Enter}');
    await waitFor(() => expect(spoken()).toContain('1001.10 moved to CNC 1'));

    const button = screen.getByRole('button', { name: 'My draft, 2 changes' });
    await user.click(button);
    const drawer = await screen.findByRole('dialog', { name: /My draft/ });
    expect(within(drawer).getAllByText(/1001\.10/).length).toBeGreaterThan(0);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'My draft, 2 changes' }),
      ),
    );
  });

  it('DR20 shows no My draft button while the board is not drawn', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02', preview: 'error' }, undefined, 'board');

    await screen.findByRole('heading', { level: 2, name: 'The board could not be loaded' });
    expect(screen.queryByRole('button', { name: /^My draft/ })).toBeNull();
  });

  it('IN4 a straight drag down moves a block to the machine under the pointer, and the click after the drop selects nothing', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    rowsUnderPointer(board, (y) => (y < 50 ? 'CNC 1' : 'CNC 2'));
    const cell = block(board, '1001.10');

    fireEvent.pointerDown(cell, { button: 0, clientX: 100, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(cell, { clientX: 100, clientY: 40, pointerId: 1 });
    fireEvent.pointerMove(cell, { clientX: 100, clientY: 70, pointerId: 1 });
    await waitFor(() => {
      const preview = board.querySelector<HTMLElement>('[data-move-preview="jo-1001-10"]');
      expect(preview === null ? '' : machineOf(preview)).toBe('CNC 2');
    });
    fireEvent.pointerUp(cell, { clientX: 100, clientY: 70, pointerId: 1, button: 0 });
    fireEvent.click(cell);
    // The drop snaps to the Week step first: Tue 11:30 becomes Tue 12:00, on CNC 2.
    await waitFor(() => expect(spoken()).toContain('1001.10 moved to CNC 2, Tue 3 Nov 12:00'));
    expect(router.state.location.search).toEqual({ zoom: 'week', from: '2026-11-02' });
  });

  it('IN5 a drop on a machine the operation may not use is refused and says why', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    rowsUnderPointer(board, (y) => (y < 50 ? 'CNC 1' : 'Mill 1'));
    const cell = block(board, '1001.10');

    fireEvent.pointerDown(cell, { button: 0, clientX: 100, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(cell, { clientX: 100, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(cell, { clientX: 100, clientY: 90, pointerId: 1, button: 0 });
    await waitFor(() =>
      expect(spoken()).toBe(
        'Cannot move 1001.10: not allowed on Mill 1. This operation runs on CNC 1 and CNC 2.',
      ),
    );
    expect(machineOf(block(board, '1001.10'))).toBe('CNC 1');
    expect(screen.getByRole('button', { name: 'My draft' })).toBeTruthy();
  });

  it('#944 IN5 a drag greys out the rows of the machines the operation may not use, with a hatch and "not allowed for Turn" in the row header\'s name', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    rowsUnderPointer(board, () => 'CNC 1');
    const cell = block(board, '1001.10');
    expect(greyedRows(board)).toEqual([]);

    // 1001.10 is Turn, which runs on CNC 1 and CNC 2 only.
    fireEvent.pointerDown(cell, { button: 0, clientX: 100, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(cell, { clientX: 100, clientY: 40, pointerId: 1 });
    await waitFor(() => expect(greyedRows(board)).toEqual(['Mill 1']));
    const mill = within(board).getByRole('rowheader', { name: 'Mill 1, not allowed for Turn' });
    expect(mill.closest('[role="row"]')?.querySelector('[data-not-allowed-hatch]')).not.toBeNull();
    expect(within(board).getByRole('rowheader', { name: 'CNC 1' })).toBeTruthy();
    expect(within(board).getByRole('rowheader', { name: 'CNC 2' })).toBeTruthy();
  });

  it("#944 IN5 over a greyed row the preview stays on the current machine and the block's cursor says not allowed, until the pointer leaves it", async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    rowsUnderPointer(board, (y) => (y < 50 ? 'CNC 1' : 'Mill 1'));
    const cell = block(board, '1001.10');

    fireEvent.pointerDown(cell, { button: 0, clientX: 100, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(cell, { clientX: 100, clientY: 90, pointerId: 1 });
    await waitFor(() => expect(cell.style.cursor).toBe('not-allowed'));
    const preview = board.querySelector<HTMLElement>('[data-move-preview="jo-1001-10"]');
    expect(preview === null ? '' : machineOf(preview)).toBe('CNC 1');

    fireEvent.pointerMove(cell, { clientX: 100, clientY: 40, pointerId: 1 });
    expect(cell.style.cursor).toBe('');
  });

  it('#944 IN5 a release over a greyed row is refused and says why, and the greying and the cursor end with it', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    rowsUnderPointer(board, () => 'Mill 1');
    const cell = block(board, '1001.10');

    fireEvent.pointerDown(cell, { button: 0, clientX: 100, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(cell, { clientX: 100, clientY: 90, pointerId: 1 });
    await waitFor(() => expect(greyedRows(board)).toEqual(['Mill 1']));
    fireEvent.pointerUp(cell, { clientX: 100, clientY: 90, pointerId: 1, button: 0 });
    await waitFor(() =>
      expect(spoken()).toBe(
        'Cannot move 1001.10: not allowed on Mill 1. This operation runs on CNC 1 and CNC 2.',
      ),
    );
    expect(machineOf(block(board, '1001.10'))).toBe('CNC 1');
    expect(greyedRows(board)).toEqual([]);
    expect(block(board, '1001.10').style.cursor).toBe('');
    expect(within(board).getByRole('rowheader', { name: 'Mill 1' })).toBeTruthy();
  });

  it('#944 Escape during a drag ends the greying', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    rowsUnderPointer(board, () => 'Mill 1');
    const cell = block(board, '1001.10');

    fireEvent.pointerDown(cell, { button: 0, clientX: 100, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(cell, { clientX: 164, clientY: 10, pointerId: 1 });
    await waitFor(() => expect(greyedRows(board)).toEqual(['Mill 1']));
    fireEvent.keyDown(cell, { key: 'Escape' });
    await waitFor(() => expect(greyedRows(board)).toEqual([]));
    expect(cell.style.cursor).toBe('');
  });

  it('#944 a cancelled drag ends the greying', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    rowsUnderPointer(board, () => 'Mill 1');
    const cell = block(board, '1001.10');

    fireEvent.pointerDown(cell, { button: 0, clientX: 100, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(cell, { clientX: 164, clientY: 10, pointerId: 1 });
    await waitFor(() => expect(greyedRows(board)).toEqual(['Mill 1']));
    fireEvent.pointerCancel(cell, { pointerId: 1 });
    await waitFor(() => expect(greyedRows(board)).toEqual([]));
    expect(cell.style.cursor).toBe('');
  });

  it('#944 IN6 keyboard move mode greys out the machines the operation may not use until Escape or Enter ends it', async () => {
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1001.10').focus();

    await user.keyboard('m');
    await waitFor(() => expect(greyedRows(board)).toEqual(['Mill 1']));
    expect(
      within(board).getByRole('rowheader', { name: 'Mill 1, not allowed for Turn' }),
    ).toBeTruthy();
    // Down steps to CNC 2 and stops there: Mill 1 is never a step.
    await user.keyboard('{ArrowDown}{ArrowDown}');
    await waitFor(() => expect(spoken()).toContain('CNC 2'));
    expect(greyedRows(board)).toEqual(['Mill 1']);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(spoken()).toBe('Move cancelled.'));
    expect(greyedRows(board)).toEqual([]);

    block(board, '1001.10').focus();
    await user.keyboard('m');
    await waitFor(() => expect(greyedRows(board)).toEqual(['Mill 1']));
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(spoken()).toContain('1001.10 moved to CNC 2'));
    expect(greyedRows(board)).toEqual([]);
  });

  it('IN4 Escape during a drag, then letting go, selects nothing', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const cell = block(board, '1001.10');

    fireEvent.pointerDown(cell, { button: 0, clientX: 100, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(cell, { clientX: 164, clientY: 10, pointerId: 1 });
    await waitFor(() => expect(board.querySelector('[data-move-preview]')).not.toBeNull());
    fireEvent.keyDown(cell, { key: 'Escape' });
    fireEvent.pointerUp(cell, { clientX: 164, clientY: 10, pointerId: 1, button: 0 });
    fireEvent.click(cell);
    expect(router.state.location.search).toEqual({ zoom: 'week', from: '2026-11-02' });
  });

  it('#886 a drag on the second press of a double click moves the block and leaves Details closed', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const cell = block(board, '1001.10');
    fireEvent.click(cell, { detail: 1 });

    // The browser counts the drag's press as the second click and fires dblclick after its click.
    fireEvent.pointerDown(cell, { button: 0, clientX: 100, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(cell, { clientX: 164, clientY: 10, pointerId: 1 });
    await waitFor(() => expect(board.querySelector('[data-move-preview]')).not.toBeNull());
    fireEvent.pointerUp(cell, { clientX: 164, clientY: 10, pointerId: 1, button: 0 });
    fireEvent.click(cell, { detail: 2 });
    fireEvent.dblClick(cell, { detail: 2 });

    await waitFor(() => expect(spoken()).toContain('1001.10 moved to'));
    expect(detailsOpen()).toBe(false);
  });

  it('IN8 the step buttons step from the snapped start and write it', async () => {
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1001.10').focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');
    await user.click(await screen.findByRole('menuitem', { name: 'Move' }));
    const dialog = await screen.findByRole('dialog', { name: 'Move 1001.10 Bracket L' });
    const start = within(dialog).getByRole('textbox', { name: 'Start, plant time (CET)' });

    // Tue 11:30 plus 4 h is Tue 15:30, closed, so the start snaps to Wed 06:00, then Wed 10:00.
    await user.click(within(dialog).getByRole('button', { name: 'Start 4 h later' }));
    expect((start as HTMLInputElement).value).toBe('2026-11-04 06:00');
    await user.click(within(dialog).getByRole('button', { name: 'Start 4 h later' }));
    expect((start as HTMLInputElement).value).toBe('2026-11-04 10:00');
    await user.click(within(dialog).getByRole('button', { name: 'Start 4 h earlier' }));
    expect((start as HTMLInputElement).value).toBe('2026-11-04 06:00');
  });

  it('ADR0089 the PAST refusal names the first whole minute at or after now', async () => {
    const user = userEvent.setup();
    // Mon 2 Nov 09:40:30 plant time: a clock with seconds.
    const snapshot = { ...g1Snapshot(), nowMs: g1Snapshot().nowMs + 30_000 };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, sourceOf(snapshot), 'board');
    const board = await findBoard();
    block(board, '1001.10').focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');
    await user.click(await screen.findByRole('menuitem', { name: 'Move' }));
    const dialog = await screen.findByRole('dialog', { name: 'Move 1001.10 Bracket L' });
    const start = within(dialog).getByRole('textbox', { name: 'Start, plant time (CET)' });

    await user.clear(start);
    await user.type(start, '2026-11-02 09:40');
    await user.click(within(dialog).getByRole('button', { name: 'Move' }));

    expect(
      within(dialog).getByText(
        'Cannot move 1001.10: it would start before now. Enter a start at or after Mon 2 Nov 09:41.',
      ),
    ).toBeTruthy();
  });

  it('ADR0089 the later step of an overdue row lands at now or later in one press', async () => {
    const user = userEvent.setup();
    // Wed 4 Nov 11:00 plant time: 1001.10, planned for Tue 3 Nov 11:30, is overdue by a day.
    const snapshot = { ...g1Snapshot(), nowMs: Date.UTC(2026, 10, 4, 10) };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, sourceOf(snapshot), 'board');
    const board = await findBoard();
    block(board, '1001.10').focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');
    await user.click(await screen.findByRole('menuitem', { name: 'Move' }));
    const dialog = await screen.findByRole('dialog', { name: 'Move 1001.10 Bracket L' });
    const start = within(dialog).getByRole('textbox', { name: 'Start, plant time (CET)' });

    await user.click(within(dialog).getByRole('button', { name: 'Start 4 h later' }));

    expect((start as HTMLInputElement).value).toBe('2026-11-04 11:30');
  });

  it('IN8 a Move from the dialog past the range moves the range and focuses the block', async () => {
    const user = userEvent.setup();
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1001.10').focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');
    await user.click(await screen.findByRole('menuitem', { name: 'Move' }));
    const dialog = await screen.findByRole('dialog', { name: 'Move 1001.10 Bracket L' });
    const start = within(dialog).getByRole('textbox', { name: 'Start, plant time (CET)' });

    await user.clear(start);
    await user.type(start, '2026-11-16 06:00');
    await user.click(within(dialog).getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(router.state.location.search.from).toMatch(/^2026-11-1[456]T/));
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('data-job-order')).toBe('1001.10'),
    );
  });

  it('IN7 a locked job order keeps Move in its menu, disabled and described by the reason', async () => {
    const user = userEvent.setup();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    block(board, '1002.10').focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');

    const move = await screen.findByRole('menuitem', {
      name: 'Move',
      description: 'Cannot move 1002.10: locked.',
    });
    expect(move.getAttribute('aria-disabled')).toBe('true');
  });
});
