// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  boardSearch,
  withChain,
  withOrder,
  withView,
} from '../../../src/modules/planning/gantt-search.ts';
import { politeRegionId } from '../../../src/ui/lib/announce.ts';
import { findGantt, renderBoardRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

describe('boardSearch (plan 18, URL state)', () => {
  it('reads view, zoom, from, order and chain, and drops the board default and a key that does not apply', () => {
    expect(
      boardSearch({ view: 'gantt', zoom: 'week', from: '2026-11-02', order: 'po-1003', chain: 1 }),
    ).toEqual({ view: 'gantt', zoom: 'week', from: '2026-11-02', order: 'po-1003', chain: 1 });
    expect(boardSearch({ view: 'board', zoom: 'week' })).toEqual({ zoom: 'week' });
    expect(boardSearch({ view: 'bogus', zoom: 'minutes', from: '2026-13-40', chain: '2' })).toEqual(
      {},
    );
    expect(boardSearch({ order: 1003, chain: '1' })).toEqual({ order: '1003', chain: 1 });
  });

  it('keeps zoom, from and order across a view change and ends the chain with the order', () => {
    const gantt = boardSearch({
      view: 'gantt',
      zoom: 'week',
      from: '2026-11-02',
      order: 'po-1003',
      chain: 1,
    });

    expect(withView(gantt, 'board')).toEqual({
      zoom: 'week',
      from: '2026-11-02',
      order: 'po-1003',
      chain: 1,
    });
    expect(withView(gantt, 'table')).toMatchObject({ view: 'table', zoom: 'week' });
    expect(withOrder(gantt, 'po-1001')).toEqual({
      view: 'gantt',
      zoom: 'week',
      from: '2026-11-02',
      order: 'po-1001',
    });
    expect(withOrder(gantt, undefined)).toEqual({
      view: 'gantt',
      zoom: 'week',
      from: '2026-11-02',
    });
    expect(withChain(withOrder(gantt, undefined), true)).toEqual({
      view: 'gantt',
      zoom: 'week',
      from: '2026-11-02',
    });
    expect(withChain(withChain(gantt, false), true)).toEqual(gantt);
  });
});

describe('the board route with view=gantt (plan 18, URL state)', () => {
  it('GT2 ?view=gantt&zoom=week&from=2026-11-02&order=<id>&chain=1 opens the Gantt on week 45 with the order selected', async () => {
    const router = renderBoardRoute({
      view: 'gantt',
      zoom: 'week',
      from: '2026-11-02',
      order: 'po-1003',
      chain: 1,
    });

    const gantt = await findGantt();
    expect(gantt.getAttribute('aria-label')).toBe(
      'plant-a order Gantt, W45, Mon 2 Nov to Sun 8 Nov',
    );
    const row = within(gantt).getByRole('row', { name: /^1003 / });
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(
      within(gantt)
        .getByRole('row', { name: /^1001 / })
        .getAttribute('aria-selected'),
    ).toBe('false');
    expect(router.state.location.search).toEqual({
      view: 'gantt',
      zoom: 'week',
      from: '2026-11-02',
      order: 'po-1003',
      chain: 1,
    });
    expect(screen.getByText('Showing fixture G1.')).toBeTruthy();
  });

  it('ADR0062 chain=1 without order is dropped with the polite status message', async () => {
    const router = renderBoardRoute({ view: 'gantt', zoom: 'week', from: '2026-11-02', chain: 1 });

    await findGantt();
    await waitFor(() => {
      expect(router.state.location.search).toEqual({
        view: 'gantt',
        zoom: 'week',
        from: '2026-11-02',
      });
    });
    await waitFor(() => {
      expect(document.getElementById(politeRegionId)?.textContent).toBe(
        'This link had 1 setting that no longer applies, so it was ignored.',
      );
    });
  });

  it('switching to view=board keeps zoom, from and order', async () => {
    const router = renderBoardRoute({
      view: 'gantt',
      zoom: 'week',
      from: '2026-11-02',
      order: 'po-1003',
    });
    await findGantt();

    await userEvent.click(
      within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'Board' }),
    );

    await waitFor(() => {
      expect(router.state.location.search).toEqual({
        zoom: 'week',
        from: '2026-11-02',
        order: 'po-1003',
      });
    });
    expect(await screen.findByText('No production orders yet')).toBeTruthy();
    expect(screen.queryByRole('treegrid')).toBeNull();
  });

  it('opens the Gantt at Week zoom from the fixture week when the URL names no zoom and no date', async () => {
    const router = renderBoardRoute({ view: 'gantt' });

    const gantt = await findGantt();
    expect(gantt.getAttribute('aria-label')).toBe(
      'plant-a order Gantt, W45, Mon 2 Nov to Sun 8 Nov',
    );
    expect(router.state.location.search).toEqual({ view: 'gantt' });
    expect(
      screen.getByRole('group', { name: 'Zoom' }).querySelector('[aria-pressed="true"]')
        ?.textContent,
    ).toBe('Week');
  });
});
