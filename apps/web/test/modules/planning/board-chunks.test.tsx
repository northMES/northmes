// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { type GanttDataSource, g1DataSource } from '../../../src/modules/planning/gantt-data.ts';
import { PlanningRefusal } from '../../../src/modules/planning/planning-preview.ts';
import { renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

describe('ADR0089 the time chunks of the planning board (Loading by time chunk, M-104)', () => {
  it('ADR0089 a chunk the source refuses with planning.board.range_too_large shows the band that says to narrow the filter or zoom in, and says so politely', async () => {
    const refusingW45: GanttDataSource = {
      ...g1DataSource,
      loadChunk: async (from, to, filter, options) => {
        if (from.startsWith('2026-11-01T23')) {
          throw new PlanningRefusal('planning.board.range_too_large');
        }
        return g1DataSource.loadChunk(from, to, filter, options);
      },
    };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, refusingW45, 'board');

    const band = await waitFor(() => {
      const found = document.querySelector('[data-chunk-band="refused"][data-chunk="2026-W45"]');
      if (found === null) throw new Error('No refused band');
      return found;
    });
    expect(band.textContent).toBe('Too many job orders: narrow the filter or zoom in');
    expect(document.querySelector('[data-chunk-status]')?.textContent).toBe(
      'W45, Mon 2 Nov to Sun 8 Nov holds more job orders than the view shows at once: narrow the filter or zoom in.',
    );
    // The refused week draws no blocks, so it never reads as a week without job orders.
    expect(document.querySelector('[data-job-order="1003.10"]')).toBeNull();
  });

  it('ADR0089 a machine without blocks says its job orders are loading while a chunk of the buffer loads, not that it has none', async () => {
    renderGanttRoute(
      { zoom: 'week', from: '2026-11-16', preview: 'chunks-loading' },
      undefined,
      'board',
    );

    await waitFor(() =>
      expect(
        screen.getAllByRole('gridcell', { name: 'Loading job orders' }).length,
      ).toBeGreaterThan(0),
    );
    expect(screen.queryByRole('gridcell', { name: 'No jobs in this range' })).toBeNull();
  });

  it('ADR0089 a row list the source refuses as too many orders shows its error state, not a skeleton', async () => {
    const refusing: GanttDataSource = {
      ...g1DataSource,
      loadRows: async () => {
        throw new PlanningRefusal('planning.gantt.too_many_orders');
      },
    };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, refusing, 'board');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Too many orders for the board' }),
    ).toBeTruthy();
    expect(screen.getByText('More than 1,250 orders match. Narrow the filter.')).toBeTruthy();
  });

  it('ADR0089 a later page of the row list that fails says so with Try again, and the board stays busy until every page is in', async () => {
    let failing = true;
    const failingLater: GanttDataSource = {
      ...g1DataSource,
      loadRows: async (filter, page, options) => {
        if (failing && 'first' in page && page.after !== undefined) {
          throw new Error('The plan server did not answer');
        }
        // Two pages of three orders each.
        return g1DataSource.loadRows(filter, { ...page, first: 3 }, options);
      },
    };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, failingLater, 'board');

    await waitFor(() =>
      expect(document.querySelector('[data-rows-status]')?.textContent).toBe(
        'Orders could not be loaded: 3 of 6 loaded.',
      ),
    );
    // The second page's orders are not drawn until it loads.
    expect(document.querySelector('[data-job-order="1006.10"]')).toBeNull();
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again: orders' }));
    await waitFor(() => expect(document.querySelector('[data-rows-status]')).toBeNull());
    await waitFor(() =>
      expect(document.querySelector('[data-job-order="1006.10"]')).not.toBeNull(),
    );
  });

  it('ADR0089 the range-too-large preview refuses every chunk on mock data', async () => {
    renderGanttRoute(
      { zoom: 'week', from: '2026-11-02', preview: 'range-too-large' },
      undefined,
      'board',
    );

    await waitFor(() =>
      expect(document.querySelectorAll('[data-chunk-band="refused"]').length).toBeGreaterThan(0),
    );
    expect(
      [...document.querySelectorAll('[data-chunk-band]')].every(
        (band) => band.getAttribute('data-chunk-band') === 'refused',
      ),
    ).toBe(true);
  });
});
