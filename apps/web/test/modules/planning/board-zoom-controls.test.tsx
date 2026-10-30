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

describe('the zoom of the planning board (ADR 0089, Zoom levels)', () => {
  it('#896 shares the Gantt zoom: Zoom in, the level menu, and plus and minus on a block step a level', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    const board = await findBoard();
    const zoom = screen.getByRole('group', { name: 'Zoom' });

    await userEvent.click(within(zoom).getByRole('button', { name: 'Zoom in' }));
    await waitFor(() => expect(router.state.location.search.zoom).toBe('day'));
    await userEvent.click(within(zoom).getByRole('button', { name: 'Zoom level, Day' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Week' }));
    await waitFor(() => expect(router.state.location.search.zoom).toBe('week'));

    (board.querySelector('[data-board-focus]') as HTMLElement).focus();
    await userEvent.keyboard('-');
    await waitFor(() => expect(router.state.location.search.zoom).toBe('4weeks'));
    await userEvent.keyboard('+');
    await waitFor(() => expect(router.state.location.search.zoom).toBe('week'));
  });

  it('#896 Zoom to fit with nothing selected fits every loaded job order, and says so', async () => {
    const router = renderGanttRoute({ zoom: 'hours', from: '2026-11-04' }, undefined, 'board');
    const board = await findBoard();
    Object.defineProperty(board, 'clientWidth', { value: 1400, configurable: true });

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Zoom' })).getByRole('button', {
        name: 'Zoom to fit',
      }),
    );

    // G1 runs from Tue 3 Nov 11:30 to Tue 10 Nov 15:00, a week and a day: 4 weeks holds it.
    await waitFor(() => expect(router.state.location.search.zoom).toBe('4weeks'));
    await waitFor(() =>
      expect(document.getElementById(politeRegionId)?.textContent).toBe(
        'Zoomed to fit every loaded job order, zoom level 4 weeks',
      ),
    );
  });
});
