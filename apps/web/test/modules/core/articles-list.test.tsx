// SPDX-License-Identifier: AGPL-3.0-or-later
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  articleRange,
  articlesPage,
  articlesQuery,
  firstPage,
  plant,
  renderCoreAt,
} from './core-app.tsx';

afterEach(cleanup);

/** The text of each cell of each body row of the table. */
function bodyRows(table: HTMLElement): (string | null)[][] {
  const [, ...rows] = within(table).getAllByRole('row');
  return rows.map((row) =>
    within(row)
      .getAllByRole('cell')
      .map((cell) => cell.textContent),
  );
}

describe('articles list', () => {
  it('E06-S06 the articles list shows the first 25 articles by article number with the row range, each number a link to its article', async () => {
    const articles = articleRange(25);
    renderCoreAt(coreLinks.articles({ plant }).href, [
      articlesQuery(firstPage, articlesPage(articles, { totalCount: 60, hasNextPage: true })),
    ]);

    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(25));
    expect(bodyRows(table)[0]).toEqual(['AX-500', 'Axle 500 mm']);
    expect(bodyRows(table)[24]).toEqual(['AX-524', 'Axle 524 mm']);
    expect(within(table).getByRole('link', { name: 'AX-500' }).getAttribute('href')).toBe(
      coreLinks.articles.article({ plant, articleId: articles[0]?.id ?? '' }).href,
    );
    expect(
      within(table).getByRole('columnheader', { name: 'Article number' }).getAttribute('aria-sort'),
    ).toBe('ascending');
    expect(screen.getByText('Rows 1 to 25 of 60')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Previous' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('heading', { level: 1, name: 'Articles' })).toBeDefined();
    expect(document.title).toBe('Articles · NorthMES');
    expect(screen.getByRole('link', { name: 'New article' }).getAttribute('href')).toBe(
      coreLinks.articles.new({ plant }).href,
    );
  });
});
