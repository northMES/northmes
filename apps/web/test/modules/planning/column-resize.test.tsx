// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { findGantt, renderGanttRoute } from './gantt-fixtures.tsx';

const ganttKey = 'northmes.planning.gantt.options';
const boardKey = 'northmes.planning.board.machine-column';

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(ganttKey);
  window.localStorage.removeItem(boardKey);
});

/** The board grid, once it has loaded: while it loads, the grid's skeleton is busy. */
async function findBoard(): Promise<HTMLElement> {
  return waitFor(() => {
    const board = screen.getByRole('grid', { name: /board/ });
    if (board.getAttribute('aria-busy') === 'true') throw new Error('The board is loading');
    return board;
  });
}

/** The tracks of the Gantt's tree columns, from the header's tree pane. */
function treeTracks(gantt: HTMLElement): string[] {
  const name = within(gantt).getAllByRole('columnheader')[0] as HTMLElement;
  const columns = name.closest('[data-tree-pane]')?.firstElementChild as HTMLElement;
  return columns.style.gridTemplateColumns.split(' ');
}

describe('resizing the tree columns of the order Gantt (#943)', () => {
  it('#943 every column but Name has a resize handle on its header edge, a separator with its width', async () => {
    window.localStorage.setItem(ganttKey, JSON.stringify({ hiddenColumns: [] }));
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    expect(within(gantt).queryByRole('separator', { name: 'Resize the Name column' })).toBeNull();
    for (const column of [
      'Machine',
      'Quantity',
      'Start',
      'End',
      'Working time',
      'Deadline',
      'Late by',
      'Float',
      'Status',
      'Lock',
    ]) {
      const handle = within(gantt).getByRole('separator', { name: `Resize the ${column} column` });
      // The handle sits in its own header, which keeps its name, so focus on it scrolls that
      // header into the pane.
      expect(handle.closest('[role="columnheader"]')?.getAttribute('aria-label')).toBe(column);
    }
    const deadline = within(gantt).getByRole('separator', { name: 'Resize the Deadline column' });
    expect(deadline.getAttribute('aria-orientation')).toBe('vertical');
    expect(deadline.getAttribute('aria-valuenow')).toBe('128');
    expect(deadline.tabIndex).toBe(0);
  });

  it('#943 Left and Right on the handle narrow and widen the column by 8 px, and the width stays in this browser', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const handle = within(gantt).getByRole('separator', { name: 'Resize the Deadline column' });

    handle.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(handle.getAttribute('aria-valuenow')).toBe('136');
    expect(treeTracks(gantt)[1]).toBe('136px');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(treeTracks(gantt)[1]).toBe('120px');
    expect(JSON.parse(window.localStorage.getItem(ganttKey) ?? '{}')).toMatchObject({
      columnWidths: { deadline: 120 },
    });
  });

  it("#943 Alt+Left and Alt+Right on a column's sort button narrow and widen it, a plain arrow does not, and on Name they do nothing", async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    within(gantt)
      .getByRole('button', { name: /^Deadline/ })
      .focus();
    await userEvent.keyboard('{Alt>}{ArrowRight}{ArrowRight}{ArrowLeft}{/Alt}');
    expect(treeTracks(gantt)[1]).toBe('136px');
    await userEvent.keyboard('{ArrowLeft}');
    expect(treeTracks(gantt)[1]).toBe('136px');

    // Alt+Left is the browser's Back; on Name it is held, so the page stays.
    within(gantt).getByRole('button', { name: /^Name/ }).focus();
    const back = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.activeElement?.dispatchEvent(back);
    expect(back.defaultPrevented).toBe(true);
    expect(
      JSON.parse(window.localStorage.getItem(ganttKey) ?? '{}').columnWidths,
    ).not.toHaveProperty('name');
  });

  it('#943 a column never narrows past the least width that keeps its header readable', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const handle = within(gantt).getByRole('separator', { name: 'Resize the Float column' });

    handle.focus();
    for (let step = 0; step < 20; step += 1) await userEvent.keyboard('{ArrowLeft}');
    // Float's least width is 72 px.
    expect(handle.getAttribute('aria-valuemin')).toBe('72');
    expect(handle.getAttribute('aria-valuenow')).toBe('72');
    expect(treeTracks(gantt)[2]).toBe('72px');
  });

  it('#943 a drag shows the column as it goes and keeps the width on release, and the Name column keeps its width so the edge follows the pointer', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const handle = within(gantt).getByRole('separator', { name: 'Resize the Deadline column' });

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400, button: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 440, buttons: 1 });
    expect(treeTracks(gantt)).toEqual(['215px', '168px', '96px']);
    expect(window.localStorage.getItem(ganttKey)).toBeNull();
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 440 });

    expect(treeTracks(gantt)).toEqual(['215px', '168px', '96px']);
    expect(JSON.parse(window.localStorage.getItem(ganttKey) ?? '{}')).toMatchObject({
      columnWidths: { deadline: 168 },
    });
  });

  it('#943 a drag that comes back to where it started is kept, and a drag cut short keeps nothing', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const handle = within(gantt).getByRole('separator', { name: 'Resize the Deadline column' });

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400, button: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 420, buttons: 1 });
    fireEvent.lostPointerCapture(handle, { pointerId: 1 });
    expect(treeTracks(gantt)[1]).toBe('128px');
    expect(window.localStorage.getItem(ganttKey)).toBeNull();

    fireEvent.pointerDown(handle, { pointerId: 2, clientX: 400, button: 0 });
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 405, buttons: 1 });
    fireEvent.pointerUp(handle, { pointerId: 2, clientX: 400 });
    expect(treeTracks(gantt)[1]).toBe('128px');
    expect(JSON.parse(window.localStorage.getItem(ganttKey) ?? '{}')).toMatchObject({
      columnWidths: { deadline: 128 },
    });
  });

  it('#943 a click on the handle shows Narrower and Wider buttons, the one-click alternative to the drag (WCAG 2.5.7), which change the column by 16 px and keep the width', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const handle = within(gantt).getByRole('separator', { name: 'Resize the Deadline column' });

    // A press that moves under 3 px, as a tap does, is a click.
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400, button: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 402, buttons: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 402 });
    expect(treeTracks(gantt)[1]).toBe('128px');
    const stepper = await within(gantt).findByRole('group', { name: 'Deadline column width' });
    const wider = within(stepper).getByRole('button', { name: 'Widen the Deadline column' });
    expect(document.activeElement).toBe(wider);

    await userEvent.click(wider);
    expect(treeTracks(gantt)[1]).toBe('144px');
    await userEvent.click(
      within(stepper).getByRole('button', { name: 'Narrow the Deadline column' }),
    );
    expect(treeTracks(gantt)[1]).toBe('128px');
    expect(JSON.parse(window.localStorage.getItem(ganttKey) ?? '{}')).toMatchObject({
      columnWidths: { deadline: 128 },
    });
  });

  it('#943 a press on a width button keeps focus where it is, as a browser that does not focus a clicked button would', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const handle = within(gantt).getByRole('separator', { name: 'Resize the Deadline column' });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400, button: 0 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 400 });
    const stepper = await within(gantt).findByRole('group', { name: 'Deadline column width' });

    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    within(stepper)
      .getByRole('button', { name: 'Narrow the Deadline column' })
      .dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
  });

  it('#943 at the least width Narrower shows it is unavailable and keeps its focus, and Escape closes the buttons and puts focus back on the handle', async () => {
    window.localStorage.setItem(ganttKey, JSON.stringify({ columnWidths: { deadline: 112 } }));
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const handle = within(gantt).getByRole('separator', { name: 'Resize the Deadline column' });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400, button: 0 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 400 });
    const stepper = await within(gantt).findByRole('group', { name: 'Deadline column width' });

    const narrower = within(stepper).getByRole('button', { name: 'Narrow the Deadline column' });
    expect(narrower.getAttribute('aria-disabled')).toBe('true');
    expect(narrower.className).toContain('aria-disabled:opacity-50');
    await userEvent.click(narrower);
    expect(treeTracks(gantt)[1]).toBe('112px');

    await userEvent.keyboard('{Escape}');
    expect(within(gantt).queryByRole('group', { name: 'Deadline column width' })).toBeNull();
    expect(document.activeElement).toBe(handle);
  });

  it('#943 focus leaving the width buttons closes them', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const handle = within(gantt).getByRole('separator', { name: 'Resize the Deadline column' });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400, button: 0 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 400 });
    await within(gantt).findByRole('group', { name: 'Deadline column width' });

    within(gantt).getByRole('button', { name: /^Name/ }).focus();
    await waitFor(() => {
      expect(within(gantt).queryByRole('group', { name: 'Deadline column width' })).toBeNull();
    });
  });

  it('#943 a drag whose release went elsewhere, seen as a move with no button, keeps nothing', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const handle = within(gantt).getByRole('separator', { name: 'Resize the Deadline column' });

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400, button: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 440, buttons: 1 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 460, buttons: 0 });

    expect(treeTracks(gantt)[1]).toBe('128px');
    expect(window.localStorage.getItem(ganttKey)).toBeNull();
  });

  it('#943 while the shown columns are narrower than the pane, the last one keeps its end border', async () => {
    window.localStorage.setItem(ganttKey, JSON.stringify({ columnWidths: { float: 72 } }));
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const name = within(gantt).getAllByRole('columnheader')[0] as HTMLElement;
    const columns = name.closest('[data-tree-pane]')?.firstElementChild as HTMLElement;
    expect(columns.className).not.toContain('[&>:last-child]:border-e-0');
    cleanup();
    window.localStorage.removeItem(ganttKey);

    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const fitted = (await findGantt()).querySelector('[data-tree-pane]')?.firstElementChild;
    expect(fitted?.className).toContain('[&>:last-child]:border-e-0');
  });

  it('#943 a kept width comes back on a new page within the column bounds, and a kept value that is no width is ignored', async () => {
    window.localStorage.setItem(
      ganttKey,
      JSON.stringify({ columnWidths: { deadline: 150, float: 2, name: 500 } }),
    );
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    // Too narrow a kept width takes the least; Name takes what the pane leaves of the default
    // widths, whatever is kept for it.
    expect(treeTracks(gantt)).toEqual(['215px', '150px', '72px']);
    cleanup();

    window.localStorage.setItem(ganttKey, JSON.stringify({ columnWidths: { deadline: 'wide' } }));
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    expect(treeTracks(await findGantt())[1]).toBe('128px');
  });
});

describe('resizing the machine column of the planning board (#943)', () => {
  it('#943 Alt+Left and Alt+Right anywhere in the board resize the machine column and keep the width, and the grid keeps its one Tab stop', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const header = within(board).getAllByRole('row')[0] as HTMLElement;

    const handle = within(board).getByRole('separator', { name: 'Resize the Machines column' });
    expect(handle.getAttribute('aria-valuenow')).toBe('200');
    // The board has one Tab stop (D3), so the handle is for the pointer.
    expect(handle.tabIndex).toBe(-1);
    const machine = within(board).getByRole('rowheader', { name: 'CNC 1' });
    machine.focus();
    await userEvent.keyboard('{Alt>}{ArrowRight}{ArrowRight}{/Alt}');

    expect(header.style.gridTemplateColumns.split(' ')[0]).toBe('216px');
    expect(JSON.parse(window.localStorage.getItem(boardKey) ?? '{}')).toEqual({ width: 216 });
    // The keys stay with the resize: focus stays on the machine.
    expect(document.activeElement).toBe(machine);

    // With the group collapsed no machine row is left; the group's button takes the keys.
    const group = within(board).getByRole('button', { name: /^Collapse / });
    await userEvent.click(group);
    group.focus();
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    expect(header.style.gridTemplateColumns.split(' ')[0]).toBe('208px');
  });

  it('#943 a drag of the machine column draws a line and resizes once, on release, and the width is kept', async () => {
    window.localStorage.setItem(boardKey, JSON.stringify({ width: 240 }));
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const header = within(board).getAllByRole('row')[0] as HTMLElement;
    expect(header.style.gridTemplateColumns.split(' ')[0]).toBe('240px');

    const handle = within(board).getByRole('separator', { name: 'Resize the Machines column' });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 300, button: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 200, buttons: 1 });
    expect(header.style.gridTemplateColumns.split(' ')[0]).toBe('240px');
    expect(board.querySelector('[data-column-resize-line]')).not.toBeNull();
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 200 });

    expect(header.style.gridTemplateColumns.split(' ')[0]).toBe('140px');
    expect(handle.getAttribute('aria-valuenow')).toBe('140');
    expect(JSON.parse(window.localStorage.getItem(boardKey) ?? '{}')).toEqual({ width: 140 });
    expect(board.querySelector('[data-column-resize-line]')).toBeNull();
  });
});
