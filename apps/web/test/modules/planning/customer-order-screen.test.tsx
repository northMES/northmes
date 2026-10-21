// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { saveReason } from '../../../src/modules/planning/mock-reasons.ts';
import { plant, renderPlanningAt, sourceOf } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The href of a customer order's page, with its search. */
function customerOrderHref(number: string, search: Record<string, string> = {}): string {
  const query = new URLSearchParams(search).toString();
  const href = planningLinks.customerOrders.customerOrder({ plant, customerOrderId: number }).href;
  return query === '' ? href : `${href}?${query}`;
}

/** The definition of a term in the page's description lists, as its text. */
function definition(term: string): string {
  const dt = screen.getByText(term, { selector: 'dt' });
  return dt.nextElementSibling?.textContent ?? '';
}

/** The text of each cell of a table's own body rows. */
function bodyRows(table: HTMLElement): string[][] {
  return Array.from(table.querySelectorAll(':scope > tbody > tr')).map((row) =>
    Array.from(row.querySelectorAll(':scope > td')).map((cell) => cell.textContent ?? ''),
  );
}

describe("a customer order's page (design #728, KO1 to KO3)", () => {
  it('#728 KO1 names the customer order from the ERP with its customer, reference, lines and delivering plant', async () => {
    renderPlanningAt(customerOrderHref('40211'));
    await screen.findByRole('heading', { level: 1, name: 'Customer order 40211' });

    expect(
      screen.getAllByRole('link', { name: 'Hallberg Verkstad AB' })[0]?.getAttribute('href'),
    ).toBe('/plant-a/customers/K-1042');
    expect(screen.getByRole('note').textContent).toBe(
      "Customer order 40211 comes from the ERPThe ERP owns the order number, the customer, the reference and each line's article, quantity and wanted date; the next import changes them. In NorthMES you choose which production order supplies a line, and how much of it.",
    );
    expect(
      screen.getByText('Through the connection Pyramid, imported Mon 2 Nov 06:40.'),
    ).toBeTruthy();
    expect(definition('Customer order')).toBe('40211From the ERP');
    expect(definition('Customer')).toBe('Hallberg Verkstad AB K-1042From the ERP');
    expect(definition("Customer's reference")).toBe(
      "PO-88412From the ERPThe customer's own order number, as the ERP sent it.",
    );
    expect(definition('Lines')).toBe('2 lines, 1 supplied, 1 not supplied');
    expect(definition('Delivering plant')).toBe(
      'Plant A, both linesA company admin sets it. You cannot change it here: it needs the company permission to set delivering plants.',
    );
    expect(screen.getByText('Showing fixture G1.')).toBeTruthy();
  });

  it('#728 KO1 lists the lines with the order that supplies each, its demand and everything else that order supplies', async () => {
    renderPlanningAt(customerOrderHref('40211'));
    const table = await screen.findByRole('table', {
      name: 'Lines of customer order 40211 and the production orders that supply them',
    });

    expect(bodyRows(table)).toEqual([
      [
        '1',
        'Bracket L',
        '400 pcs',
        'Fri 6 Nov',
        'Order 1001Planned',
        '400 pcs',
        'Thu 5 Nov 10:45',
        'Change supplyOpen on Gantt',
      ],
      [
        '',
        'Order 1001, 600 pcs, deadline Fri 6 Nov 15:00, supplies:400 pcs to this line200 pcs to customer order 40219 line 1, Svea Komponent AB',
      ],
      [
        '2',
        'Hub 12',
        '250 pcs',
        'Fri 20 Nov',
        'Not suppliedNo production order yet',
        '',
        '',
        'Supply from an order',
      ],
    ]);
    expect(within(table).getByRole('link', { name: 'Order 1001' }).getAttribute('href')).toBe(
      '/plant-a/planning/orders/po-1001',
    );
    expect(
      within(table).getByRole('link', { name: 'Open on Gantt, order 1001' }).getAttribute('href'),
    ).toBe('/plant-a/planning/gantt?zoom=week&from=2026-11-03&order=po-1001');
    expect(
      within(table).getByRole('button', { name: 'Change supply, line 1' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('#728 KO1 says who changes each field of a customer order from the ERP', async () => {
    renderPlanningAt(customerOrderHref('40211'));
    const table = await screen.findByRole('table', {
      name: 'Who changes each field of a customer order from the ERP',
    });

    expect(bodyRows(table).map((row) => row.slice(0, 2))).toEqual([
      ["Order number, customer, customer's reference", 'The ERP'],
      ["A line's article, quantity and wanted date", 'The ERP'],
      ['Which production order supplies a line, and how much', 'You, as planner'],
      ['Delivering plant of a line', 'A company admin'],
    ]);
  });

  it('#728 KO3 Supply from an order offers the open orders of the article with quantity free, and what the order then supplies', async () => {
    const router = renderPlanningAt(customerOrderHref('40211'));
    await screen.findByRole('heading', { level: 1, name: 'Customer order 40211' });

    await userEvent.click(screen.getByRole('button', { name: 'Supply from an order, line 2' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Supply line 2 from a production order',
    });
    await waitFor(() => expect(router.state.location.search).toEqual({ supply: 2 }));
    expect(
      within(dialog).getByText(
        'Line 2 of customer order 40211: Hub 12, 250 pcs, wanted Fri 20 Nov. Production orders of Hub 12 at Plant A with quantity free:',
      ),
    ).toBeTruthy();
    const order = within(dialog).getByRole('radio', { name: /^Order 1004/ });
    expect(order.getAttribute('aria-checked')).toBe('true');
    expect(order.closest('label')?.textContent).toBe(
      'Order 1004, 1200 pcs, stock order, 1200 pcs freeDeadline Fri 6 Nov 15:00, planned end Fri 6 Nov 08:45',
    );
    const quantity = within(dialog).getByRole('textbox', {
      name: 'Quantity from order 1004 (pcs)',
    }) as HTMLInputElement;
    expect(quantity.value).toBe('250');
    expect(within(dialog).getByRole('status').textContent).toBe(
      'Order 1004 then supplies 250 pcs to this line and 950 pcs to stockIts deadline stays Fri 6 Nov 15:00, 14 days before the wanted date, so nothing moves on the plan. It is no longer a stock order.',
    );

    await userEvent.clear(quantity);
    await userEvent.type(quantity, '100');
    expect(within(dialog).getByRole('status').textContent).toMatch(
      /^Order 1004 then supplies 100 pcs to this line and 1100 pcs to stock/,
    );

    expect(
      within(dialog)
        .getByRole('button', { name: 'Supply from order 1004' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      within(dialog)
        .getByRole('button', { name: 'New production order for 250 pcs' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(within(dialog).getByText(saveReason)).toBeTruthy();
    expect(within(dialog).getByRole('textbox', { name: /^Reason/ })).toBeTruthy();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(router.state.location.search).toEqual({});
  });

  it('#728 KO3 opens the supply step of the line the URL names, and refuses a quantity above the line', async () => {
    renderPlanningAt(customerOrderHref('40211', { supply: '2' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Supply line 2 from a production order',
    });
    const quantity = within(dialog).getByRole('textbox', {
      name: 'Quantity from order 1004 (pcs)',
    });

    await userEvent.clear(quantity);
    await userEvent.type(quantity, '300');
    expect(quantity.getAttribute('aria-invalid')).toBe('true');
    expect(
      within(dialog).getByText('At most 250 pcs, the open quantity of the line.'),
    ).toBeTruthy();
  });

  it('#728 KO1 says a customer order does not exist, with the way back to Customer orders', async () => {
    renderPlanningAt(customerOrderHref('99999'));
    await screen.findByRole('heading', {
      level: 2,
      name: 'This customer order does not exist or you cannot see it',
    });
    expect(screen.getByRole('link', { name: 'Back to Customer orders' }).getAttribute('href')).toBe(
      planningLinks.customerOrders({ plant }).href,
    );
  });

  it('#728 KO3 says the line would be late when the picked order is late, whatever its deadline', async () => {
    const snapshot = g1Snapshot();
    const onTime = snapshot.analysis.orders['po-1004'];
    const late = {
      ...snapshot,
      analysis: {
        ...snapshot.analysis,
        orders: {
          ...snapshot.analysis.orders,
          'po-1004': {
            ...onTime,
            late: true,
            slackElapsedS: -3600,
            plannedEndMs: Date.parse('2026-11-06T15:00:00Z'),
          },
        },
      },
    };
    renderPlanningAt(customerOrderHref('40211', { supply: '2' }), sourceOf(late));
    const dialog = await screen.findByRole('dialog', {
      name: 'Supply line 2 from a production order',
    });

    expect(within(dialog).getByRole('status').textContent).toBe(
      'Order 1004 then supplies 250 pcs to this line and 950 pcs to stockOrder 1004 is late by 1 h: it ends Fri 6 Nov 16:00, after its deadline Fri 6 Nov 15:00, so the line is late too. Nothing moves on the plan. It is no longer a stock order.',
    );
  });

  it('#728 KO1 opens the History tab from the URL, and Back returns to General', async () => {
    const router = renderPlanningAt(customerOrderHref('40211'));
    await screen.findByRole('heading', { level: 1, name: 'Customer order 40211' });

    await userEvent.click(screen.getByRole('tab', { name: 'History' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ tab: 'history' }));
    router.history.back();
    await waitFor(() => expect(router.state.location.search).toEqual({}));

    cleanup();
    renderPlanningAt(customerOrderHref('40211', { tab: 'history' }));
    await screen.findByText(
      "A customer order's history waits for the planning server; this page reads the fixture G1.",
    );
  });

  it('#728 KO3 drops a supply key that names a supplied line, and opens no step', async () => {
    const router = renderPlanningAt(customerOrderHref('40211', { supply: '1' }));
    await screen.findByRole('heading', { level: 1, name: 'Customer order 40211' });

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("#728 KO3 gives focus back to the line's Supply from an order when the step closes", async () => {
    renderPlanningAt(customerOrderHref('40211', { supply: '2' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Supply line 2 from a production order',
    });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Supply from an order, line 2' }),
      ),
    );
  });
});
