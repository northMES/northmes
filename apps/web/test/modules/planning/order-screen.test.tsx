// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { GanttSnapshot } from '../../../src/modules/planning/gantt-data.ts';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { planReason, saveReason } from '../../../src/modules/planning/mock-reasons.ts';
import {
  findDetails,
  findGantt,
  plant,
  renderGanttRoute,
  renderPlanningAt,
  sourceOf,
} from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The href of an order's page, with its search. */
function orderHref(orderId: string, search: Record<string, string> = {}): string {
  const query = new URLSearchParams(search).toString();
  return `${planningLinks.orders.order({ plant, orderId }).href}${query === '' ? '' : `?${query}`}`;
}

/** The definition of a term in the page's description lists, as its text. */
function definition(term: string): string {
  const dt = screen.getByText(term, { selector: 'dt' });
  return dt.nextElementSibling?.textContent ?? '';
}

/** The text of each cell of a table's own body rows, a nested table's rows left out. */
function bodyRows(table: HTMLElement): string[][] {
  return Array.from(table.querySelectorAll(':scope > tbody > tr')).map((row) =>
    Array.from(row.querySelectorAll(':scope > td')).map((cell) => cell.textContent ?? ''),
  );
}

/** G1 with order 1001 created in NorthMES, so its fields are the planner's to change (PO4). */
function ownedBy1001(): GanttSnapshot {
  const snapshot = g1Snapshot();
  return {
    ...snapshot,
    productionOrders: snapshot.productionOrders.map((order) =>
      order.number === '1001'
        ? {
            ...order,
            owner: 'northmes',
            origin: {
              createdAtMs: Date.UTC(2026, 9, 30, 13, 12),
              createdBy: 'Alex Lund',
              routingVersion: 3,
            },
          }
        : order,
    ),
  };
}

/** G1 as a source without the planning pages' data answers it: no order carries an origin. */
function withoutOrigins(): GanttSnapshot {
  const snapshot = g1Snapshot();
  return {
    ...snapshot,
    productionOrders: snapshot.productionOrders.map(({ origin: _, ...order }) => order),
  };
}

describe('the production order page (plan 07, planning records; design #686, PO1 to PO6)', () => {
  it('PO1 shows the order with its facts, the deadline rule, the planned end and its source', async () => {
    renderPlanningAt(orderHref('po-1001'));

    expect(await screen.findByRole('heading', { level: 1, name: 'Order 1001' })).toBeTruthy();
    expect(screen.getByText('Bracket L, 600 pcs, deadline Fri 6 Nov 15:00')).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'Order 1001' })).toBeTruthy();
    expect(definition('Quantity')).toBe('600 pcs');
    expect(definition('Deadline')).toContain('Fri 6 Nov 15:00');
    expect(definition('Deadline')).toContain(
      'The ERP sent the date only. The deadline rule of the plant sets the time: end of shift, 15:00 on the deadline date.',
    );
    expect(definition('Priority')).toContain('2');
    expect(definition('Planned end')).toContain('Thu 5 Nov 10:45');
    expect(definition('Planned end')).toContain('1 day 4 h 15 min before the deadline');
    expect(definition('Earliest start')).toContain('Not set');
    expect(definition('Color on the board')).toContain('palette-1');
    expect(definition('Source')).toContain('From the ERP');
    expect(definition('Source')).toContain('Through the connection Pyramid.');
    expect(
      screen.getByText('From the ERP, order number 1001, imported Mon 2 Nov 06:40.'),
    ).toBeTruthy();
    expect(screen.getByText('Showing fixture G1.')).toBeTruthy();
  });

  it('PO1 lists the demand, the operations and the job orders of the order', async () => {
    renderPlanningAt(orderHref('po-1001'));
    await screen.findByRole('heading', { level: 1, name: 'Order 1001' });

    const demand = screen.getByRole('table', { name: 'Customer order lines this order supplies' });
    expect(bodyRows(demand)).toEqual([
      ['Hallberg Verkstad AB K-1042', '40211', '1', 'PO-88412', '400 pcs', 'Fri 6 Nov'],
      ['Svea Komponent AB K-1107', '40219', '1', 'SK-7719', '200 pcs', 'Mon 9 Nov'],
      ['Supplied', '600 pcs of 600 pcs', 'Nothing to stock'],
    ]);
    expect(
      screen.getByText('2 customer order lines for Bracket L are gathered into this one order.'),
    ).toBeTruthy();
    // Each line leads to its customer and its customer order (design #728).
    expect(
      within(demand).getByRole('link', { name: 'Hallberg Verkstad AB' }).getAttribute('href'),
    ).toBe('/plant-a/customers/K-1042');
    expect(within(demand).getByRole('link', { name: '40219' }).getAttribute('href')).toBe(
      '/plant-a/planning/customer-orders/40219',
    );

    const operations = screen.getByRole('table', { name: 'Operations in routing sequence' });
    expect(bodyRows(operations)).toEqual([
      ['1001.10', 'Turn', 'CNC 1, CNC 2', 'CNC 1', 'None', 'None', 'No', 'Planned'],
      ['1001.20', 'Mill', 'CNC 2, Mill 1', 'CNC 2', '1 h', 'None', 'No', 'Planned'],
    ]);
    expect(screen.getByText(/Copied from the routing of Bracket L, version 3/)).toBeTruthy();

    const jobOrders = screen.getByRole('table', { name: 'Job orders and their placements' });
    expect(bodyRows(jobOrders)[0]?.slice(0, 9)).toEqual([
      '1001.10 Turn',
      'CNC 1',
      'Tue 3 Nov 11:30',
      'Tue 3 Nov 12:00',
      'Wed 4 Nov 08:00',
      '30 min',
      '5 h',
      '600 pcs',
      'Planned',
    ]);
    const firstRow = within(jobOrders).getAllByRole('row')[1] as HTMLElement;
    expect(within(firstRow).getByRole('button', { name: 'Move' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(within(firstRow).getByRole('link', { name: 'Show on board' }).getAttribute('href')).toBe(
      '/plant-a/planning/board?zoom=week&from=2026-11-03&order=po-1001',
    );
    expect(
      screen.getByText('One job order per operation, all placed. Times are plant time.'),
    ).toBeTruthy();
  });

  it('PO1 offers Edit, Zoom to order on the Gantt and Show on board, and Plan this order disabled with its reason', async () => {
    renderPlanningAt(orderHref('po-1001'));
    await screen.findByRole('heading', { level: 1, name: 'Order 1001' });

    expect(screen.getByRole('link', { name: 'Edit' }).getAttribute('href')).toBe(
      '/plant-a/planning/orders/po-1001/edit',
    );
    expect(
      screen.getByRole('link', { name: 'Zoom to order on the Gantt' }).getAttribute('href'),
    ).toBe('/plant-a/planning/order-gantt?zoom=week&from=2026-11-03&order=po-1001');
    expect(screen.getAllByRole('link', { name: 'Show on board' })[0]?.getAttribute('href')).toBe(
      '/plant-a/planning/board?zoom=week&from=2026-11-03&order=po-1001',
    );
    expect(screen.getByRole('button', { name: 'Plan this order' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByText(planReason)).toBeTruthy();
  });

  it('PO1 a stock order says so, a late order carries Late by, and a locked operation Locked', async () => {
    renderPlanningAt(orderHref('po-1004'));
    await screen.findByRole('heading', { level: 1, name: 'Order 1004' });
    expect(
      screen.getByText('Stock order: no customer order line is supplied by this order.'),
    ).toBeTruthy();
    cleanup();

    renderPlanningAt(orderHref('po-1003'));
    await screen.findByRole('heading', { level: 1, name: 'Order 1003' });
    expect(screen.getAllByText('Late 15 h 15 min').length).toBeGreaterThan(0);
    expect(definition('Planned end')).toContain('Late by 15 h 15 min');
    cleanup();

    renderPlanningAt(orderHref('po-1002'));
    await screen.findByRole('heading', { level: 1, name: 'Order 1002' });
    const operations = screen.getByRole('table', { name: 'Operations in routing sequence' });
    expect(bodyRows(operations)[0]?.[6]).toBe('Locked');
  });

  it('PO3 the History tab lists the entries newest first, the newest open, and a disclosure opens another', async () => {
    const router = renderPlanningAt(orderHref('po-1001', { tab: 'history' }));
    await screen.findByRole('heading', { level: 1, name: 'Order 1001' });

    const history = screen.getByRole('table', { name: 'History of order 1001' });
    const rows = bodyRows(history);
    expect(rows[0]?.slice(1)).toEqual([
      'Mon 2 Nov 09:38',
      'Alex Lund',
      'Planning board',
      'Autoplan',
      'Placed, 2 job orders',
    ]);
    expect(screen.getByRole('table', { name: 'Changes on Mon 2 Nov 09:38' })).toBeTruthy();
    expect(rows.at(-1)?.slice(1)).toEqual([
      'Thu 29 Oct 06:40',
      'ERP connector',
      'Import',
      'No reason given',
      'Created, 12 fields',
    ]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Show the changes of Fri 30 Oct 14:12' }),
    );

    const changes = screen.getByRole('table', { name: 'Changes on Fri 30 Oct 14:12' });
    expect(bodyRows(changes)).toEqual([['Priority', '3', '2']]);

    await userEvent.click(screen.getByRole('tab', { name: 'General' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it('PO3 an order without history entries in the fixture says so', async () => {
    renderPlanningAt(orderHref('po-1002', { tab: 'history' }));
    await screen.findByRole('heading', { level: 1, name: 'Order 1002' });

    expect(screen.getByText('No history entries in the fixture for this order.')).toBeTruthy();
  });

  it('PO5 the edit form of an imported order shows the ERP fields read-only with From the ERP, and Save disabled', async () => {
    renderPlanningAt(`${orderHref('po-1001')}/edit`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Edit order 1001' })).toBeTruthy();
    expect(screen.getByText('Order 1001 comes from the ERP')).toBeTruthy();
    const article = screen.getByLabelText('Article') as HTMLInputElement;
    expect(article.readOnly).toBe(true);
    expect(article.value).toBe('Bracket L');
    expect(screen.getAllByText('From the ERP')).toHaveLength(4);
    expect((screen.getByLabelText(/^Deadline date/) as HTMLInputElement).value).toBe('2026-11-06');
    expect(screen.queryByLabelText(/^Deadline time/)).toBeNull();
    expect((screen.getByLabelText(/^Earliest start/) as HTMLInputElement).readOnly).toBe(false);
    expect(screen.getByLabelText(/^Note/)).toBeTruthy();
    expect(screen.getByLabelText('Reason')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save order' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(saveReason)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe(
      '/plant-a/planning/orders/po-1001',
    );
  });

  it('PO4 the edit form of an order created in NorthMES offers every field', async () => {
    renderPlanningAt(`${orderHref('po-1001')}/edit`, sourceOf(ownedBy1001()));
    await screen.findByRole('heading', { level: 1, name: 'Edit order 1001' });

    expect(screen.queryByText('From the ERP')).toBeNull();
    expect((screen.getByLabelText('Article') as HTMLSelectElement).tagName).toBe('SELECT');
    expect((screen.getByLabelText(/^Quantity/) as HTMLInputElement).readOnly).toBe(false);
    expect(screen.getByLabelText(/^Deadline time/)).toBeTruthy();
    expect((screen.getByLabelText(/^Priority/) as HTMLInputElement).value).toBe('2');
  });

  it("PO4 an order NorthMES owns stays the planner's to edit when the source sends no origin", async () => {
    renderPlanningAt(orderHref('po-1005'), sourceOf(withoutOrigins()));
    await screen.findByRole('heading', { level: 1, name: 'Order 1005' });
    expect(definition('Source')).toContain('NorthMES');
    expect(screen.getByText('Created in NorthMES.')).toBeTruthy();
    cleanup();

    renderPlanningAt(`${orderHref('po-1005')}/edit`, sourceOf(withoutOrigins()));
    await screen.findByRole('heading', { level: 1, name: 'Edit order 1005' });
    expect(screen.queryByText('From the ERP')).toBeNull();
    expect((screen.getByLabelText(/^Quantity/) as HTMLInputElement).readOnly).toBe(false);
  });

  it('PO1 an order created in NorthMES names its creator as the source', async () => {
    renderPlanningAt(orderHref('po-1001'), sourceOf(ownedBy1001()));
    await screen.findByRole('heading', { level: 1, name: 'Order 1001' });

    expect(definition('Source')).toContain('NorthMES');
    expect(definition('Source')).toContain('Every field can be changed here.');
    expect(screen.getByText('Created in NorthMES by Alex Lund, Fri 30 Oct 14:12.')).toBeTruthy();
    expect(definition('Deadline')).toContain('Set by hand.');
  });

  it('ST7 an order that the snapshot does not hold shows the not-found state with a way back', async () => {
    renderPlanningAt(orderHref('po-9999'));

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'This order does not exist or you cannot see it',
      }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Order' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Back to Production orders' }).getAttribute('href'),
    ).toBe('/plant-a/planning/orders');
  });

  it("PO1 the Gantt's Details and the job order table's row menu lead to the order's page", async () => {
    // The chain in the URL opens the order's Details drawer, as the Gantt's axe spec does.
    renderGanttRoute({ zoom: 'week', from: '2026-11-02', order: 'po-1001', chain: 1 });
    await findGantt();
    const details = await findDetails();
    await userEvent.click(within(details).getByRole('button', { name: 'Actions for order 1001' }));
    const menu = await screen.findByRole('menu', { name: 'Actions for order 1001' });
    expect(within(menu).getByRole('menuitem', { name: 'Open order' }).getAttribute('href')).toBe(
      '/plant-a/planning/orders/po-1001',
    );
    cleanup();

    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'jobOrders');
    await screen.findByRole('table', { name: /^Job orders, / });
    await userEvent.click(screen.getByRole('button', { name: 'Actions for 1001.10' }));
    expect(screen.getByRole('menuitem', { name: 'Open order' }).getAttribute('href')).toBe(
      '/plant-a/planning/orders/po-1001',
    );
  });
});
