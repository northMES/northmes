// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, onTestFinished } from 'vitest';
import {
  boardSearch,
  fromAt,
  ganttSearch,
  startOfFrom,
  withChain,
  withOrder,
  withZoom,
} from '../../../src/modules/planning/gantt-search.ts';
import { politeRegionId } from '../../../src/ui/lib/announce.ts';
import { findGantt, plant, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

describe('ganttSearch (plan 18, URL state)', () => {
  it('reads zoom, from, order and chain, and drops a key that does not apply', () => {
    expect(ganttSearch({ zoom: 'week', from: '2026-11-02', order: 'po-1003', chain: 1 })).toEqual({
      zoom: 16,
      from: '2026-11-02',
      order: 'po-1003',
      chain: 1,
    });
    expect(ganttSearch({ zoom: 'minutes', from: '2026-13-40', chain: '2', view: 'gantt' })).toEqual(
      {},
    );
    expect(ganttSearch({ order: 1003, chain: '1' })).toEqual({ order: '1003', chain: 1 });
  });

  it('#941 reads zoom as a width per hour, a level id at its natural width, clamped, and drops anything else (ADR 0090)', () => {
    const cases = [
      [37.5, 37.5],
      ['37.5', 37.5],
      ['week', 16],
      ['day', 48],
      ['quarter-hours', 240],
      ['year', 0.15],
      [1000, 240],
      ['0.01', 0.15],
      [37.5432, 37.5],
      // A number outside the range is clamped to it (ADR 0090).
      [0, 0.15],
      [-3, 0.15],
      ['-3', 0.15],
    ] as const;
    for (const [zoom, expected] of cases) {
      expect(ganttSearch({ zoom }), String(zoom)).toEqual({ zoom: expected });
      expect(boardSearch({ zoom }), String(zoom)).toEqual({ zoom: expected });
    }
    for (const zoom of ['abc', 'decade', Number.NaN, '']) {
      expect(ganttSearch({ zoom }), String(zoom)).toEqual({});
    }
  });

  it('#941 leaves the default zoom, 16, out of the URL', () => {
    expect(withZoom({ from: '2026-11-02' }, 32)).toEqual({ zoom: 32, from: '2026-11-02' });
    expect(withZoom({ zoom: 32, from: '2026-11-02' }, 16)).toEqual({ from: '2026-11-02' });
    expect(withZoom({}, 23.94)).toEqual({ zoom: 23.9 });
    // 16.004 is 16 to three significant digits, so the key stays out.
    expect(withZoom({ zoom: 32 }, 16.004)).toEqual({});
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
      zoom: 16,
      from: '2026-11-02',
      order: 'po-1001',
    });
    expect(withOrder(gantt, undefined)).toEqual({ zoom: 16, from: '2026-11-02' });
    expect(withChain(withOrder(gantt, undefined), true)).toEqual({
      zoom: 16,
      from: '2026-11-02',
    });
    expect(withChain(withChain(gantt, false), true)).toEqual(gantt);
  });

  it('#950 drops any view on the board route, view=gantt included', () => {
    expect(boardSearch({ view: 'gantt', zoom: 'week', order: 'po-1003' })).toEqual({
      zoom: 16,
      order: 'po-1003',
    });
    expect(boardSearch({ view: 'table', zoom: 'week' })).toEqual({ zoom: 16 });
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
      zoom: 16,
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
      expect(router.state.location.search).toEqual({ zoom: 16, from: '2026-11-02' });
    });
    await waitFor(() => {
      expect(document.getElementById(politeRegionId)?.textContent).toBe(
        'This link had 1 setting that no longer applies, so it was ignored.',
      );
    });
  });

  it('#950 a board link with view=gantt stays on the planning board, with its job orders and no view control', async () => {
    const router = renderGanttRoute({ view: 'gantt', zoom: 'week' }, undefined, 'board');

    const board = await screen.findByRole('grid', { name: /^plant-a board, / });
    // The skeleton has the same role and name; the loaded grid holds the job orders.
    await waitFor(() =>
      expect(board.ownerDocument.querySelector('[data-job-order]')).not.toBeNull(),
    );
    expect(router.state.location.pathname).toBe(planningLinks.board({ plant }).href);
    expect(screen.queryByRole('group', { name: 'View' })).toBeNull();
    expect(screen.queryByRole('treegrid')).toBeNull();
  });

  it('#941 opens a zoom at its width per hour in its band: 37.5 in Day, 26 in Week, abc at 16, a level id at its natural width and 1000 at the clamp', async () => {
    const level = () => screen.getByRole('group', { name: 'Zoom' }).getAttribute('data-zoom-band');
    /** The drawn width of job order 1001.10. */
    const blockWidth = (gantt: HTMLElement) =>
      Number.parseFloat(
        (gantt.querySelector('[data-block="jo-1001-10"]') as HTMLElement).style.width,
      );
    // The first case, an unknown value at the default 16, measures the block the others scale.
    const cases = [
      ['abc', 'week', 16],
      [37.5, 'day', 37.5],
      [26, 'week', 26],
      // Just under the Week to Day edge at about 27.713, as a gesture that ended at 27.72 writes it.
      [27.7, 'week', 27.7],
      ['day', 'day', 48],
      ['quarter', 'quarter', 0.6],
      [1000, 'quarter-hours', 240],
    ] as const;
    let atDefault = 0;
    // With closed time shown, a block's width is its hours at the width per hour.
    window.localStorage.setItem(
      'northmes.planning.gantt.options',
      JSON.stringify({ hideClosed: false }),
    );
    onTestFinished(() => window.localStorage.removeItem('northmes.planning.gantt.options'));
    for (const [zoom, band, width] of cases) {
      renderGanttRoute({ zoom, from: '2026-11-02' });
      const gantt = await findGantt();
      expect(level(), String(zoom)).toBe(band);
      if (zoom === 'abc') atDefault = blockWidth(gantt);
      else if (width >= 16) {
        expect((blockWidth(gantt) / atDefault) * 16, String(zoom)).toBeCloseTo(width, 1);
      }
      cleanup();
    }
  });

  it('opens the Gantt at Week zoom from the fixture week when the URL names no zoom and no date', async () => {
    const router = renderGanttRoute({});

    const gantt = await findGantt();
    // The grid names the span in view, which starts at Mon 2 Nov (ADR 0089, The endless axis).
    expect(gantt.getAttribute('aria-label')).toMatch(/^plant-a order Gantt, W45, Mon 2 Nov to /);
    expect(router.state.location.search).toEqual({});
    expect(screen.getByRole('group', { name: 'Zoom' }).getAttribute('data-zoom-band')).toBe('week');
  });
});
