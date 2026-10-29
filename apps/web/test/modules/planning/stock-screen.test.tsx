// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { plant, renderPlanningAt } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** An href with a search. */
function withSearch(href: string, search: Record<string, string>): string {
  const query = new URLSearchParams(search).toString();
  return query === '' ? href : `${href}?${query}`;
}

/** The text of each cell of a table's own body rows. */
function bodyRows(table: HTMLElement): string[][] {
  return Array.from(table.querySelectorAll(':scope > tbody > tr')).map((row) =>
    Array.from(row.querySelectorAll(':scope > td:not([aria-hidden])')).map(
      (cell) => cell.textContent ?? '',
    ),
  );
}

/** The status line above a list. */
function statusLine(): string {
  return document.querySelector('[data-list-status]')?.textContent ?? '';
}

const stock = planningLinks.stock({ plant }).href;
const roundBar = planningLinks.stock.article({ plant, articleId: '30-2011' }).href;

describe('the Stock page of a plant (design #729, ST1 to ST7)', () => {
  it('#729 ST1 lists the articles with stock at the plant, with the lowest projected balance and why it is short', async () => {
    renderPlanningAt(stock);
    const table = await screen.findByRole('table', { name: 'Stock of Plant A by article' });

    expect(bodyRows(table)).toEqual([
      [
        '30-2011Round bar 36 C45',
        'm',
        '92',
        '−26Below zero',
        'Thu 5 Nov 06:00',
        'Material short1004.10',
        '+120 m, Mon 9 Nov',
      ],
      ['30-2030Steel tube 52x6', 'm', '70', '7', 'Thu 5 Nov 11:30', 'None', 'None needed'],
      ['30-2020Flat bar 60x10 S235', 'm', '180', '36', 'Mon 9 Nov 06:00', 'None', 'None needed'],
      ['30-2014Round bar 12 S355', 'm', '210', '156', 'Fri 6 Nov 13:00', 'None', 'None needed'],
      [
        '20-1003Gear blank 32',
        'pcs',
        '0',
        '−600Below zero',
        'Wed 4 Nov',
        'Late order1003 for customer order 40208',
        '+600 pcs, Thu 5 Nov 06:15',
      ],
      [
        '20-1002Housing P',
        'pcs',
        '0',
        '−420Below zero',
        'Thu 5 Nov',
        'Late order1002 for customer order 40214',
        '+420 pcs, Thu 5 Nov 15:00',
      ],
      ['20-1005Shaft 8', 'pcs', '0', '0', 'Mon 2 Nov 06:40', 'None', 'None needed'],
      ['20-1001Bracket L', 'pcs', '40', '40', 'Mon 2 Nov 06:40', 'None', 'None needed'],
      ['20-1004Hub 12', 'pcs', '120', '120', 'Mon 2 Nov 06:40', 'None', 'None needed'],
    ]);
    expect(statusLine()).toBe(
      '9 articles with stock or planned movements, 3 below zero in the projection. Sorted by kind of article, then lowest projected balance. Lowest projected sums every warehouse mapped to Plant A; purchase requisitions are not counted (Plant A setting).',
    );
    expect(
      screen.getByText(
        'Plant A. ERP data as of Mon 2 Nov 06:40. Read-only: stock and planned movements come from the ERP.',
      ),
    ).toBeTruthy();
    expect(within(table).getByRole('link', { name: '30-2011' }).getAttribute('href')).toBe(
      roundBar,
    );
    expect(within(table).getByRole('link', { name: '1004.10' }).getAttribute('href')).toBe(
      planningLinks.gantt({ plant }, { zoom: 'week', from: '2026-11-05', order: 'po-1004' }).href,
    );
    expect(within(table).getByRole('link', { name: '1003' }).getAttribute('href')).toBe(
      planningLinks.orders.order({ plant, orderId: 'po-1003' }).href,
    );
  });

  it('#729 ST1 says which article is short for a job order, above the table', async () => {
    renderPlanningAt(stock);
    await screen.findByRole('table', { name: 'Stock of Plant A by article' });

    const alert = screen.getByRole('note');
    expect(alert.textContent).toBe(
      '1 article is short for a job order.Round bar 36 C45 is 26 m short when 1004.10 Hub 12 starts on CNC 1, Thu 5 Nov 06:00. Show the stock of Round bar 36 C45',
    );
    expect(
      within(alert)
        .getByRole('link', { name: 'Show the stock of Round bar 36 C45' })
        .getAttribute('href'),
    ).toBe(roundBar);
  });

  it('#729 ST1 keeps the articles below zero, then one kind, then sums one warehouse, in the URL', async () => {
    const router = renderPlanningAt(stock);
    const table = await screen.findByRole('table', { name: 'Stock of Plant A by article' });

    await userEvent.click(screen.getByRole('checkbox', { name: 'Below zero only' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ below: 1 }));
    expect(bodyRows(table).map((row) => row[0])).toEqual([
      '30-2011Round bar 36 C45',
      '20-1003Gear blank 32',
      '20-1002Housing P',
    ]);

    cleanup();
    renderPlanningAt(withSearch(stock, { kind: 'finished' }));
    const finished = await screen.findByRole('table', { name: 'Stock of Plant A by article' });
    expect(bodyRows(finished).map((row) => row[0])).toEqual([
      '20-1003Gear blank 32',
      '20-1002Housing P',
      '20-1005Shaft 8',
      '20-1001Bracket L',
      '20-1004Hub 12',
    ]);

    cleanup();
    renderPlanningAt(withSearch(stock, { warehouse: 'A-QH' }));
    const held = await screen.findByRole('table', { name: 'Stock of Plant A by article' });
    expect(bodyRows(held).map((row) => row.slice(0, 4))).toEqual([
      ['30-2011Round bar 36 C45', 'm', '14', '14'],
    ]);
  });

  it('#729 ST1 sorts by article number in the URL', async () => {
    const router = renderPlanningAt(stock);
    const table = await screen.findByRole('table', { name: 'Stock of Plant A by article' });

    await userEvent.click(within(table).getByRole('button', { name: /^Article/ }));
    await waitFor(() => expect(router.state.location.search).toEqual({ sort: 'article' }));
    expect(bodyRows(table).map((row) => row[0]?.slice(0, 7))).toEqual([
      '20-1001',
      '20-1002',
      '20-1003',
      '20-1004',
      '20-1005',
      '30-2011',
      '30-2014',
      '30-2020',
      '30-2030',
    ]);
    expect(statusLine()).toMatch(/Sorted by article, ascending\./);
  });

  it('#729 ST1 says no article matches when the picked warehouse holds none, not that no stock came', async () => {
    renderPlanningAt(withSearch(stock, { warehouse: 'A-QH', kind: 'finished' }));
    await screen.findByRole('heading', { level: 2, name: 'No articles match these filters' });
    expect(screen.getByRole('button', { name: 'Remove the warehouse filter' })).toBeTruthy();
  });

  it('#729 ST4 to ST7 show the loading, empty, failed and no-access states', async () => {
    renderPlanningAt(withSearch(stock, { preview: 'loading' }));
    const table = await screen.findByRole('table', { name: 'Stock of the plant by article' });
    expect(table.getAttribute('aria-busy')).toBe('true');

    cleanup();
    renderPlanningAt(withSearch(stock, { preview: 'empty' }));
    await screen.findByRole('heading', { level: 2, name: 'No stock from the ERP yet' });

    cleanup();
    renderPlanningAt(withSearch(stock, { preview: 'error' }));
    await screen.findByRole('heading', { level: 2, name: 'Could not load the stock' });
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();

    cleanup();
    renderPlanningAt(withSearch(stock, { preview: 'forbidden' }));
    await screen.findByRole('heading', {
      level: 2,
      name: 'You need the permission to read stock at this plant',
    });
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('the stock of one article (design #729, SA1 to SA3)', () => {
  it('#729 SA1 shows the balance per warehouse of the plant and its sum', async () => {
    renderPlanningAt(roundBar);
    await screen.findByRole('heading', { level: 1, name: 'Round bar 36 C45' });

    expect(screen.getByText('Material short for 1004.10')).toBeTruthy();
    const balances = screen.getByRole('table', { name: 'Balance per warehouse' });
    expect(bodyRows(balances)).toEqual([
      ['A-QH', 'Quality hold A', '14 m'],
      ['A-RM', 'Raw materials A', '72 m'],
      ['A-WIP', 'Production floor A', '6 m'],
    ]);
    expect(balances.querySelector('tfoot')?.textContent).toBe('Plant A, counted92 m');
    expect(
      screen.getByText(
        'Stock unit m. Stock and planned movements are read-only in NorthMES. ERP data as of Mon 2 Nov 06:40; the next stock import is due at 09:55.',
        { exact: false },
      ),
    ).toBeTruthy();
  });

  it('#729 SA1 says in words what the projected balance does, beside the chart', async () => {
    renderPlanningAt(roundBar);
    await screen.findByRole('heading', { level: 1, name: 'Round bar 36 C45' });

    const figure = screen.getByRole('figure', { name: /^Falls below zero/ });
    expect(within(figure).getByText(/^Falls below zero/).textContent).toBe(
      'Falls below zero on Thu 5 Nov 06:00 at −26 m, when 1004.10 consumes 102 m, and is back at 94 m on Mon 9 Nov with Purchase order 7740. Purchase requisition 3301 (dashed ring, Fri 6 Nov) is not counted.',
    );
  });

  it('#729 SA1 lists every planned movement with where its date comes from and the running balance', async () => {
    renderPlanningAt(roundBar);
    const table = await screen.findByRole('table', {
      name: 'Planned movements of Round bar 36 C45 with the projected balance',
    });

    expect(bodyRows(table)).toEqual([
      ['Mon 2 Nov 06:40', 'ERP balance', 'In stock', 'Sum of 3 warehouses', '', '', '92 m'],
      [
        'Mon 2 Nov 09:40',
        'Now, overdueERP date Fri 30 Oct',
        'Purchase',
        'Purchase order 7712',
        'A-RM',
        '+20 m',
        '112 m',
      ],
      ['Tue 3 Nov', 'ERP date', 'Transfer in', 'Transfer 5520', 'A-WIP', '+30 m', '142 m'],
      ['Tue 3 Nov', 'ERP date', 'Transfer out', 'Transfer 5520', 'A-RM', '−30 m', '112 m'],
      [
        'Wed 4 Nov 08:00',
        'Setup start of 1003.10',
        'Consumption',
        '1003.10 Turn, Gear blank 32',
        'A-RM',
        '−36 m',
        '76 m',
      ],
      [
        'Thu 5 Nov 06:00',
        'Setup start of 1004.10',
        'Consumption',
        '1004.10 Turn, Hub 12',
        'A-RM',
        '−102 m',
        '−26 mBelow zero',
      ],
      [
        'Fri 6 Nov',
        'ERP date',
        'Purchase requisition',
        'Purchase requisition 3301',
        'A-RM',
        '+60 m',
        'Not counted',
      ],
      ['Mon 9 Nov', 'ERP date', 'Purchase', 'Purchase order 7740', 'A-RM', '+120 m', '94 m'],
    ]);
  });

  it('#729 SA1 names the late order that brings a finished article back from below zero', async () => {
    renderPlanningAt(planningLinks.stock.article({ plant, articleId: '20-1003' }).href);
    await screen.findByRole('heading', { level: 1, name: 'Gear blank 32' });

    expect(screen.getByText('Late order 1003')).toBeTruthy();
    expect(screen.getByRole('figure', { name: /^Falls below zero/ }).textContent).toContain(
      'Falls below zero on Wed 4 Nov at −600 pcs, when customer order 40208 line 1 takes 600 pcs, and is back at 0 pcs on Thu 5 Nov 06:15 with 1003.',
    );
  });

  it('#729 SA3 lists the output and the customer demand of Bracket L, which never goes below zero', async () => {
    renderPlanningAt(planningLinks.stock.article({ plant, articleId: '20-1001' }).href);
    const table = await screen.findByRole('table', {
      name: 'Planned movements of Bracket L with the projected balance',
    });

    expect(bodyRows(table).map((row) => [row[2], row[3], row[5], row[6]])).toEqual([
      ['In stock', 'Sum of 1 warehouse', '', '40 pcs'],
      ['Output', 'Production order 1001', '+600 pcs', '640 pcs'],
      [
        'Customer demand',
        'Customer order 40211 line 1, Hallberg Verkstad AB',
        '−400 pcs',
        '240 pcs',
      ],
      ['Customer demand', 'Customer order 40219 line 1, Svea Komponent AB', '−200 pcs', '40 pcs'],
      ['Output', 'Production order 1005', '+600 pcs', '640 pcs'],
      [
        'Customer demand',
        'Customer order 40223 line 1, Hallberg Verkstad AB',
        '−300 pcs',
        '340 pcs',
      ],
    ]);
    expect(
      screen.getByRole('figure', { name: 'The balance stays at 40 pcs or more.' }),
    ).toBeTruthy();
  });

  it('#729 SA1 says an article does not exist, with the way back to Stock', async () => {
    renderPlanningAt(planningLinks.stock.article({ plant, articleId: '99-0000' }).href);
    await screen.findByRole('heading', {
      level: 2,
      name: 'This article has no stock at this plant or does not exist',
    });
    expect(screen.getByRole('link', { name: 'Back to Stock' }).getAttribute('href')).toBe(stock);
  });
});
