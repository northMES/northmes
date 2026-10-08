// SPDX-License-Identifier: AGPL-3.0-or-later
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreArticles } from '../../../src/modules/core/articles.graphql.ts';
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

  it('E06-S06 while the articles load, the table keeps its header and marks itself busy over skeleton rows', async () => {
    renderCoreAt(coreLinks.articles({ plant }).href, [
      articlesQuery(firstPage, articlesPage(articleRange(3), { totalCount: 3 }), 50),
    ]);

    const table = await screen.findByRole('table', { name: 'Articles' });
    expect(table.getAttribute('aria-busy')).toBe('true');
    expect(within(table).getByRole('button', { name: 'Article number' })).toBeDefined();
    await waitFor(() => expect(table.getAttribute('aria-busy')).toBeNull());
    expect(bodyRows(table).map(([code]) => code)).toEqual(['AX-500', 'AX-501', 'AX-502']);
  });

  it('E06-S06 a plant without articles shows No articles yet with New article', async () => {
    renderCoreAt(coreLinks.articles({ plant }).href, [
      articlesQuery(firstPage, articlesPage([], { totalCount: 0 })),
    ]);

    expect(await screen.findByRole('heading', { level: 2, name: 'No articles yet' })).toBeDefined();
    expect(
      screen.getByText(
        'Articles come from an import or are created here. Create the first one, or wait for the next import.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
    const actions = screen
      .getAllByRole('link', { name: 'New article' })
      .map((link) => link.getAttribute('href'));
    expect(actions).toContain(coreLinks.articles.new({ plant }).href);
  });

  it('E06-S06 a failed load shows Could not load articles, and Try again loads the articles', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.articles({ plant }).href, [
      {
        request: { query: CoreArticles, variables: firstPage },
        error: new Error('Failed to fetch'),
      },
      articlesQuery(firstPage, articlesPage(articleRange(2), { totalCount: 2 })),
    ]);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('heading', { name: 'Could not load articles' })).toBeDefined();
    expect(within(alert).getByText('Check the connection, then try again.')).toBeDefined();
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));

    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(2));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
