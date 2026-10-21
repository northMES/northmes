// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { companyId } from './access-fixtures.ts';
import { renderCoreAt } from './core-app.tsx';

afterEach(cleanup);

/** The text of each cell of a table's own body rows. */
function bodyRows(table: HTMLElement): string[][] {
  return Array.from(table.querySelectorAll(':scope > tbody > tr')).map((row) =>
    Array.from(row.querySelectorAll(':scope > td')).map((cell) => cell.textContent ?? ''),
  );
}

/** The status line above the list. */
function statusLine(): string {
  return document.querySelector('[data-list-status]')?.textContent ?? '';
}

const warehouses = coreLinks.settings.warehouses({ companyId }).href;

/** The warehouses href with a search. */
function withSearch(search: Record<string, string>): string {
  return `${warehouses}?${new URLSearchParams(search).toString()}`;
}

describe('the warehouses register in company settings (design #729, WH1 to WH6)', () => {
  it('#729 WH1 lists the warehouses by code with their external code, plant and stock rows', async () => {
    renderCoreAt(warehouses, []);
    const table = await screen.findByRole('table', { name: 'Warehouses' });

    expect(bodyRows(table).map((row) => row.slice(0, 5))).toEqual([
      ['A-FG', 'Finished goods A', '110From the ERP', 'Plant A', '3'],
      ['A-QH', 'Quality hold A', '190From the ERP', 'Plant A', '1'],
      ['A-RM', 'Raw materials A', '100From the ERP', 'Plant A', '4'],
      ['A-WIP', 'Production floor A', '120From the ERP', 'Plant A', '1'],
      ['B-FG', 'Finished goods B', '210From the ERP', 'Plant B', '2'],
      ['B-RM', 'Raw materials B', '200From the ERP', 'Plant B', '2'],
      [
        'CON',
        'Consignment stock',
        '900From the ERP',
        'Not mappedOrders go to the default plant, Plant A. Stock is not counted.',
        '2',
      ],
    ]);
    expect(statusLine()).toBe('7 warehouses, 6 mapped to a plant, 1 not mapped. Sorted by code.');
    expect(screen.getByText('ERP data as of Mon 2 Nov 06:40')).toBeTruthy();
    expect(screen.getByRole('note').textContent).toBe(
      'Warehouses come from the ERP with the stock import.Map each warehouse to the plant whose orders and stock it holds. Stock counts for the material warnings of that plant only. Code, name and external code stay as the ERP sends them.',
    );
    expect(screen.getByRole('button', { name: 'New warehouse' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(
      within(table).getByRole('button', { name: 'Map to plant, CON' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('#729 WH1 keeps the warehouses not mapped, then those of one plant, in the URL', async () => {
    const router = renderCoreAt(warehouses, []);
    const table = await screen.findByRole('table', { name: 'Warehouses' });

    await userEvent.click(screen.getByRole('checkbox', { name: 'Not mapped only' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ unmapped: 1 }));
    expect(bodyRows(table).map((row) => row[0])).toEqual(['CON']);

    cleanup();
    renderCoreAt(withSearch({ plant: 'plant-b' }), []);
    const plantB = await screen.findByRole('table', { name: 'Warehouses' });
    expect(bodyRows(plantB).map((row) => row[0])).toEqual(['B-FG', 'B-RM']);
    expect(screen.getByRole('button', { name: 'Remove the plant filter' })).toBeTruthy();
  });

  it('#729 WH3 to WH6 show the loading, empty, failed and no-access states', async () => {
    renderCoreAt(withSearch({ preview: 'loading' }), []);
    expect(
      (await screen.findByRole('table', { name: 'Warehouses' })).getAttribute('aria-busy'),
    ).toBe('true');

    cleanup();
    renderCoreAt(withSearch({ preview: 'empty' }), []);
    await screen.findByRole('heading', { level: 2, name: 'No warehouses yet' });

    cleanup();
    renderCoreAt(withSearch({ preview: 'error' }), []);
    await screen.findByRole('heading', { level: 2, name: 'Could not load warehouses' });

    cleanup();
    renderCoreAt(withSearch({ preview: 'forbidden' }), []);
    await screen.findByRole('heading', {
      level: 2,
      name: "You need the permission to manage this company's warehouses",
    });
    expect(screen.queryByRole('table')).toBeNull();
  });
});
