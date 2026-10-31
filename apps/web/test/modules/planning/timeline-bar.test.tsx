// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findGantt, measureGridsAt, renderGanttRoute } from './gantt-fixtures.tsx';

// The slim bar above the timeline and the zoom buttons over the time area (ADR 0090, The bar above
// the timeline; #939), on the order Gantt and the planning board.

beforeEach(() => measureGridsAt(1400));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.removeItem('northmes.planning.gantt.options');
});

/** The board grid, once it has loaded: while it loads, the grid's skeleton is busy. */
async function findBoard(): Promise<HTMLElement> {
  return waitFor(() => {
    const board = screen.getByRole('grid', { name: /board/ });
    if (board.getAttribute('aria-busy') === 'true') throw new Error('The board is loading');
    return board;
  });
}

/** The controls that leave the board and the Gantt (ADR 0090). */
function expectNoRangeControls() {
  expect(screen.queryByRole('button', { name: 'Show earlier range' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Show later range' })).toBeNull();
  expect(screen.queryByLabelText('Go to date')).toBeNull();
  expect(screen.queryByRole('button', { name: /^Zoom level, / })).toBeNull();
  expect(document.querySelector('[data-range-text]')).toBeNull();
}

describe('the slim bar above the order Gantt (ADR 0090)', () => {
  it('#939 holds Go to now and one View menu on the title row, and no range controls; My draft shows only with changes', async () => {
    renderGanttRoute({ from: '2026-11-02' });
    await findGantt();
    const bar = screen.getByRole('toolbar', { name: 'Gantt' });

    expect(within(bar).getByRole('button', { name: 'Go to now' })).toBeTruthy();
    expect(within(bar).getByRole('button', { name: 'View' })).toBeTruthy();
    expect(within(bar).queryByRole('button', { name: /^My draft/ })).toBeNull();
    expectNoRangeControls();
    // The page title and the bar share one row.
    const heading = screen.getByRole('heading', { level: 1, name: 'Gantt' });
    expect(heading.parentElement?.contains(bar)).toBe(true);
  });

  it('#939 the View menu holds the columns, Hide closed time, Workload, Cascade and the tree pane widths, from the keyboard', async () => {
    renderGanttRoute({ from: '2026-11-02' });
    await findGantt();
    const view = screen.getByRole('button', { name: 'View' });
    view.focus();

    await userEvent.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    const names = within(menu)
      .getAllByRole('menuitemcheckbox')
      .map((item) => item.textContent?.replace('Always shown', '').trim());

    expect(names).toEqual(expect.arrayContaining(['Hide closed time', 'Workload', 'Cascade']));
    expect(within(menu).getByRole('group', { name: 'Columns' })).toBeTruthy();
    expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map((item) => item.textContent),
    ).toEqual(['Narrow tree pane', 'Medium tree pane', 'Wide tree pane']);
    const hide = within(menu).getByRole('menuitemcheckbox', { name: 'Hide closed time' });
    expect(hide.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(hide);
    await waitFor(() => expect(hide.getAttribute('aria-checked')).toBe('false'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(view));
  });

  it('#939 Zoom out, Zoom in and Zoom to fit sit over the time area, outside the grid and after it, and keep focus', async () => {
    const router = renderGanttRoute({ from: '2026-11-02' });
    const gantt = await findGantt();
    const zoom = screen.getByRole('group', { name: 'Zoom' });

    expect(gantt.contains(zoom)).toBe(false);
    expect(gantt.compareDocumentPosition(zoom) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('toolbar', { name: 'Gantt' }).contains(zoom)).toBe(false);
    // The time scroller keeps a focused block clear of the buttons (WCAG 2.4.11).
    expect(gantt.style.scrollPaddingBottom).not.toBe('');
    expect(gantt.style.scrollPaddingInlineEnd).not.toBe('');

    const zoomIn = within(zoom).getByRole('button', { name: 'Zoom in' });
    await userEvent.click(zoomIn);
    await waitFor(() => expect(router.state.location.search.zoom).toBe(32));
    expect(document.activeElement).toBe(zoomIn);
    expect(within(zoom).getByRole('button', { name: 'Zoom to fit' })).toBeTruthy();
  });

  it('#939 Go to now keeps the zoom and puts now at the centre of the view', async () => {
    const router = renderGanttRoute({ from: '2026-11-09' });
    await findGantt();

    await userEvent.click(screen.getByRole('button', { name: 'Go to now' }));

    // G1's now is Mon 2 Nov 09:40; the view starts half a view before it.
    await waitFor(() => expect(router.state.location.search.from).toMatch(/^2026-10-2\dT/));
    expect('zoom' in router.state.location.search).toBe(false);
  });

  it('#939 Alt+Page Down scrolls one viewport width later and keeps focus on the row; Alt+Page Up scrolls back', async () => {
    const router = renderGanttRoute({ from: '2026-11-02T00:00' });
    const gantt = await findGantt();
    const row = gantt.querySelector<HTMLElement>('[data-row-id="po-1003"]') as HTMLElement;
    row.focus();

    fireEvent.keyDown(row, { key: 'PageDown', altKey: true });

    // The view is 840 px of time at 16 px an hour, 52.5 h, with closed time hidden more.
    await waitFor(() => expect(router.state.location.search.from).toMatch(/^2026-11-0[4-9]T/));
    expect(document.activeElement).toBe(gantt.querySelector('[data-row-id="po-1003"]'));

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'PageUp', altKey: true });
    // Back on Mon 2 Nov: the night before 06:00 is hidden closed time, so the open time starts at 06:00.
    await waitFor(() => expect(router.state.location.search.from).toBe('2026-11-02T06:00'));
  });

  it('#939 Alt+Page Down on a block moves focus to the row when the block leaves the view', async () => {
    renderGanttRoute({ from: '2026-11-02T00:00' });
    const gantt = await findGantt();
    const block = gantt.querySelector<HTMLElement>('[data-block="jo-1001-10"]') as HTMLElement;
    block.focus();

    fireEvent.keyDown(block, { key: 'PageDown', altKey: true });

    await waitFor(() =>
      expect(document.activeElement?.getAttribute('data-row-id')).toBe('jo-1001-10'),
    );
  });

  it('#939 My draft goes when the drawer closes with no changes left, and focus moves to the bar', async () => {
    window.localStorage.setItem(
      'northmes.planning.gantt.options',
      JSON.stringify({ cascade: false }),
    );
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    (gantt.querySelector('[data-row-id="jo-1003-10"]') as HTMLElement).focus();
    await userEvent.keyboard('{ArrowRight}m{ArrowRight}{Enter}');
    await userEvent.click(await screen.findByRole('button', { name: 'My draft, 1 change' }));
    const drawer = await screen.findByRole('dialog', { name: /My draft/ });

    await userEvent.click(within(drawer).getByRole('button', { name: 'Discard draft' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard 1 change' }));
    await waitFor(() => expect(within(drawer).getByText('No changes in your draft')).toBeTruthy());
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /My draft/ })).toBeNull());
    expect(screen.queryByRole('button', { name: /^My draft/ })).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Go to now' })),
    );
  });
});

describe('the slim bar above the planning board (ADR 0090)', () => {
  it('#939 holds Go to now on the title row, no View menu and no range controls, and the zoom buttons over the time area', async () => {
    renderGanttRoute({ from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const bar = screen.getByRole('toolbar', { name: 'Board' });

    expect(within(bar).getByRole('button', { name: 'Go to now' })).toBeTruthy();
    expect(within(bar).queryByRole('button', { name: 'View' })).toBeNull();
    expect(within(bar).queryByRole('button', { name: /^My draft/ })).toBeNull();
    expectNoRangeControls();
    expect(screen.getByRole('heading', { level: 1 }).parentElement?.contains(bar)).toBe(true);
    const zoom = screen.getByRole('group', { name: 'Zoom' });
    expect(board.contains(zoom)).toBe(false);
    expect(board.compareDocumentPosition(zoom) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(board.style.scrollPaddingBottom).not.toBe('');
  });

  it('#939 Alt+Page Down on a job order scrolls one viewport width later and moves focus to the row', async () => {
    const router = renderGanttRoute({ from: '2026-11-02T00:00' }, undefined, 'board');
    const board = await findBoard();
    const block = board.querySelector<HTMLElement>('[data-job-order="1001.10"]') as HTMLElement;
    const machineRow = block.closest('[role="row"]');
    block.focus();

    fireEvent.keyDown(block, { key: 'PageDown', altKey: true });

    await waitFor(() => expect(router.state.location.search.from).toMatch(/^2026-11-0[4-9]T/));
    // Focus stays in the same machine row: on a job order in view, or on the row header.
    await waitFor(() => {
      const focused = document.activeElement as HTMLElement;
      expect(focused.getAttribute('data-board-focus')).not.toBe(
        block.getAttribute('data-board-focus'),
      );
      expect(focused.closest('[role="row"]')).toBe(machineRow);
    });
  });
});
