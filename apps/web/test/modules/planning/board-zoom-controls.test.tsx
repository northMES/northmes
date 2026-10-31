// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { politeRegionId } from '../../../src/ui/lib/announce.ts';
import { renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The board grid, once it has loaded: while it loads, the grid's skeleton is busy. */
async function findBoard(): Promise<HTMLElement> {
  return waitFor(() => {
    const board = screen.getByRole('grid', { name: /board/ });
    if (board.getAttribute('aria-busy') === 'true') throw new Error('The board is loading');
    return board;
  });
}

describe('the zoom of the planning board (ADR 0090, Gestures, buttons and keys)', () => {
  it('#941 shares the Gantt zoom: Zoom in, the level menu, and plus and minus on a block zoom by a factor of 2', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const zoom = screen.getByRole('group', { name: 'Zoom' });

    await userEvent.click(within(zoom).getByRole('button', { name: 'Zoom in' }));
    await waitFor(() => expect(router.state.location.search.zoom).toBe(32));
    await userEvent.click(within(zoom).getByRole('button', { name: 'Zoom level, Day' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Week' }));
    await waitFor(() => expect(router.state.location.search.zoom).toBeUndefined());

    (board.querySelector('[data-board-focus]') as HTMLElement).focus();
    await userEvent.keyboard('-');
    await waitFor(() => expect(router.state.location.search.zoom).toBe(8));
    await userEvent.keyboard('+');
    await waitFor(() => expect(router.state.location.search.zoom).toBeUndefined());
  });

  it("#941 Ctrl+wheel over the board's time area zooms continuously and keeps the page from zooming", async () => {
    const router = renderGanttRoute({ from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const event = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      ctrlKey: { value: true },
      clientX: { value: 1000 },
      deltaMode: { value: 0 },
    });

    board.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    // exp(0.2) of 16 is 19.5 px an hour.
    await waitFor(() => expect(router.state.location.search.zoom).toBe(19.5));
  });

  it('#941 Zoom to fit with nothing selected fits every loaded job order, and says so', async () => {
    const router = renderGanttRoute({ zoom: 'hours', from: '2026-11-04' }, undefined, 'board');
    const board = await findBoard();
    Object.defineProperty(board, 'clientWidth', { value: 1400, configurable: true });

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Zoom' })).getByRole('button', {
        name: 'Zoom to fit',
      }),
    );

    // G1 runs from Tue 3 Nov 11:30 to Tue 10 Nov 15:00, a week and a day: the 4 weeks band holds it.
    await waitFor(() =>
      expect(document.getElementById(politeRegionId)?.textContent).toBe(
        'Zoomed to fit every loaded job order. Zoom: 4 weeks',
      ),
    );
    const fitted = router.state.location.search.zoom as number;
    expect(fitted).toBeGreaterThan(1.34);
    expect(fitted).toBeLessThan(6.93);
  });
});
