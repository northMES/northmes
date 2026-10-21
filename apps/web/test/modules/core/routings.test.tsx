// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { planningLinks } from '@northmes/planning-contracts';
import { cleanup, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { viewerQuery } from './access-fixtures.ts';
import { article, articleQuery, plant, renderCoreAt } from './core-app.tsx';

afterEach(cleanup);

/** The text of each cell of a table's own body rows. */
function bodyRows(table: HTMLElement): string[][] {
  return Array.from(table.querySelectorAll(':scope > tbody > tr')).map((row) =>
    Array.from(row.querySelectorAll(':scope > td')).map((cell) => cell.textContent ?? ''),
  );
}

/** An href with a search. */
function withSearch(href: string, search: Record<string, string>): string {
  return `${href}?${new URLSearchParams(search).toString()}`;
}

const routings = coreLinks.routings({ plant }).href;
const bracket = coreLinks.routings.routing({ plant, articleId: '20-1001' }).href;

describe('the routings register (design #729)', () => {
  it('#729 lists the routing of each article with its operations, version and kept operations', async () => {
    renderCoreAt(routings, []);
    const table = await screen.findByRole('table', { name: 'Routings' });

    expect(bodyRows(table)).toEqual([
      ['20-1001Bracket L', '2', '3', '1 kept in NorthMES'],
      ['20-1002Housing P', '1', '1', 'None'],
      ['20-1003Gear blank 32', '2', '2', 'None'],
      ['20-1004Hub 12', '2', '1', 'None'],
      ['20-1005Shaft 8', '1', '1', 'None'],
    ]);
    expect(within(table).getByRole('link', { name: '20-1001' }).getAttribute('href')).toBe(bracket);
  });
});

describe("an article's routing (design #729, RO1 to RO8)", () => {
  it('#729 RO1 lists the operations with every rate field, inherited values and the source of each', async () => {
    renderCoreAt(bracket, []);
    await screen.findByRole('heading', { level: 1, name: 'Bracket L' });

    expect(
      screen.getByText(
        'Active routing, ERP routing version 3, imported Mon 2 Nov 06:40. One active routing per article.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Show stock' }).getAttribute('href')).toBe(
      planningLinks.stock.article({ plant, articleId: '20-1001' }).href,
    );
    const operations = screen.getByRole('table', {
      name: 'Operations of Bracket L in routing sequence',
    });
    expect(bodyRows(operations).map((row) => row.slice(0, 12))).toEqual([
      [
        '10',
        'Turn',
        '30 sentered as 120 pcs/h',
        '30 min',
        '0',
        '85 %',
        '1',
        '1',
        'None',
        'None',
        'CNC 1, default2 allowed',
        'From the ERP',
      ],
      [
        '20',
        'Mill',
        '60 s',
        '0',
        '0',
        '80 %',
        '1',
        '1',
        '1 h',
        'None',
        'CNC 2, default2 allowed',
        'Kept in NorthMES',
      ],
    ]);
    expect(
      within(operations)
        .getAllByRole('link', { name: /^Edit operation/ })[1]
        ?.getAttribute('href'),
    ).toBe(
      coreLinks.routings.routing.editOperation({ plant, articleId: '20-1001', sequence: '20' })
        .href,
    );
  });

  it("#729 RO1 shows operation 20's machines with their overrides, its tool and why it is kept in NorthMES", async () => {
    renderCoreAt(bracket, []);
    const section = await screen.findByRole('region', { name: 'Operation 20 Mill' });

    expect(section.textContent).toContain(
      'Kept in NorthMES since Wed 28 Oct 14:05, by Alex Lund. The import leaves this operation unchanged.',
    );
    expect(section.textContent).toContain(
      "Lead time changed from the ERP's 30 min to 1 h. Reason: Parts are deburred by hand between turning and milling.",
    );
    const machines = within(section).getByRole('table', {
      name: 'Allowed machines of operation 20',
    });
    expect(bodyRows(machines)).toEqual([
      ['CNC 2CNC2', 'Default', '60 s', '1', '1', '0', 'From the ERP'],
      ['Mill 1MILL1', '', '45 s', '1', '1', '0', 'Set in NorthMES'],
    ]);
    const tools = within(section).getByRole('table', { name: 'Tools of operation 20' });
    expect(bodyRows(tools)).toEqual([['T-311', 'Fixture BR-L 2-up', '2', 'From the ERP']]);
    expect(section.textContent).toContain('Operation 20 consumes no material.');
  });

  it('#729 RO1 computes the planned duration with the source of each input, and again for another machine and tool', async () => {
    renderCoreAt(bracket, []);
    const section = await screen.findByRole('region', { name: 'Operation 20 Mill' });
    const panel = within(section).getByRole('group', { name: 'Planned duration of operation 20' });

    expect(panel.textContent).toContain('run = ceil(600 × 1 ÷ 1) × 60 ÷ 1 = 36000 s');
    expect(within(panel).getByText('Planned time').nextElementSibling?.textContent).toBe('10 h');
    const others = within(panel).getByRole('table', { name: 'Planned time on the other choices' });
    expect(bodyRows(others)).toEqual([
      ['CNC 2 with T-311', '300', '5 h'],
      ['Mill 1', '600', '7 h 30 min'],
      ['Mill 1 with T-311', '300', '3 h 45 min'],
    ]);

    await userEvent.selectOptions(
      within(panel).getByRole('combobox', { name: 'Machine' }),
      'MILL1',
    );
    await userEvent.selectOptions(within(panel).getByRole('combobox', { name: 'Tool' }), 'T-311');
    expect(within(panel).getByText('Planned time').nextElementSibling?.textContent).toBe(
      '3 h 45 min',
    );
    expect(within(panel).getByText('Pieces per cycle').parentElement?.textContent).toContain(
      'Tool',
    );
  });

  it('#729 RO5 to RO8 show the loading, failed and no-access states, and an article without a routing', async () => {
    renderCoreAt(withSearch(bracket, { preview: 'loading' }), []);
    await screen.findByRole('heading', { level: 1, name: 'Routing' });
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();

    cleanup();
    renderCoreAt(withSearch(bracket, { preview: 'error' }), []);
    await screen.findByRole('heading', { level: 2, name: 'Could not load the routing' });

    cleanup();
    renderCoreAt(withSearch(bracket, { preview: 'forbidden' }), []);
    await screen.findByRole('heading', {
      level: 2,
      name: 'You need the permission to read routings at this plant',
    });

    cleanup();
    renderCoreAt(withSearch(bracket, { preview: 'empty' }), []);
    await screen.findByRole('heading', { level: 2, name: 'This article has no routing' });
  });
});

describe('the edit form of a routing operation (design #729, RO4)', () => {
  it('#729 RO4 shows operation 20 with Keep NorthMES values on, the ERP lead time, its machines and the reason; Save waits for the API', async () => {
    renderCoreAt(
      coreLinks.routings.routing.editOperation({ plant, articleId: '20-1001', sequence: '20' })
        .href,
      [],
    );
    await screen.findByRole('heading', { level: 1, name: 'Edit operation 20 Mill' });

    expect(
      screen
        .getByRole('checkbox', { name: 'Keep NorthMES values for this operation' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect((screen.getByLabelText(/^Operation number/) as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByRole('textbox', { name: 'Lead time' }) as HTMLInputElement).value).toBe(
      '1',
    );
    expect(
      screen.getByText('The ERP sends 30 min. Waiting time before this operation, elapsed.'),
    ).toBeTruthy();
    const machines = screen.getByRole('table', { name: 'Allowed machines of operation 20' });
    expect(bodyRows(machines).map((row) => row[0])).toEqual(['CNC 2CNC2', 'Mill 1MILL1']);
    expect(
      (screen.getByRole('textbox', { name: /^Reason for the change/ }) as HTMLTextAreaElement)
        .value,
    ).toBe('Parts are deburred by hand between turning and milling');
    expect(screen.getByRole('button', { name: 'Save operation' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe(bracket);
  });
});

describe('the Routing section of an article page (design #729, RO6)', () => {
  it('#729 leads from an article with a routing to it, and says when an article has none', async () => {
    const bracketArticle = article('20-1001', 'Bracket L');
    renderCoreAt(coreLinks.articles.article({ plant, articleId: bracketArticle.id }).href, [
      articleQuery(bracketArticle),
      viewerQuery(['core.article:read']),
    ]);
    const section = await screen.findByRole('region', { name: 'Routing' });
    expect(
      within(section)
        .getByRole('link', { name: 'Open the routing of Bracket L' })
        .getAttribute('href'),
    ).toBe(bracket);

    cleanup();
    const axle = article('AX-500', 'Axle 20 mm');
    renderCoreAt(coreLinks.articles.article({ plant, articleId: axle.id }).href, [
      articleQuery(axle),
      viewerQuery(['core.article:read']),
    ]);
    const none = await screen.findByRole('region', { name: 'Routing' });
    expect(none.textContent).toContain('Axle 20 mm has no routing');
  });
});
