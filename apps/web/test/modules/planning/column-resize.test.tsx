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
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    expect(within(gantt).queryByRole('separator', { name: 'Resize the Name column' })).toBeNull();
    const deadline = within(gantt).getByRole('separator', { name: 'Resize the Deadline column' });
    expect(deadline.getAttribute('aria-orientation')).toBe('vertical');
    expect(deadline.getAttribute('aria-valuenow')).toBe('128');
    expect(deadline.tabIndex).toBe(0);
    // The handle sits in its own header, so focus on it scrolls that header into the pane.
    expect(deadline.closest('[role="columnheader"]')?.textContent).toContain('Deadline');
    expect(within(gantt).getByRole('separator', { name: 'Resize the Float column' })).toBeTruthy();
  });

  it('#943 Left and Right on the handle and Alt+Left and Alt+Right on the sort button narrow and widen the column by 8 px, and the width stays in this browser', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const handle = within(gantt).getByRole('separator', { name: 'Resize the Deadline column' });

    handle.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(handle.getAttribute('aria-valuenow')).toBe('136');
    expect(treeTracks(gantt)[1]).toBe('136px');

    within(gantt)
      .getByRole('button', { name: /^Deadline/ })
      .focus();
    await userEvent.keyboard('{Alt>}{ArrowLeft}{ArrowLeft}{/Alt}');
    expect(treeTracks(gantt)[1]).toBe('120px');
    expect(JSON.parse(window.localStorage.getItem(ganttKey) ?? '{}')).toMatchObject({
      columnWidths: { deadline: 120 },
    });
    // A plain arrow on the sort button resizes nothing.
    await userEvent.keyboard('{ArrowLeft}');
    expect(treeTracks(gantt)[1]).toBe('120px');
  });

  it('#943 a column never narrows past the least width that keeps its header readable', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const handle = within(gantt).getByRole('separator', { name: 'Resize the Float column' });

    handle.focus();
    for (let step = 0; step < 20; step += 1) await userEvent.keyboard('{ArrowLeft}');
    const least = handle.getAttribute('aria-valuemin');
    expect(handle.getAttribute('aria-valuenow')).toBe(least);
    expect(treeTracks(gantt)[2]).toBe(`${least}px`);
    expect(Number(least)).toBeGreaterThanOrEqual(56);
  });

  it('#943 the handle follows the pointer and the width is kept on release', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const handle = within(gantt).getByRole('separator', { name: 'Resize the Deadline column' });

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400, button: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 440, buttons: 1 });
    expect(treeTracks(gantt)[1]).toBe('168px');
    expect(window.localStorage.getItem(ganttKey)).toBeNull();
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 440 });

    expect(treeTracks(gantt)[1]).toBe('168px');
    expect(JSON.parse(window.localStorage.getItem(ganttKey) ?? '{}')).toMatchObject({
      columnWidths: { deadline: 168 },
    });
  });

  it('#943 a kept width comes back on a new page, within the column bounds', async () => {
    window.localStorage.setItem(
      ganttKey,
      JSON.stringify({ columnWidths: { deadline: 150, float: 2, name: 500, other: 'wide' } }),
    );
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const tracks = treeTracks(gantt);
    expect(tracks[1]).toBe('150px');
    // Too narrow a kept width takes the least; Name always takes what the pane leaves.
    const float = within(gantt).getByRole('separator', { name: 'Resize the Float column' });
    expect(tracks[2]).toBe(`${float.getAttribute('aria-valuemin')}px`);
    expect(tracks[0]).not.toBe('500px');
  });
});

describe('resizing the machine column of the planning board (#943)', () => {
  it('#943 the machine column resizes by the keys on its header handle and keeps the width', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const header = within(board).getAllByRole('row')[0] as HTMLElement;

    const handle = within(board).getByRole('separator', { name: 'Resize the Machines column' });
    expect(handle.getAttribute('aria-valuenow')).toBe('200');
    handle.focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');

    expect(header.style.gridTemplateColumns.split(' ')[0]).toBe('216px');
    expect(JSON.parse(window.localStorage.getItem(boardKey) ?? '{}')).toEqual({ width: 216 });
    // The keys stay with the handle: the board's own arrow keys do not move focus away.
    expect(document.activeElement).toBe(handle);
  });

  it('#943 the machine column follows the pointer and a kept width comes back', async () => {
    window.localStorage.setItem(boardKey, JSON.stringify({ width: 240 }));
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const header = within(board).getAllByRole('row')[0] as HTMLElement;
    expect(header.style.gridTemplateColumns.split(' ')[0]).toBe('240px');

    const handle = within(board).getByRole('separator', { name: 'Resize the Machines column' });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 300, button: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 200, buttons: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 200 });

    expect(header.style.gridTemplateColumns.split(' ')[0]).toBe('140px');
    expect(handle.getAttribute('aria-valuenow')).toBe('140');
  });
});
