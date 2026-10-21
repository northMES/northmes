// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { plant, renderCoreAt } from './core-app.tsx';

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

/** An href with a search. */
function withSearch(href: string, search: Record<string, string>): string {
  return `${href}?${new URLSearchParams(search).toString()}`;
}

const tools = coreLinks.tools({ plant }).href;

describe('the tools register (design #729, TO1 to TO8)', () => {
  it('#729 TO1 lists the tools of the company and the plant with the operations that allow each, and the one the import created', async () => {
    renderCoreAt(tools, []);
    const table = await screen.findByRole('table', { name: 'Tools of Acme AB and Plant A' });

    expect(bodyRows(table).map((row) => row.slice(0, 6))).toEqual([
      [
        'T-118',
        'Soft jaws 40',
        'Acme AB',
        '3',
        'Bracket L 10, Gear blank 32 10, Hub 12 10',
        'From the ERP',
      ],
      ['T-204', 'Form tool BR-L', 'Acme AB', '1', 'Bracket L 10', 'From the ERP'],
      ['T-311', 'Fixture BR-L 2-up', 'Plant A', '1', 'Bracket L 20', 'From the ERP'],
      ['T-312', 'Fixture HP 1-up', 'Plant A', '1', 'Housing P 10', 'From the ERP'],
      ['T-415', 'Collet 12', 'Acme AB', '1', 'Shaft 8 10', 'From the ERP'],
      [
        'T-905',
        'T-905Created by the importHub 12 operation 20 names it. Give it a name.',
        'Plant A',
        '1',
        'Hub 12 20',
        'Code from the ERP',
      ],
    ]);
    expect(statusLine()).toBe(
      '6 tools, 1 created by the import. Sorted by code. Used in counts the routing operations that allow the tool.',
    );
    expect(screen.getByRole('note').textContent).toBe(
      'The import created 1 tool it did not know: T-905.An operation from the ERP named a tool code that NorthMES did not have, so the import created it with the code as its name.',
    );
    expect(within(table).getByRole('link', { name: 'T-311' }).getAttribute('href')).toBe(
      coreLinks.tools.tool({ plant, toolCode: 'T-311' }).href,
    );
    expect(screen.getByRole('button', { name: 'New tool' }).hasAttribute('disabled')).toBe(true);
  });

  it('#729 TO1 filters by scope and source and keeps the unused tools in the URL', async () => {
    const router = renderCoreAt(withSearch(tools, { scope: 'plant' }), []);
    const table = await screen.findByRole('table', { name: 'Tools of Acme AB and Plant A' });
    expect(bodyRows(table).map((row) => row[0])).toEqual(['T-311', 'T-312', 'T-905']);

    cleanup();
    renderCoreAt(withSearch(tools, { source: 'import' }), []);
    const imported = await screen.findByRole('table', { name: 'Tools of Acme AB and Plant A' });
    expect(bodyRows(imported).map((row) => row[0])).toEqual(['T-905']);

    cleanup();
    const unused = renderCoreAt(tools, []);
    await screen.findByRole('table', { name: 'Tools of Acme AB and Plant A' });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Not used only' }));
    await waitFor(() => expect(unused.state.location.search).toEqual({ unused: 1 }));
    await screen.findByRole('heading', { level: 2, name: 'No tools match these filters' });
    expect(router).toBeDefined();
  });

  it('#729 TO5 to TO8 show the loading, empty, failed and no-access states', async () => {
    renderCoreAt(withSearch(tools, { preview: 'loading' }), []);
    expect(
      (
        await screen.findByRole('table', { name: 'Tools of the company and the plant' })
      ).getAttribute('aria-busy'),
    ).toBe('true');

    cleanup();
    renderCoreAt(withSearch(tools, { preview: 'empty' }), []);
    await screen.findByRole('heading', { level: 2, name: 'No tools yet' });

    cleanup();
    renderCoreAt(withSearch(tools, { preview: 'error' }), []);
    await screen.findByRole('heading', { level: 2, name: 'Could not load tools' });

    cleanup();
    renderCoreAt(withSearch(tools, { preview: 'forbidden' }), []);
    await screen.findByRole('heading', {
      level: 2,
      name: 'You need the permission to read master data',
    });
  });
});

describe("a tool's page (design #729, TO4)", () => {
  it('#729 TO4 says where T-311 comes from and the routing operations that allow it, with its override', async () => {
    renderCoreAt(coreLinks.tools.tool({ plant, toolCode: 'T-311' }).href, []);
    await screen.findByRole('heading', { level: 1, name: 'Tool T-311' });

    expect(screen.getByText('Fixture BR-L 2-up', { selector: 'span' })).toBeTruthy();
    expect(
      screen.getByText('From the ERP. Imported Thu 8 Oct 06:40 with the routing of Bracket L.'),
    ).toBeTruthy();
    const operations = screen.getByRole('table', { name: 'Routing operations that allow T-311' });
    expect(bodyRows(operations)).toEqual([
      ['Bracket L20-1001', '20 Mill', '2 instead of 1', 'CNC 2 (default), Mill 1', '1001, 1005'],
    ]);
    expect(within(operations).getByRole('link', { name: 'Bracket L' }).getAttribute('href')).toBe(
      coreLinks.routings.routing({ plant, articleNumber: '20-1001' }).href,
    );
    expect(screen.getByText(/^No job order uses T-311 in W45\./)).toBeTruthy();
  });

  it('#729 TO4 says a tool does not exist, with the way back to Tools', async () => {
    renderCoreAt(coreLinks.tools.tool({ plant, toolCode: 'T-000' }).href, []);
    await screen.findByRole('heading', {
      level: 2,
      name: 'This tool does not exist or you cannot see it',
    });
    expect(screen.getByRole('link', { name: 'Back to Tools' }).getAttribute('href')).toBe(tools);
  });
});
