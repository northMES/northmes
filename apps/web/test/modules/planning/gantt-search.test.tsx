// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  boardSearch,
  ganttSearch,
  withChain,
  withOrder,
} from '../../../src/modules/planning/gantt-search.ts';
import { politeRegionId } from '../../../src/ui/lib/announce.ts';
import { findGantt, plant, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

describe('ganttSearch (plan 18, URL state)', () => {
  it('reads zoom, from, order and chain, and drops a key that does not apply', () => {
    expect(ganttSearch({ zoom: 'week', from: '2026-11-02', order: 'po-1003', chain: 1 })).toEqual({
      zoom: 'week',
      from: '2026-11-02',
      order: 'po-1003',
      chain: 1,
    });
    expect(ganttSearch({ zoom: 'minutes', from: '2026-13-40', chain: '2', view: 'gantt' })).toEqual(
      {},
    );
    expect(ganttSearch({ order: 1003, chain: '1' })).toEqual({ order: '1003', chain: 1 });
  });

  it('ends the chain with the order and keeps it only with one', () => {
    const gantt = ganttSearch({ zoom: 'week', from: '2026-11-02', order: 'po-1003', chain: 1 });

    expect(withOrder(gantt, 'po-1001')).toEqual({
      zoom: 'week',
      from: '2026-11-02',
      order: 'po-1001',
    });
    expect(withOrder(gantt, undefined)).toEqual({ zoom: 'week', from: '2026-11-02' });
    expect(withChain(withOrder(gantt, undefined), true)).toEqual({
      zoom: 'week',
      from: '2026-11-02',
    });
    expect(withChain(withChain(gantt, false), true)).toEqual(gantt);
  });

  it('keeps view=gantt on the board route for the redirect and drops any other view', () => {
    expect(boardSearch({ view: 'gantt', zoom: 'week', order: 'po-1003' })).toEqual({
      view: 'gantt',
      zoom: 'week',
      order: 'po-1003',
    });
    expect(boardSearch({ view: 'table', zoom: 'week' })).toEqual({ zoom: 'week' });
    expect(boardSearch({ view: 'board' })).toEqual({});
  });
});

describe('the Gantt page (plan 18, URL state)', () => {
  it('GT2 ?zoom=week&from=2026-11-02&order=<id>&chain=1 opens the Gantt on week 45 with the order selected and its chain on', async () => {
    const router = renderGanttRoute({
      zoom: 'week',
      from: '2026-11-02',
      order: 'po-1003',
      chain: 1,
    });

    const gantt = await findGantt();
    expect(gantt.getAttribute('aria-label')).toBe(
      'plant-a order Gantt, W45, Mon 2 Nov to Sun 8 Nov',
    );
    // The chain opens the order's Details, a modal drawer, so the rows are read as hidden.
    const row = within(gantt).getByRole('row', { name: /^1003 /, hidden: true });
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(
      within(gantt)
        .getByRole('row', { name: /^1001 /, hidden: true })
        .getAttribute('aria-selected'),
    ).toBe('false');
    expect(router.state.location.search).toEqual({
      zoom: 'week',
      from: '2026-11-02',
      order: 'po-1003',
      chain: 1,
    });
    expect(screen.getByText('Showing fixture G1.')).toBeTruthy();
    await waitFor(() => {
      expect(document.getElementById(politeRegionId)?.textContent).toBe(
        'Critical chain of 1003 shown, 3 rows, root 1001.10 on CNC1',
      );
    });
    expect(gantt.querySelector('[data-block="jo-1003-10"]')?.getAttribute('data-states')).toContain(
      'chain',
    );
  });

  it('ADR0062 chain=1 without order is dropped with the polite status message', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02', chain: 1 });

    await findGantt();
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ zoom: 'week', from: '2026-11-02' });
    });
    await waitFor(() => {
      expect(document.getElementById(politeRegionId)?.textContent).toBe(
        'This link had 1 setting that no longer applies, so it was ignored.',
      );
    });
  });

  it('a board link with view=gantt from before the Gantt page redirects to it with zoom, from and order', async () => {
    const router = renderGanttRoute(
      { view: 'gantt', zoom: 'week', from: '2026-11-02', order: 'po-1003' },
      undefined,
      'board',
    );

    await findGantt();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(planningLinks.gantt({ plant }).href);
    });
    expect(router.state.location.search).toEqual({
      zoom: 'week',
      from: '2026-11-02',
      order: 'po-1003',
    });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Gantt');
  });

  it('the board route without view=gantt shows the planning board and no view control', async () => {
    renderGanttRoute({ zoom: 'week' }, undefined, 'board');

    expect(await screen.findByRole('grid', { name: /^plant-a board, / })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'View' })).toBeNull();
    expect(screen.queryByRole('treegrid')).toBeNull();
  });

  it('opens the Gantt at Week zoom from the fixture week when the URL names no zoom and no date', async () => {
    const router = renderGanttRoute({});

    const gantt = await findGantt();
    expect(gantt.getAttribute('aria-label')).toBe(
      'plant-a order Gantt, W45, Mon 2 Nov to Sun 8 Nov',
    );
    expect(router.state.location.search).toEqual({});
    expect(
      screen.getByRole('group', { name: 'Zoom' }).querySelector('[aria-pressed="true"]')
        ?.textContent,
    ).toBe('Week');
  });
});
