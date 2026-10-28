// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { planningLinks } from '@northmes/planning-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { CustomersSource } from '../../../src/modules/core/customers-data.ts';
import { g1CustomersSnapshot } from '../../../src/modules/core/customers-data-g1.ts';
import { plant, renderCoreAt, spoken } from './core-app.tsx';

afterEach(cleanup);

/** An href of the plant with a search. */
function withSearch(href: string, search: Record<string, string>): string {
  const query = new URLSearchParams(search).toString();
  return query === '' ? href : `${href}?${query}`;
}

/** The text of each cell of a table's own body rows. */
function bodyRows(table: HTMLElement): string[][] {
  return Array.from(table.querySelectorAll(':scope > tbody > tr')).map((row) =>
    Array.from(row.querySelectorAll(':scope > td')).map((cell) => cell.textContent ?? ''),
  );
}

/** The status line above a list or a table. */
function statusLine(): string {
  return document.querySelector('[data-list-status]')?.textContent ?? '';
}

/** The definition of a term in the page's description lists, as its text. */
function definition(term: string): string {
  const dt = screen.getByText(term, { selector: 'dt' });
  return dt.nextElementSibling?.textContent ?? '';
}

const customers = coreLinks.customers({ plant }).href;

describe('the customers register (design #728, CU1 to CU5)', () => {
  it('#728 CU1 lists the customers by name with their number, open lines, supplying orders, late and unsupplied lines and next wanted date', async () => {
    renderCoreAt(customers, []);
    const table = await screen.findByRole('table', { name: 'Customers' });

    expect(bodyRows(table).map((row) => row.slice(0, 7))).toEqual([
      [
        'Bergmark Hydraulik ABFrom the ERP',
        'K-1318',
        '1',
        '1 order1003',
        '1 late',
        'None',
        'Wed 4 Nov',
      ],
      [
        'Hallberg Verkstad ABFrom the ERP',
        'K-1042',
        '3',
        '2 orders1001, 1005',
        'None',
        '1 not supplied',
        'Fri 6 Nov',
      ],
      [
        'Lindqvist Maskin ABFrom the ERP',
        'K-1211',
        '2',
        '2 orders1002, 1006',
        'None',
        'None',
        'Thu 5 Nov',
      ],
      ['Svea Komponent ABFrom the ERP', 'K-1107', '1', '1 order1001', 'None', 'None', 'Mon 9 Nov'],
    ]);
    expect(statusLine()).toBe(
      '4 customers, 7 open customer order lines, 1 late, 1 not supplied. Sorted by name.',
    );
    expect(screen.getByText('ERP data as of Mon 2 Nov 06:40')).toBeTruthy();
    expect(screen.getByText('Showing fixture G1.')).toBeTruthy();
    expect(
      within(table).getByRole('link', { name: 'Hallberg Verkstad AB' }).getAttribute('href'),
    ).toBe('/plant-a/customers/K-1042');
    expect(within(table).getByRole('link', { name: 'K-1042' }).getAttribute('href')).toBe(
      '/plant-a/customers/K-1042',
    );
    expect(
      within(table)
        .getByRole('link', { name: 'Customer orders of Hallberg Verkstad AB' })
        .getAttribute('href'),
    ).toBe(planningLinks.customerOrders({ plant }, { customer: 'K-1042' }).href);
  });

  it('#728 CU1 offers no way to create or change a customer: the ERP owns them', async () => {
    renderCoreAt(customers, []);
    await screen.findByRole('table', { name: 'Customers' });

    expect(screen.queryByRole('button', { name: /new customer/i })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /select/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Actions for/ })).toBeNull();
  });

  it('#728 CU1 keeps the customers with late lines, then those with lines not supplied, in the URL', async () => {
    const router = renderCoreAt(customers, []);
    const table = await screen.findByRole('table', { name: 'Customers' });

    await userEvent.click(screen.getByRole('checkbox', { name: 'With late lines' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ late: 1 }));
    expect(bodyRows(table).map((row) => row[1])).toEqual(['K-1318']);
    expect(statusLine()).toBe(
      '1 customer, 1 open customer order line, 1 late, 0 not supplied, with late lines. Sorted by name.',
    );

    await userEvent.click(screen.getByRole('checkbox', { name: 'With late lines' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'With lines not supplied' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ unsupplied: 1 }));
    expect(bodyRows(table).map((row) => row[1])).toEqual(['K-1042']);
  });

  it('#728 CU1 searches the name and the number, and offers Clear filters when nothing matches', async () => {
    renderCoreAt(withSearch(customers, { q: 'k-121' }), []);
    const table = await screen.findByRole('table', { name: 'Customers' });
    expect(bodyRows(table).map((row) => row[1])).toEqual(['K-1211']);

    cleanup();
    const router = renderCoreAt(withSearch(customers, { q: 'nobody' }), []);
    await screen.findByRole('heading', { level: 2, name: 'No customers match these filters' });
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(document.activeElement).toBe(
      screen.getByRole('searchbox', { name: 'Search customers' }),
    );
  });

  it('#728 CU1 filters by Source with the count of each owner', async () => {
    const router = renderCoreAt(customers, []);
    await screen.findByRole('table', { name: 'Customers' });

    await userEvent.click(screen.getByRole('button', { name: 'Source' }));
    const erp = await screen.findByRole('menuitemcheckbox', { name: /^From the ERP/ });
    expect(erp.textContent).toContain('4');
    await userEvent.click(erp);
    await waitFor(() => expect(router.state.location.search).toEqual({ source: 'erp' }));
  });

  it('#728 CU1 shows the Source filter as a chip and keeps a key that applies when another does not', async () => {
    renderCoreAt(withSearch(customers, { source: 'erp', sort: 'bogus', q: 'svea' }), []);
    const table = await screen.findByRole('table', { name: 'Customers' });

    expect(bodyRows(table).map((row) => row[1])).toEqual(['K-1107']);
    expect(screen.getByRole('button', { name: 'Remove the source filter' })).toBeTruthy();
    expect(statusLine()).toMatch(/Sorted by name\.$/);
  });

  it('#728 CU1 sorts a customer without lines last under Next wanted, in either direction', async () => {
    const snapshot = g1CustomersSnapshot();
    const customersSource: CustomersSource = {
      load: async () => ({
        ...snapshot,
        customers: [
          ...snapshot.customers,
          { code: 'K-1500', name: 'Ödmark Svets AB', owner: 'erp' },
        ],
      }),
    };
    renderCoreAt(withSearch(customers, { sort: '-nextWanted' }), [], { customersSource });
    const table = await screen.findByRole('table', { name: 'Customers' });
    expect(
      bodyRows(table)
        .map((row) => row[1])
        .at(-1),
    ).toBe('K-1500');

    cleanup();
    renderCoreAt(withSearch(customers, { sort: 'nextWanted' }), [], { customersSource });
    const ascending = await screen.findByRole('table', { name: 'Customers' });
    expect(
      bodyRows(ascending)
        .map((row) => row[1])
        .at(-1),
    ).toBe('K-1500');
  });

  it('#728 CU1 sorts names by the language, not by code units', async () => {
    const snapshot = g1CustomersSnapshot();
    const customersSource: CustomersSource = {
      load: async () => ({
        ...snapshot,
        customers: [
          ...snapshot.customers,
          { code: 'K-1600', name: 'de Wit Metaal BV', owner: 'erp' },
        ],
      }),
    };
    renderCoreAt(customers, [], { customersSource });
    const table = await screen.findByRole('table', { name: 'Customers' });
    expect(bodyRows(table).map((row) => row[1])).toEqual([
      'K-1318',
      'K-1600',
      'K-1042',
      'K-1211',
      'K-1107',
    ]);
  });

  it('#728 CU1 sorts on a column in the URL, the name breaking ties', async () => {
    const router = renderCoreAt(customers, []);
    const table = await screen.findByRole('table', { name: 'Customers' });

    await userEvent.click(within(table).getByRole('button', { name: /^Open lines/ }));
    await waitFor(() => expect(router.state.location.search).toEqual({ sort: 'lines' }));
    expect(bodyRows(table).map((row) => row[1])).toEqual(['K-1318', 'K-1107', 'K-1211', 'K-1042']);
    expect(statusLine()).toMatch(/Sorted by open lines, ascending\.$/);
  });

  it('#728 CU3 shows the loading table, marked busy', async () => {
    renderCoreAt(withSearch(customers, { preview: 'loading' }), []);
    const table = await screen.findByRole('table', { name: 'Customers' });
    expect(table.getAttribute('aria-busy')).toBe('true');
  });

  it('#728 CU4 says customers come from the ERP when no import has run', async () => {
    renderCoreAt(withSearch(customers, { preview: 'empty' }), []);
    await screen.findByRole('heading', { level: 2, name: 'No customers yet' });
    expect(
      screen.getByText(
        'Customers come from the ERP with their number and name. They appear here after the next import.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('No import yet')).toBeTruthy();
  });

  it('#728 CU5 offers Try again after a failed load', async () => {
    let fails = true;
    const customersSource: CustomersSource = {
      load: async () => {
        if (fails) throw new Error('down');
        return g1CustomersSnapshot();
      },
    };
    renderCoreAt(customers, [], { customersSource });
    await screen.findByRole('heading', { level: 2, name: 'Could not load customers' });

    fails = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('table', { name: 'Customers' });
  });
});

describe("a customer's page (design #728, CC1 to CC6)", () => {
  const hallberg = coreLinks.customers.customer({ plant, customerId: 'K-1042' }).href;

  it('#728 CC1 names the customer from the ERP with its number, source and the summary of its open lines', async () => {
    renderCoreAt(hallberg, []);
    await screen.findByRole('heading', { level: 1, name: 'Hallberg Verkstad AB' });

    expect(screen.getByText('Customer K-1042')).toBeTruthy();
    expect(definition('Customer number')).toBe('K-1042From the ERP');
    expect(definition('Name')).toBe('Hallberg Verkstad ABFrom the ERP');
    expect(definition('Source')).toBe(
      'From the ERPThrough the connection Pyramid, imported Mon 2 Nov 06:40. The next import changes number and name; NorthMES never does.',
    );
    expect(definition('Open customer order lines')).toBe('3 lines');
    expect(definition('Supplied by')).toBe('2 orders1001, 1005');
    expect(definition('Next wanted date')).toBe('Fri 6 Nov');
  });

  it('#728 CC1 lists its open lines by wanted date with the order that supplies each, or Not supplied', async () => {
    renderCoreAt(hallberg, []);
    const table = await screen.findByRole('table', {
      name: 'Customer order lines of Hallberg Verkstad AB',
    });

    expect(bodyRows(table).map((row) => row.slice(0, 6))).toEqual([
      [
        '40211 line 1PO-88412',
        'Fri 6 Nov',
        'Bracket L',
        '400 pcs',
        'Order 1001Planned',
        'Thu 5 Nov 10:45',
      ],
      [
        '40223 line 1PO-88437',
        'Tue 10 Nov',
        'Bracket L',
        '300 pcs',
        'Order 1005Planned',
        'Tue 10 Nov 15:00',
      ],
      [
        '40211 line 2PO-88412',
        'Fri 20 Nov',
        'Hub 12',
        '250 pcs',
        'Not suppliedNo production order yet',
        '',
      ],
    ]);
    expect(statusLine()).toBe('3 lines, 0 late, 1 not supplied. Sorted by wanted date.');
    expect(within(table).getAllByRole('link', { name: '40211' })[0]?.getAttribute('href')).toBe(
      planningLinks.customerOrders.customerOrder({ plant, customerOrderId: '40211' }).href,
    );
    expect(within(table).getByRole('link', { name: 'Order 1001' }).getAttribute('href')).toBe(
      planningLinks.orders.order({ plant, orderId: 'po-1001' }).href,
    );
    expect(
      within(table).getByRole('link', { name: 'Open on Gantt, order 1001' }).getAttribute('href'),
    ).toBe(
      planningLinks.gantt({ plant }, { zoom: 'week', from: '2026-11-03', order: 'po-1001' }).href,
    );
    expect(
      within(table)
        .getByRole('link', { name: 'Supply from an order, line 2 of 40211' })
        .getAttribute('href'),
    ).toBe(
      planningLinks.customerOrders.customerOrder(
        { plant, customerOrderId: '40211' },
        { supply: '2' },
      ).href,
    );
    expect(screen.getByRole('link', { name: 'Open in Customer orders' }).getAttribute('href')).toBe(
      planningLinks.customerOrders({ plant }, { customer: 'K-1042' }).href,
    );
  });

  it('#728 CC4 keeps the late lines with Late only and says which order puts the line at risk', async () => {
    renderCoreAt(
      withSearch(coreLinks.customers.customer({ plant, customerId: 'K-1318' }).href, { late: '1' }),
      [],
    );
    const table = await screen.findByRole('table', {
      name: 'Customer order lines of Bergmark Hydraulik AB',
    });

    expect(screen.getByRole('checkbox', { name: 'Late only' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(bodyRows(table).map((row) => row[4])).toEqual(['Order 1003PlannedLate 15 h 15 min']);
    expect(statusLine()).toBe(
      '1 of 1 line, late only. Order 1003 ends after its deadline, so line 1 of customer order 40208 is at risk. Sorted by wanted date.',
    );
  });

  it('#728 CC1 keeps the lines not supplied, and says when no line matches', async () => {
    const router = renderCoreAt(withSearch(hallberg, { unsupplied: '1' }), []);
    const table = await screen.findByRole('table', {
      name: 'Customer order lines of Hallberg Verkstad AB',
    });
    expect(bodyRows(table).map((row) => row[2])).toEqual(['Hub 12']);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Late only' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ unsupplied: 1, late: 1 }));
    expect(
      screen.getByText('Clear the filters to see every open line of Hallberg Verkstad AB.'),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(bodyRows(table)).toHaveLength(3);
  });

  it('#728 CC4 names every late order with Late only, and announces the lines the filters keep', async () => {
    const snapshot = g1CustomersSnapshot();
    const late = snapshot.lines.find((line) => line.id === '40208-1');
    const customersSource: CustomersSource = {
      load: async () => ({
        ...snapshot,
        lines: snapshot.lines.map((line) =>
          line.id === '40211-1' && late?.supply !== undefined
            ? {
                ...line,
                customerCode: 'K-1318',
                supply: { ...late.supply, number: '1007', orderId: 'po-1007' },
              }
            : line,
        ),
      }),
    };
    renderCoreAt(coreLinks.customers.customer({ plant, customerId: 'K-1318' }).href, [], {
      customersSource,
    });
    await screen.findByRole('table', { name: 'Customer order lines of Bergmark Hydraulik AB' });

    await userEvent.click(screen.getByRole('checkbox', { name: 'Late only' }));
    const status =
      '2 of 2 lines, late only. Orders 1003 and 1007 end after their deadlines, so line 1 of customer order 40208 and line 1 of customer order 40211 are at risk. Sorted by wanted date.';
    await waitFor(() => expect(statusLine()).toBe(status));
    await waitFor(() => expect(spoken()).toBe(status));
  });

  it('#728 CC1 opens the History tab from the URL, and Back returns to General', async () => {
    const router = renderCoreAt(hallberg, []);
    await screen.findByRole('heading', { level: 1, name: 'Hallberg Verkstad AB' });

    await userEvent.click(screen.getByRole('tab', { name: 'History' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ tab: 'history' }));
    router.history.back();
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(screen.getByRole('tab', { name: 'General' }).getAttribute('aria-selected')).toBe('true');

    cleanup();
    renderCoreAt(withSearch(hallberg, { tab: 'history' }), []);
    await screen.findByText(
      "A customer's history waits for the customers API; this page reads the fixture G1.",
    );
  });

  it('#728 CC5 shows the loading page, marked busy', async () => {
    renderCoreAt(withSearch(hallberg, { preview: 'loading' }), []);
    await screen.findByRole('heading', { level: 1, name: 'Customer' });
    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).not.toBeNull());
  });

  it('#728 CC6 says the customer does not exist, with the way back to Customers', async () => {
    renderCoreAt(coreLinks.customers.customer({ plant, customerId: 'K-9999' }).href, []);
    await screen.findByRole('heading', {
      level: 2,
      name: 'This customer does not exist or you cannot see it',
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Customer' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to Customers' }).getAttribute('href')).toBe(
      customers,
    );
  });
});
