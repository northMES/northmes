// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { type GanttFixture, g1 } from '@northmes/planning-domain';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type GanttDataSource,
  type GanttPageRequest,
  snapshotSource,
} from '../../../src/modules/planning/gantt-data.ts';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { PlanningRefusal } from '../../../src/modules/planning/planning-preview.ts';
import { findGantt, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** G1's orders copied until there are a number of them, each copy with its own numbers and ids. */
function ordersSnapshot(count: number) {
  const copies = Math.ceil(count / g1.productionOrders.length);
  const orders = Array.from({ length: copies }, (_, index) =>
    g1.productionOrders.map((order) => ({
      ...order,
      number: `${order.number}-${index}`,
      jobOrders: order.jobOrders.map((row) => ({ ...row, id: `${row.id}-${index}` })),
    })),
  )
    .flat()
    .slice(0, count);
  return g1Snapshot({ ...g1, productionOrders: orders } as GanttFixture);
}

/** A source over a snapshot that counts its page loads and fails the pages the test names. */
function countingRows(
  count: number,
  fail: (page: GanttPageRequest) => Error | undefined = () => undefined,
) {
  const snapshot = ordersSnapshot(count);
  const base = snapshotSource(async () => snapshot);
  const pages: GanttPageRequest[] = [];
  const source: GanttDataSource = {
    ...base,
    loadRows: async (filter, page, options) => {
      pages.push(page);
      const error = fail(page);
      if (error !== undefined) throw error;
      return base.loadRows(filter, page, options);
    },
  };
  return { source, pages };
}

/** The order rows drawn, which a collapsed tree shows alone. */
const orderRows = (gantt: HTMLElement) => gantt.querySelectorAll('[data-row-kind="order"]').length;

/** Gives the grid a view whose bottom lies within a view of the rows' end, as near the end. */
function nearTheEnd(gantt: HTMLElement) {
  for (const [key, value] of Object.entries({ clientHeight: 600, scrollHeight: 900 })) {
    Object.defineProperty(gantt, key, { value, configurable: true });
  }
  fireEvent.scroll(gantt);
}

describe('ADR0089 the row list of the order Gantt by page (M-101)', () => {
  it('ADR0089 loads the first page of 100 orders of 500, says how many are loaded, and loads the next as the view nears the end', async () => {
    const { source, pages } = countingRows(500);
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, source);
    const gantt = await findGantt();

    await waitFor(() => expect(orderRows(gantt)).toBe(100));
    expect(pages).toHaveLength(1);
    expect(gantt.getAttribute('aria-rowcount')).toBe('-1');
    expect(gantt.querySelector('[data-more-rows]')?.textContent).toBe(
      '100 of 500 orders loaded. Scroll down for more.',
    );

    nearTheEnd(gantt);

    await waitFor(() => expect(orderRows(gantt)).toBeGreaterThanOrEqual(200));
    expect(pages[1]).toEqual({ first: 100, after: '99' });
  }, 60_000);

  it('ADR0089 shows a page that fails as an error row with Try again, and loads it again', async () => {
    let failing = true;
    const { source } = countingRows(150, (page) =>
      failing && 'first' in page && page.after !== undefined
        ? new Error('The plan server did not answer')
        : undefined,
    );
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, source);
    const gantt = await findGantt();
    await waitFor(() => expect(orderRows(gantt)).toBe(100));

    nearTheEnd(gantt);
    await waitFor(() =>
      expect(gantt.querySelector('[data-more-rows="failed"]')?.textContent).toContain(
        'Orders could not be loaded: 100 of 150 loaded.',
      ),
    );

    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again: orders' }));
    await waitFor(() => expect(orderRows(gantt)).toBe(150));
    expect(gantt.querySelector('[data-more-rows]')).toBeNull();
    expect(gantt.getAttribute('aria-rowcount')).not.toBe('-1');
  }, 60_000);

  it('ADR0089 says to narrow the filter when the row list holds more orders than the Gantt shows', async () => {
    const { source, pages } = countingRows(
      10,
      () => new PlanningRefusal('planning.gantt.too_many_orders'),
    );
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, source);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Too many orders for the Gantt' }),
    ).toBeTruthy();
    expect(screen.getByText('More than 1,250 orders match. Narrow the filter.')).toBeTruthy();
    const asked = pages.length;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(pages.length).toBe(asked + 1));
  });
});
