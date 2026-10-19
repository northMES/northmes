// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { createReason } from '../../../src/modules/planning/mock-reasons.ts';
import { renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

const snapshot = g1Snapshot();

/** The order numbers of the table's rows, in their order. */
function orderRows(): string[] {
  return Array.from(document.querySelectorAll('[data-order]')).map(
    (row) => row.getAttribute('data-order') ?? '',
  );
}

/** The ids of the customer order line rows, in their order. */
function lineRows(): string[] {
  return Array.from(document.querySelectorAll('[data-line]')).map(
    (row) => row.getAttribute('data-line') ?? '',
  );
}

/** A filter menu's button, apart from a sort header of the same name. */
function filterButton(label: string): HTMLElement {
  const button = screen
    .getAllByRole('button', { name: label })
    .find((each) => each.getAttribute('aria-haspopup') === 'menu');
  if (button === undefined) throw new Error(`No ${label} filter menu`);
  return button;
}

/** The status line above a list. */
function statusLine(): string {
  return document.querySelector('[data-list-status]')?.textContent ?? '';
}

/** The table row of an order or a line, found through the data attribute its first cell carries. */
function rowOf(attribute: 'data-order' | 'data-line', value: string): HTMLElement {
  const row = document.querySelector<HTMLElement>(`[${attribute}="${value}"]`)?.closest('tr');
  if (row === null || row === undefined) throw new Error(`No row ${value}`);
  return row;
}

describe('the production orders list (plan 07; design #687, PL1 to PL3)', () => {
  const orderCount = snapshot.productionOrders.length;

  it('PL1 lists the orders by deadline, then priority, with their customers, status and the planning actions', async () => {
    renderGanttRoute({}, undefined, 'orders');
    const table = await screen.findByRole('table', { name: 'Production orders' });

    expect(orderRows()).toEqual(['1003', '1002', '1001', '1004', '1005', '1006']);
    expect(statusLine()).toBe(
      `${orderCount} production orders, 1 late. Sorted by deadline, then priority.`,
    );
    expect(screen.getByText('ERP data as of Mon 2 Nov 06:40')).toBeTruthy();
    expect(screen.getByText('Showing fixture G1.')).toBeTruthy();
    expect(
      within(table).getByRole('columnheader', { name: 'Deadline' }).getAttribute('aria-sort'),
    ).toBe('ascending');
    const row1001 = rowOf('data-order', '1001');
    expect(row1001.textContent).toContain('Hallberg Verkstad AB, Svea Komponent AB');
    expect(row1001.textContent).toContain('Thu 5 Nov 10:45');
    expect(within(row1001).getByRole('link', { name: '1001' }).getAttribute('href')).toBe(
      '/plant-a/planning/orders/po-1001',
    );
    expect(within(row1001).getByRole('link', { name: 'Open on Gantt' }).getAttribute('href')).toBe(
      '/plant-a/planning/gantt?zoom=week&from=2026-11-03&order=po-1001',
    );
    expect(rowOf('data-order', '1004').textContent).toContain('Stock order');
    expect(rowOf('data-order', '1003').textContent).toContain('Late 15 h 15 min');
    expect(screen.getByRole('button', { name: 'New order' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(createReason)).toBeTruthy();

    await userEvent.click(within(row1001).getByRole('button', { name: 'Actions for order 1001' }));
    expect(screen.getByRole('menuitem', { name: 'Open order' }).getAttribute('href')).toBe(
      '/plant-a/planning/orders/po-1001',
    );
    expect(screen.getByRole('menuitem', { name: 'Show on board' }).getAttribute('href')).toBe(
      '/plant-a/planning/board?zoom=week&from=2026-11-03&order=po-1001',
    );
  });

  it('PL1 Late only, a filter with its chip, Clear filters and the search live in the URL', async () => {
    const router = renderGanttRoute({}, undefined, 'orders');
    await screen.findByRole('table', { name: 'Production orders' });

    await userEvent.click(screen.getByRole('checkbox', { name: 'Late only' }));
    await waitFor(() => expect(orderRows()).toEqual(['1003']));
    expect(router.state.location.search).toEqual({ late: 1 });
    expect(statusLine()).toBe(
      '1 production order, 1 late, late only. Sorted by deadline, then priority.',
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'Late only' }));
    await waitFor(() => expect(orderRows()).toHaveLength(orderCount));

    await userEvent.click(filterButton('Article'));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /^Bracket L/ }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(orderRows()).toContain('1001'));
    expect(orderRows().every((number) => ['1001', '1005'].includes(number))).toBe(true);
    expect(router.state.location.search).toEqual({ article: 'Bracket L' });
    expect(screen.getByText('Article:')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Article, 1 selected' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(orderRows()).toHaveLength(orderCount));
    expect(router.state.location.search).toEqual({});

    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search production orders' }),
      'Hub',
    );
    await waitFor(() => expect(orderRows()).toEqual(['1004']));
    expect(router.state.location.search).toEqual({ q: 'Hub' });
  });

  it('PL3 Group by article groups the rows under headers with their counts and quantities, and a group collapses', async () => {
    const router = renderGanttRoute({}, undefined, 'orders');
    await screen.findByRole('table', { name: 'Production orders' });

    await userEvent.click(screen.getByRole('button', { name: 'Group by' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Article' }));

    const group = await screen.findByRole('button', { name: /^Bracket L/ });
    expect(group.textContent).toMatch(/^Bracket L ?[12] orders?, (600|1200) pcs$/);
    expect(router.state.location.search).toEqual({ group: 'article' });
    expect(screen.getByRole('button', { name: 'Group by: Article' })).toBeTruthy();
    expect(statusLine()).toContain('groups sorted by article');

    await userEvent.click(group);
    await waitFor(() => expect(orderRows()).not.toContain('1001'));
    expect(group.getAttribute('aria-expanded')).toBe('false');
  });

  it('PL1 a sortable header sorts the rows and goes to the URL', async () => {
    const router = renderGanttRoute({}, undefined, 'orders');
    const table = await screen.findByRole('table', { name: 'Production orders' });

    await userEvent.click(within(table).getByRole('button', { name: 'Order' }));

    await waitFor(() => expect(orderRows().slice(0, 4)).toEqual(['1001', '1002', '1003', '1004']));
    expect(router.state.location.search).toEqual({ sort: 'order' });
    expect(statusLine()).toContain('Sorted by order, ascending.');
  });

  it('LI3 a picked value that no row has keeps its name in the chip and its checked item in the menu', async () => {
    // Hallberg Verkstad AB orders nothing late, so Late only leaves no row with the picked customer.
    renderGanttRoute({ customer: 'K-1042', late: 1 }, undefined, 'orders');
    await screen.findByRole('heading', {
      level: 2,
      name: 'No production orders match these filters',
    });

    expect(screen.getByText('Customer:').parentElement?.textContent).toBe(
      'Customer: Hallberg Verkstad AB 0',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Customer, 1 selected' }));
    const item = screen.getByRole('menuitemcheckbox', { name: /^Hallberg Verkstad AB/ });
    expect(item.getAttribute('aria-checked')).toBe('true');
  });
});

describe('the customer orders list (plan 07; design #687, CO1 and CO2)', () => {
  const lines = snapshot.customerOrderLines ?? [];
  const unsupplied = lines.filter((line) => line.productionOrderId === undefined).length;

  it('CO1 lists one row per customer order line by wanted date, with the order that supplies it', async () => {
    renderGanttRoute({}, undefined, 'customerOrders');
    await screen.findByRole('table', { name: 'Customer order lines' });

    expect(lineRows()).toEqual([
      '40208-1',
      '40214-1',
      '40211-1',
      '40219-1',
      '40223-1',
      '40216-1',
      '40211-2',
    ]);
    expect(statusLine()).toBe(
      `7 customer order lines, 1 supplied by a late order, ${unsupplied} without a production order. Sorted by wanted date.`,
    );
    const supplied = rowOf('data-line', '40211-1');
    expect(supplied.textContent).toContain('Hallberg Verkstad AB');
    expect(supplied.textContent).toContain('PO-88412');
    expect(supplied.textContent).toContain('400 pcs');
    expect(supplied.textContent).toContain('Fri 6 Nov');
    expect(within(supplied).getByRole('link', { name: 'Order 1001' }).getAttribute('href')).toBe(
      '/plant-a/planning/orders/po-1001',
    );
    expect(supplied.textContent).toContain('Planned');
    expect(supplied.textContent).toContain('deadline Fri 6 Nov');
    expect(within(supplied).getByRole('link', { name: 'Open on Gantt' }).getAttribute('href')).toBe(
      '/plant-a/planning/gantt?zoom=week&from=2026-11-03&order=po-1001',
    );
    const late = rowOf('data-line', '40208-1');
    expect(late.textContent).toContain('Late 15 h 15 min');
    const none = rowOf('data-line', '40211-2');
    expect(none.textContent).toContain('Not supplied');
    expect(none.textContent).toContain('No production order yet');
    expect(within(none).getByRole('button', { name: 'New order' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('CO1 Late only keeps the lines of late orders, and the Status filter offers Not supplied', async () => {
    const router = renderGanttRoute({}, undefined, 'customerOrders');
    await screen.findByRole('table', { name: 'Customer order lines' });

    await userEvent.click(screen.getByRole('checkbox', { name: 'Late only' }));
    await waitFor(() => expect(lineRows()).toEqual(['40208-1']));
    expect(router.state.location.search).toEqual({ late: 1 });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Late only' }));

    await userEvent.click(filterButton('Status'));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /^Not supplied/ }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(lineRows()).toHaveLength(unsupplied));
    expect(lineRows()).toContain('40211-2');
    expect(router.state.location.search).toEqual({ status: 'none' });
  });

  it('CO1 the search finds a line by its customer order, its reference, its customer or its article', async () => {
    renderGanttRoute({}, undefined, 'customerOrders');
    await screen.findByRole('table', { name: 'Customer order lines' });

    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search customer orders' }),
      'LM-2026',
    );
    await waitFor(() => expect(lineRows()).toEqual(['40214-1', '40216-1']));
  });
});
