// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  boardSearch,
  fromAt,
  ganttSearch,
  startOfFrom,
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

  it('reads every level of the zoom ladder from zoom, and drops an unknown one (ADR 0089)', () => {
    for (const zoom of ['quarter-hours', 'hours', 'day', 'week', '4weeks', 'quarter', 'year']) {
      expect(ganttSearch({ zoom })).toEqual({ zoom });
      expect(boardSearch({ zoom })).toEqual({ zoom });
    }
    expect(ganttSearch({ zoom: 'decade' })).toEqual({});
  });

  it('ADR0089 reads from as a plant date or as the plant-local date-time of the visible start, without an offset', () => {
    expect(ganttSearch({ from: '2026-11-03T13:20' })).toEqual({ from: '2026-11-03T13:20' });
    expect(boardSearch({ from: '2026-11-03T13:20' })).toEqual({ from: '2026-11-03T13:20' });
    expect(ganttSearch({ from: '2026-11-03T25:20' })).toEqual({});
    expect(ganttSearch({ from: '2026-11-03T13:20:00Z' })).toEqual({});
    expect(ganttSearch({ from: '2026-11-03T13:20Z' })).toEqual({});
    expect(ganttSearch({ from: '2026-11-03T13:20+01:00' })).toEqual({});
  });

  it('ADR0089 opens a plain date at the start of that day, its production day at the levels that span hours, and a date-time at that plant time', () => {
    const zone = 'Europe/Stockholm';
    expect(startOfFrom('2026-11-04', 'week', zone, '06:00')).toBe(
      Date.parse('2026-11-03T23:00:00Z'),
    );
    expect(startOfFrom('2026-11-04', 'day', zone, '06:00')).toBe(
      Date.parse('2026-11-04T05:00:00Z'),
    );
    // Not the Monday of its ISO week, nor the first of its month.
    expect(startOfFrom('2026-11-04', '4weeks', zone, '06:00')).toBe(
      Date.parse('2026-11-03T23:00:00Z'),
    );
    expect(startOfFrom('2026-11-04', 'year', zone, '06:00')).toBe(
      Date.parse('2026-11-03T23:00:00Z'),
    );
    expect(startOfFrom('2026-11-03T13:20', 'day', zone, '06:00')).toBe(
      Date.parse('2026-11-03T12:20:00Z'),
    );
    expect(fromAt(Date.parse('2026-11-03T12:20:40Z'), zone)).toBe('2026-11-03T13:20');
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
    // The grid names the span in view, which starts at Mon 2 Nov (ADR 0089, The endless axis).
    expect(gantt.getAttribute('aria-label')).toMatch(/^plant-a order Gantt, W45, Mon 2 Nov to /);
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

    const board = await screen.findByRole('grid', { name: /^plant-a board, / });
    // The skeleton has the same role and name; the loaded grid holds the job orders.
    await waitFor(() =>
      expect(board.ownerDocument.querySelector('[data-job-order]')).not.toBeNull(),
    );
    expect(screen.queryByRole('group', { name: 'View' })).toBeNull();
    expect(screen.queryByRole('treegrid')).toBeNull();
  });

  it('ADR0089 opens an unknown zoom at Week, and names the level of the URL', async () => {
    const level = () =>
      within(screen.getByRole('group', { name: 'Zoom' })).getByRole('button', {
        name: /^Zoom level, /,
      }).textContent;
    renderGanttRoute({ zoom: 'decade', from: '2026-11-02' });
    await findGantt();
    expect(level()).toBe('Week');
    cleanup();

    renderGanttRoute({ zoom: 'quarter', from: '2026-11-01' });
    await findGantt();
    expect(level()).toBe('Quarter');
  });

  it('opens the Gantt at Week zoom from the fixture week when the URL names no zoom and no date', async () => {
    const router = renderGanttRoute({});

    const gantt = await findGantt();
    // The grid names the span in view, which starts at Mon 2 Nov (ADR 0089, The endless axis).
    expect(gantt.getAttribute('aria-label')).toMatch(/^plant-a order Gantt, W45, Mon 2 Nov to /);
    expect(router.state.location.search).toEqual({});
    expect(
      within(screen.getByRole('group', { name: 'Zoom' })).getByRole('button', {
        name: 'Zoom level, Week',
      }),
    ).toBeTruthy();
  });
});
