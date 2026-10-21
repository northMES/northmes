// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createEnteredOrdersStore } from '../../../src/modules/planning/entered-orders-store.ts';
import { findGantt, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

const created = { createdAtMs: Date.parse('2026-11-02T08:45:00Z'), createdBy: 'Alex Lund' };

/** A store with N-1007 for Hub 12, supplying line 2 of 40211, and customer order 40231. */
function entered() {
  const store = createEnteredOrdersStore();
  store.addProductionOrder({
    number: 'N-1007',
    article: 'Hub 12',
    quantity: 250,
    deadlineDate: '2026-11-20',
    priority: null,
    color: 'palette-8',
    suppliedLines: ['40211-2'],
    ...created,
  });
  store.addCustomerOrder({
    number: '40231',
    customerCode: 'K-1211',
    customersReference: 'LM-2026-140',
    lines: [{ line: 1, article: 'Shaft 8', quantity: 200, wantedDate: '2026-11-25', supply: null }],
    ...created,
  });
  return store;
}

/** The values of an attribute on the page's rows that carry it, in their order. */
function rowsBy(attribute: string): string[] {
  return Array.from(document.querySelectorAll(`[${attribute}]`)).map(
    (row) => row.getAttribute(attribute) ?? '',
  );
}

describe('orders entered by hand on the plan pages (#768, NG1)', () => {
  it('NG1 the Gantt lists the job orders of a new released order under Not placed', async () => {
    renderGanttRoute(
      { zoom: 'week', from: '2026-11-02' },
      undefined,
      'gantt',
      undefined,
      undefined,
      entered(),
    );
    const gantt = await findGantt();

    const notPlaced = within(gantt).getByRole('row', { name: /Not placed/ });
    expect(notPlaced.textContent).toContain('N-1007.10');
    expect(notPlaced.textContent).toContain('N-1007.20');
  });

  it('the production orders list holds the new order, and the customer orders list the new lines and the new supply', async () => {
    renderGanttRoute({}, undefined, 'orders', undefined, undefined, entered());
    await waitFor(() => expect(rowsBy('data-order')).toContain('N-1007'));
    cleanup();

    renderGanttRoute({}, undefined, 'customerOrders', undefined, undefined, entered());
    await waitFor(() => expect(rowsBy('data-line')).toContain('40231-1'));
    const supplied = document.querySelector('[data-line="40211-2"]')?.closest('tr');
    expect(supplied?.textContent).toContain('N-1007');
    expect(screen.getAllByText('Lindqvist Maskin AB').length).toBeGreaterThan(0);
  });
});
