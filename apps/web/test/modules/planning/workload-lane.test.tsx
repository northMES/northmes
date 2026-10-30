// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type GanttDataSource,
  type GanttOrder,
  type GanttSnapshot,
  g1DataSource,
} from '../../../src/modules/planning/gantt-data.ts';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { PlanningRefusal } from '../../../src/modules/planning/planning-preview.ts';
import { findGantt, renderGanttRoute, sourceOf } from './gantt-fixtures.tsx';

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.setItem(
    'northmes.planning.gantt.options',
    JSON.stringify({ workload: true }),
  );
});

afterEach(() => {
  window.localStorage.removeItem('northmes.planning.gantt.options');
});

/**
 * G1 with GT6's extra row (g1.expected.json, GT6_overload_definition): 1007.10 of 3 600 s on CNC2
 * at Thu 5 Nov 12:00 plant time, over the locked 1002.10, which loads CNC2 with 32 400 s against
 * 29 700 s available on that production day.
 */
function withGt6Row(snapshot: GanttSnapshot): GanttSnapshot {
  const template = snapshot.productionOrders.find((order) => order.number === '1002');
  const row = template?.jobOrders[0];
  if (template === undefined || row === undefined) throw new Error('G1 has 1002.10');
  const startMs = Date.UTC(2026, 10, 5, 11);
  const endMs = startMs + 3_600_000;
  const order: GanttOrder = {
    ...template,
    id: 'po-1007',
    number: '1007',
    jobOrders: [
      {
        ...row,
        id: 'jo-1007-10',
        orderId: 'po-1007',
        displayNumber: '1007.10',
        status: 'planned',
        plannedSetupS: 0,
        plannedRunS: 3600,
        placement: {
          setupStartMs: startMs,
          runStartMs: startMs,
          endMs,
          segments: [{ fromMs: startMs, toMs: endMs }],
        },
      },
    ],
  };
  return { ...snapshot, productionOrders: [...snapshot.productionOrders, order] };
}

describe('the workload lane (plan 18, The workload lane)', () => {
  it('ADR0089 shows a bucket that touches a time chunk still loading as loading, never as a partial sum', async () => {
    const never = new Promise<never>(() => {});
    const source: GanttDataSource = {
      ...g1DataSource,
      loadChunk: (from, to, filter, options) =>
        from.startsWith('2026-11-01T23')
          ? never
          : g1DataSource.loadChunk(from, to, filter, options),
    };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, source);
    // The chunk keeps loading, so the grid is found without waiting for its chunks.
    await screen.findByRole('treegrid', { name: /order Gantt/ });

    const lane = screen
      .getByRole('region', { name: 'Workload' })
      .querySelector('[data-lane="CNC1"]');
    await waitFor(() =>
      expect(lane?.querySelector('[data-bucket="2026-11-05"]')?.getAttribute('data-pending')).toBe(
        'loading',
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Workload on CNC 1' }));
    const table = within(screen.getByRole('dialog')).getByRole('table');
    const thursday = within(table).getByRole('rowheader', { name: 'Thu 5 Nov' }).closest('tr');
    expect(thursday?.textContent).toBe('Thu 5 Novloading');
    const total = within(table).getByRole('rowheader', { name: 'Visible range' }).closest('tr');
    expect(total?.textContent).toBe('Visible rangeloading');
  });

  it('ADR0089 the lanes scroll with the time area, both ways, so a lane stays under its time', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const lanes = screen.getByRole('region', { name: 'Workload' }).querySelector('[data-lane]')
      ?.parentElement?.parentElement as HTMLElement;

    // The view opens one viewport width into the time buffer.
    expect(gantt.scrollLeft).toBeGreaterThan(0);
    expect(lanes.scrollLeft).toBe(gantt.scrollLeft);

    gantt.scrollLeft += 120;
    fireEvent.scroll(gantt);
    expect(lanes.scrollLeft).toBe(gantt.scrollLeft);

    lanes.scrollLeft -= 50;
    fireEvent.scroll(lanes);
    expect(gantt.scrollLeft).toBe(lanes.scrollLeft);
  });

  it('ADR0089 names a bucket that touches a refused time chunk with the refusal, in the bucket and in the range', async () => {
    const source: GanttDataSource = {
      ...g1DataSource,
      loadChunk: async (from, to, filter, options) => {
        if (from.startsWith('2026-11-01T23')) {
          throw new PlanningRefusal('planning.board.range_too_large');
        }
        return g1DataSource.loadChunk(from, to, filter, options);
      },
    };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, source);
    await screen.findByRole('treegrid', { name: /order Gantt/ });
    await waitFor(() =>
      expect(document.querySelector('[data-chunk-band="refused"]')).not.toBeNull(),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Workload on CNC 1' }));
    const table = within(screen.getByRole('dialog')).getByRole('table');
    const thursday = within(table).getByRole('rowheader', { name: 'Thu 5 Nov' }).closest('tr');
    expect(thursday?.textContent).toBe('Thu 5 Novtoo many job orders');
    const total = within(table).getByRole('rowheader', { name: 'Visible range' }).closest('tr');
    expect(total?.textContent).toBe('Visible rangetoo many job orders');
  });

  it('GT5 shows a lane per machine, aria-hidden, under the time area when the option is on', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    await findGantt();

    const panel = screen.getByRole('region', { name: 'Workload' });
    expect(
      within(panel)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Workload on CNC 1', 'Workload on CNC 2', 'Workload on Mill 1']);
    const lane = panel.querySelector('[data-lane="CNC1"]');
    expect(lane?.getAttribute('aria-hidden')).toBe('true');
  });

  it('GT5 draws the bar of Thu 5 Nov on CNC1 at full height, the setup part hatched', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    await findGantt();

    const lane = screen
      .getByRole('region', { name: 'Workload' })
      .querySelector('[data-lane="CNC1"]');
    const thursday = lane?.querySelector<HTMLElement>('[data-bucket="2026-11-05"]');
    // A full bucket takes the bar's 75 percent of the lane; the rest is headroom for an overload.
    expect(thursday?.style.height).toBe('75%');
    expect(thursday?.getAttribute('data-full')).toBe('true');
    expect(thursday?.querySelector('[data-setup]')).not.toBeNull();
    const tuesday = lane?.querySelector<HTMLElement>('[data-bucket="2026-11-03"]');
    expect(Number.parseFloat(tuesday?.style.height ?? '0')).toBeCloseTo(42.42 * 0.75, 1);
    expect(lane?.querySelector<HTMLElement>('[data-bucket="2026-11-02"]')?.style.height).toBe('0%');
  });

  it('GT6 draws the overload of CNC2 on Thu 5 Nov above the bar, inside the lane', async () => {
    // GT6: a row of 3 600 s at Thu 12:00 over the locked 1002.10 gives 32 400 s loaded against
    // 29 700 s available on CNC2 and 2 700 s of overload.
    const overloaded = withGt6Row(g1Snapshot());
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, sourceOf(overloaded));
    await findGantt();

    const lane = screen
      .getByRole('region', { name: 'Workload' })
      .querySelector('[data-lane="CNC2"]');
    const thursday = lane?.querySelector<HTMLElement>('[data-bucket="2026-11-05"]');
    expect(thursday?.getAttribute('data-overloaded')).toBe('true');
    // The bar takes the 75 percent of the lane a full bucket takes; the overload sits above it in
    // the headroom, 2 700 of 29 700 s as a share of the bar's height, so it stays inside the lane.
    expect(thursday?.style.height).toBe('75%');
    const overload = thursday?.querySelector<HTMLElement>('[data-overload]');
    expect(Number.parseFloat(overload?.style.height ?? '0')).toBeCloseTo(
      (2700 / 29700) * 0.75 * 2.5,
      3,
    );
    expect(Number.parseFloat(overload?.style.height ?? '0')).toBeLessThanOrEqual(0.25 * 2.5);
  });

  it("GT5 opening a second lane's table mounts it anew and moves focus to it", async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    await findGantt();

    await userEvent.click(screen.getByRole('button', { name: 'Workload on CNC 1' }));
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Workload on CNC 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Workload on CNC 2' }));

    const second = screen.getByRole('dialog', { name: 'Workload on CNC 2' });
    expect(screen.queryByRole('dialog', { name: 'Workload on CNC 1' })).toBeNull();
    expect(document.activeElement).toBe(second);
    expect(
      screen.getByRole('button', { name: 'Workload on CNC 1' }).getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('GT5 names a closed production day in view closed in the text table, with no load', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-06' });
    await findGantt();
    // With closed time shown, the view from Fri 6 Nov holds the Saturday.
    await userEvent.click(screen.getByRole('button', { name: 'Hide closed time' }));
    await userEvent.click(screen.getByRole('button', { name: 'Workload on CNC 1' }));

    const table = within(screen.getByRole('dialog', { name: 'Workload on CNC 1' })).getByRole(
      'table',
      { name: 'Workload on CNC 1' },
    );
    const saturday = within(table).getByRole('rowheader', { name: 'Sat 7 Nov' }).closest('tr');

    expect(
      Array.from(saturday?.querySelectorAll('th, td') ?? []).map((cell) => cell.textContent),
    ).toEqual(['Sat 7 Nov', '0 min', '0 min', '0 min', '0 min', '0 min', 'closed', '0 min']);
  });

  it('GT5 the lane header button opens the text table: the production days that start in view and the visible range, with the GT5 values of Thu 5 Nov and the range', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    await findGantt();

    const button = screen.getByRole('button', { name: 'Workload on CNC 1' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(button);

    const dialog = screen.getByRole('dialog', { name: 'Workload on CNC 1' });
    expect(document.activeElement).toBe(dialog);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const table = within(dialog).getByRole('table', { name: 'Workload on CNC 1' });
    const rows = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => Array.from(row.querySelectorAll('th, td')).map((cell) => cell.textContent));
    // The view starts at Mon 2 Nov 00:00 and holds about 41 open hours at Week with closed time
    // hidden, so the days that start in it are Mon 2 Nov to Fri 6 Nov (ADR 0089); the GT5 values
    // of g1.expected.json are compared whole in gantt-analysis.test.ts.
    expect(rows.map((row) => row[0])).toEqual([
      'Mon 2 Nov',
      'Tue 3 Nov',
      'Wed 4 Nov',
      'Thu 5 Nov',
      'Fri 6 Nov',
      'Visible range',
    ]);
    expect(rows[5]).toEqual([
      'Visible range',
      '41 h 15 min',
      '20 h',
      '1 h',
      '19 h',
      '21 h 15 min',
      '48 %',
      '0 min',
    ]);
    expect(rows[3]).toEqual([
      'Thu 5 Nov',
      '8 h 15 min',
      '8 h 15 min',
      '30 min',
      '7 h 45 min',
      '0 min',
      '100 %',
      '0 min',
    ]);

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('#901 the heading names the bucket and the plan the panel shows', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    await findGantt();

    expect(
      within(screen.getByRole('region', { name: 'Workload' })).getByRole('heading').textContent,
    ).toBe('Workload by production day, the plan with my draft');
  });

  it('#901 at Day zoom the lanes and the table hold one bucket per shift', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    await findGantt();
    const panel = screen.getByRole('region', { name: 'Workload' });
    expect(within(panel).getByRole('heading').textContent).toBe(
      'Workload by shift, the plan with my draft',
    );
    expect(
      panel.querySelector('[data-lane="CNC1"] [data-bucket="2026-11-05 06:00 to 15:00"]'),
    ).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Workload on CNC 1' }));

    const table = within(screen.getByRole('dialog')).getByRole('table');
    expect(within(table).getAllByRole('columnheader')[0]?.textContent).toBe('Shift');
    expect(within(table).getByRole('rowheader', { name: 'Thu 5 Nov 06:00 to 15:00' })).toBeTruthy();
  });

  it('#901 at 4 weeks zoom the table holds one bucket per ISO week', async () => {
    renderGanttRoute({ zoom: '4weeks', from: '2026-11-02' });
    await findGantt();

    await userEvent.click(screen.getByRole('button', { name: 'Workload on CNC 1' }));

    const table = within(screen.getByRole('dialog')).getByRole('table');
    expect(within(table).getAllByRole('columnheader')[0]?.textContent).toBe('ISO week');
    expect(within(table).getByRole('rowheader', { name: 'W45, Mon 2 Nov' })).toBeTruthy();
  });

  it('#901 during a drag the buckets of the machines it touches show the preview, an overloaded bucket draws thicker, and Escape restores them', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const lane = () =>
      screen.getByRole('region', { name: 'Workload' }).querySelector('[data-lane="CNC1"]');
    const thursday = () => lane()?.querySelector<HTMLElement>('[data-bucket="2026-11-05"]');
    const wednesday = () => lane()?.querySelector<HTMLElement>('[data-bucket="2026-11-04"]');
    expect(thursday()?.getAttribute('data-overloaded')).toBeNull();
    const fullWednesday = Number.parseFloat(wednesday()?.style.height ?? '0');
    // 1003.10 starts Wed 08:00 and 1004.10 Thu 06:00, both on CNC1: dragging the first to where
    // the second starts loads CNC1 above its Thursday's availability.
    const block = (id: string) => gantt.querySelector<HTMLElement>(`[data-block="${id}"]`);
    const leftOf = (id: string) => Number.parseFloat(block(id)?.style.left ?? '0');
    const dx = leftOf('jo-1004-10') - leftOf('jo-1003-10');
    const dragged = block('jo-1003-10');
    if (dragged === null) throw new Error('No block 1003.10');
    const pointer = { pointerId: 1, button: 0, isPrimary: true, clientY: 10 };
    fireEvent.pointerDown(dragged, { ...pointer, clientX: 100 });
    fireEvent.pointerMove(dragged, { ...pointer, clientX: 100 + dx / 2 });
    fireEvent.pointerMove(dragged, { ...pointer, clientX: 100 + dx });

    await waitFor(() => expect(thursday()?.getAttribute('data-overloaded')).toBe('true'));
    expect(Number.parseFloat(wednesday()?.style.height ?? '0')).toBeLessThan(fullWednesday);
    // Overloaded, the bar takes the bucket's whole width; a bar within its availability, on a
    // bucket of the same width, is narrower.
    expect(Number.parseFloat(thursday()?.style.width ?? '0')).toBeGreaterThan(
      Number.parseFloat(wednesday()?.style.width ?? '0'),
    );

    fireEvent.keyDown(dragged, { key: 'Escape' });
    await waitFor(() => expect(thursday()?.getAttribute('data-overloaded')).toBeNull());
  });

  it('#901 the table says an overloaded bucket is over capacity in words', async () => {
    const overloaded = withGt6Row(g1Snapshot());
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, sourceOf(overloaded));
    await findGantt();

    await userEvent.click(screen.getByRole('button', { name: 'Workload on CNC 2' }));

    const row = within(screen.getByRole('dialog'))
      .getByRole('rowheader', { name: 'Thu 5 Nov' })
      .closest('tr');
    expect(row?.textContent).toContain('109 %, over capacity');
  });
});
