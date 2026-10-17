// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { type GanttFixture, g1, g1Expected } from '@northmes/planning-domain';
import { cleanup, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { findGantt, renderGanttRoute, sourceOf } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The link groups drawn in the overlay, by their from-to id. */
function linkIds(gantt: HTMLElement): string[] {
  return Array.from(gantt.querySelectorAll('[data-link]')).map(
    (link) => link.getAttribute('data-link') ?? '',
  );
}

/**
 * G1 after the GT3 move with cascade off: 1003.10 moved to Wed 09:00 to 13:30, 1003.20 left at
 * Wed 12:45, so it starts 45 minutes before its release.
 */
function g1AfterGt3(): GanttFixture {
  const moved = g1Expected.GT3_cascade_1003.moved['1003.10'];
  if (moved === undefined) throw new Error('GT3 has no moved 1003.10');
  return {
    ...g1,
    productionOrders: g1.productionOrders.map((order) =>
      order.number !== '1003'
        ? order
        : {
            ...order,
            jobOrders: order.jobOrders.map((row) =>
              row.productionOrderOperation !== '1003.10'
                ? row
                : {
                    ...row,
                    setupStartAt: moved.start.instant,
                    runStartAt: moved.start.instant,
                    endAt: moved.end.instant,
                  },
            ),
          },
    ),
  } as GanttFixture;
}

/** G1 after the GT3 move, its segments laid over the calendar by the source. */
function gt3Snapshot() {
  return g1Snapshot(g1AfterGt3());
}

/** G1 with its orders cloned until the visible links exceed the limit. */
function manyOrdersSnapshot(copies: number) {
  const orders = Array.from({ length: copies }, (_, index) =>
    g1.productionOrders.map((order) => ({
      ...order,
      number: `${order.number}-${index}`,
      jobOrders: order.jobOrders.map((row) => ({ ...row, id: `${row.id}-${index}` })),
    })),
  ).flat();
  return g1Snapshot({ ...g1, productionOrders: orders } as GanttFixture);
}

describe('the links of the order Gantt (plan 18, Blocks, links and the selection)', () => {
  it('GT1 draws a link for every expanded order, the lead time of 1001.20 as a dashed segment', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    expect(linkIds(gantt)).toEqual(
      expect.arrayContaining([
        'jo-1001-10-jo-1001-20',
        'jo-1003-10-jo-1003-20',
        'jo-1004-10-jo-1004-20',
      ]),
    );
    expect(linkIds(gantt)).toHaveLength(3);
    const lead = gantt.querySelector('[data-link="jo-1001-10-jo-1001-20"] [data-lead]');
    expect(lead?.getAttribute('stroke-dasharray')).toBe('4 3');
    expect(gantt.querySelector('[data-link="jo-1003-10-jo-1003-20"] [data-lead]')).toBeNull();
    expect(gantt.querySelectorAll('[data-broken]')).toHaveLength(0);
  });

  it('GT1 drops the links of a collapsed order', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await userEvent.click(within(gantt).getByRole('button', { name: 'Collapse order 1001' }));

    expect(linkIds(gantt)).not.toContain('jo-1001-10-jo-1001-20');
    expect(linkIds(gantt)).toHaveLength(2);
  });

  it('GT3 draws the link of a row that starts before its release in the conflict style and names it', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' }, sourceOf(gt3Snapshot()));
    const gantt = await findGantt();

    const link = gantt.querySelector('[data-link="jo-1003-10-jo-1003-20"]');
    expect(link?.getAttribute('data-broken')).toBe('true');
    expect(link?.querySelector('[data-striped-head]')).not.toBeNull();
    expect(gantt.querySelector('[data-block="jo-1003-20"]')?.getAttribute('aria-label')).toContain(
      'starts 45 minutes before its release from 1003.10',
    );
    expect(gantt.querySelector('[data-block="jo-1003-20"]')?.getAttribute('data-states')).toContain(
      'conflict',
    );
  });

  it("GT1 above 200 links draws the selected order's links only and the toolbar says so", async () => {
    renderGanttRoute(
      { view: 'gantt', zoom: 'week', from: '2026-11-02', order: 'po-1001-3' },
      sourceOf(manyOrdersSnapshot(70)),
    );
    const gantt = await findGantt();

    expect(linkIds(gantt)).toEqual(['jo-1001-10-3-jo-1001-20-3']);
    expect(screen.getByTestId('gantt-status').textContent).toContain(
      'Links shown for the selected order.',
    );
  });
});
