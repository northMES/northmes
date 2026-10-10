// SPDX-License-Identifier: AGPL-3.0-or-later
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreArticles } from '../../../src/modules/core/screens/articles/articles.graphql.ts';
import {
  articleRange,
  articlesPage,
  articlesQuery,
  bodyRows,
  firstPage,
  lastChangedText,
  plant,
  renderCoreAt,
  watchForSkeletonRows,
} from './core-app.tsx';

afterEach(cleanup);

const byName = (direction: 'ASC' | 'DESC') => [{ field: 'NAME', direction }];
const byCode = (direction: 'ASC' | 'DESC') => [{ field: 'CODE', direction }];
const byChange = (direction: 'ASC' | 'DESC') => [{ field: 'UPDATED_AT', direction }];

/** The articles list's href with this search. */
function listHref(search: Record<string, string> = {}): string {
  return coreLinks.articles({ plant }, search).href;
}

/** The aria-sort of a column header of the table. */
function ariaSort(table: HTMLElement, name: string): string | null {
  return within(table).getByRole('columnheader', { name }).getAttribute('aria-sort');
}

describe('articles list URL state', () => {
  it('E06-S06 a sort header sorts by name ascending, then descending, in the URL and the query, and focus stays on it', async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(listHref(), [
      articlesQuery(firstPage, articlesPage(articleRange(2), { totalCount: 2 })),
      articlesQuery(
        { first: 25, orderBy: byName('ASC') },
        articlesPage(articleRange(2, 700), { totalCount: 2 }),
      ),
      articlesQuery(
        { first: 25, orderBy: byName('DESC') },
        articlesPage(articleRange(2, 800), { totalCount: 2 }),
      ),
    ]);
    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(2));

    const nameHeader = within(table).getByRole('button', { name: 'Name' });
    await user.click(nameHeader);

    await waitFor(() => expect(bodyRows(table)[0]?.[0]).toBe('AX-700'));
    expect(router.state.location.href).toBe(listHref({ sort: 'name' }));
    expect(ariaSort(table, 'Name')).toBe('ascending');
    expect(ariaSort(table, 'Article number')).toBe('none');
    expect(document.activeElement).toBe(nameHeader);

    await user.click(nameHeader);

    await waitFor(() => expect(bodyRows(table)[0]?.[0]).toBe('AX-800'));
    expect(router.state.location.href).toBe(listHref({ sort: '-name' }));
    expect(ariaSort(table, 'Name')).toBe('descending');
    expect(document.activeElement).toBe(nameHeader);
  });

  it('E06-S06 a copied link with search, sort and page opens the same rows', async () => {
    const rows = articleRange(25, 525);
    renderCoreAt(listHref({ q: 'axle', sort: '-name', page: '2', after: 'cursor-AX-524' }), [
      articlesQuery(
        { first: 25, after: 'cursor-AX-524', orderBy: byName('DESC'), search: 'axle' },
        articlesPage(rows, { totalCount: 60, hasNextPage: true, hasPreviousPage: true }),
      ),
    ]);

    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(25));
    expect(bodyRows(table)[0]).toEqual(['AX-525', 'Axle 525 mm', 'Plant A', lastChangedText]);
    expect(screen.getByText('Rows 26 to 50 of 60')).toBeDefined();
    expect(ariaSort(table, 'Name')).toBe('descending');
    expect(
      (screen.getByRole('searchbox', { name: 'Search articles' }) as HTMLInputElement).value,
    ).toBe('axle');
    expect(screen.getByRole('button', { name: 'Previous' }).hasAttribute('disabled')).toBe(false);
  });

  it('E06-S06 a link setting that does not apply falls back to its default alone', async () => {
    renderCoreAt(listHref({ q: 'axle', sort: 'weight', page: 'two', after: 'cursor-AX-524' }), [
      articlesQuery(
        { ...firstPage, search: 'axle' },
        articlesPage(articleRange(3), { totalCount: 3 }),
      ),
    ]);

    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(3));
    expect(ariaSort(table, 'Last changed')).toBe('descending');
    expect(screen.getByText('Rows 1 to 3 of 3')).toBeDefined();
  });

  it('E06-S06 searching puts the trimmed text in q after a pause and starts again from the first page, with focus in the field', async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(listHref({ page: '2', after: 'cursor-AX-524' }), [
      articlesQuery(
        { first: 25, after: 'cursor-AX-524', orderBy: firstPage.orderBy },
        articlesPage(articleRange(25, 525), { totalCount: 60, hasNextPage: true }),
      ),
      articlesQuery(
        { ...firstPage, search: 'hinge' },
        articlesPage(articleRange(1, 900), { totalCount: 1 }),
      ),
    ]);
    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(25));

    const search = screen.getByRole('searchbox', { name: 'Search articles' });
    await user.type(search, ' hinge ');

    await waitFor(() =>
      expect(bodyRows(table)).toEqual([['AX-900', 'Axle 900 mm', 'Plant A', lastChangedText]]),
    );
    expect(router.state.location.href).toBe(listHref({ q: 'hinge' }));
    expect(screen.getByText('Rows 1 to 1 of 1')).toBeDefined();
    expect(document.activeElement).toBe(search);
  });

  it('E06-S06 while a search loads, the table keeps the rows it shows and is busy, with focus in the field, until the matching rows replace them (ui-222, LI7)', async () => {
    const user = userEvent.setup();
    renderCoreAt(listHref(), [
      articlesQuery(firstPage, articlesPage(articleRange(3), { totalCount: 3 })),
      articlesQuery(
        { ...firstPage, search: 'hinge' },
        articlesPage(articleRange(1, 900), { totalCount: 1 }),
        200,
      ),
    ]);
    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(3));

    const search = screen.getByRole('searchbox', { name: 'Search articles' });
    await user.type(search, 'hinge');

    await waitFor(() => expect(table.getAttribute('aria-busy')).toBe('true'));
    expect(screen.getByRole('table', { name: 'Articles' })).toBe(table);
    expect(bodyRows(table).map(([code]) => code)).toEqual(['AX-500', 'AX-501', 'AX-502']);
    expect(screen.getByText('Rows 1 to 3 of 3')).toBeDefined();
    expect(document.activeElement).toBe(search);

    await waitFor(() =>
      expect(bodyRows(table)).toEqual([['AX-900', 'Axle 900 mm', 'Plant A', lastChangedText]]),
    );
    expect(table.getAttribute('aria-busy')).toBeNull();
    expect(screen.getByText('Rows 1 to 1 of 1')).toBeDefined();
    expect(document.activeElement).toBe(search);
  });

  it('E06-S06 a search that fails shows Could not load articles in place of the rows it kept', async () => {
    const user = userEvent.setup();
    renderCoreAt(listHref(), [
      articlesQuery(firstPage, articlesPage(articleRange(3), { totalCount: 3 })),
      {
        request: { query: CoreArticles, variables: { ...firstPage, search: 'hinge' } },
        error: new Error('Network down'),
        delay: 50,
      },
    ]);
    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(3));

    await user.type(screen.getByRole('searchbox', { name: 'Search articles' }), 'hinge');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Could not load articles' }),
    ).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('E06-S06 Next adds page and after to the URL and Previous returns to the first page, with focus on the button used', async () => {
    const user = userEvent.setup();
    const first = articleRange(25);
    const second = articleRange(25, 525);
    const router = renderCoreAt(listHref(), [
      articlesQuery(firstPage, articlesPage(first, { totalCount: 60, hasNextPage: true })),
      articlesQuery(
        { first: 25, after: 'cursor-AX-524', orderBy: firstPage.orderBy },
        articlesPage(second, { totalCount: 60, hasNextPage: true, hasPreviousPage: true }),
      ),
      // The first page again, which the list asks the network for after the cache answered it.
      articlesQuery(firstPage, articlesPage(first, { totalCount: 60, hasNextPage: true })),
    ]);
    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(25));

    const next = screen.getByRole('button', { name: 'Next' });
    await user.click(next);

    await waitFor(() => expect(bodyRows(table)[0]?.[0]).toBe('AX-525'));
    expect(router.state.location.href).toBe(listHref({ page: '2', after: 'cursor-AX-524' }));
    expect(screen.getByText('Rows 26 to 50 of 60')).toBeDefined();
    expect(document.activeElement).toBe(next);

    const previous = screen.getByRole('button', { name: 'Previous' });
    await user.click(previous);

    await waitFor(() => expect(bodyRows(table)[0]?.[0]).toBe('AX-500'));
    expect(router.state.location.href).toBe(listHref());
    expect(screen.getByText('Rows 1 to 25 of 60')).toBeDefined();
    // Previous is disabled on the first page, so focus moved to Next.
    expect(document.activeElement).toBe(next);
  });

  it('E06-S06 Previous from the third page asks for the 25 articles before the first row', async () => {
    const user = userEvent.setup();
    const third = articleRange(10, 550);
    const router = renderCoreAt(listHref({ page: '3', after: 'cursor-AX-549' }), [
      articlesQuery(
        { first: 25, after: 'cursor-AX-549', orderBy: firstPage.orderBy },
        articlesPage(third, { totalCount: 60, hasPreviousPage: true }),
      ),
      articlesQuery(
        { last: 25, before: 'cursor-AX-550', orderBy: firstPage.orderBy },
        articlesPage(articleRange(25, 525), {
          totalCount: 60,
          hasNextPage: true,
          hasPreviousPage: true,
        }),
      ),
    ]);
    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(10));
    expect(screen.getByText('Rows 51 to 60 of 60')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Previous' }));

    await waitFor(() => expect(bodyRows(table)[0]?.[0]).toBe('AX-525'));
    expect(router.state.location.href).toBe(listHref({ page: '2', before: 'cursor-AX-550' }));
    expect(screen.getByText('Rows 26 to 50 of 60')).toBeDefined();
  });

  it('E06-S06 a search without matches shows No articles match these filters, and Clear filters empties the search with focus in it', async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(listHref({ q: 'zz-404' }), [
      articlesQuery({ ...firstPage, search: 'zz-404' }, articlesPage([], { totalCount: 0 })),
      articlesQuery(firstPage, articlesPage(articleRange(2), { totalCount: 2 })),
    ]);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'No articles match these filters' }),
    ).toBeDefined();
    expect(screen.getByText('Change or clear the filters to see articles again.')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(2));
    expect(router.state.location.href).toBe(listHref());
    const search = screen.getByRole('searchbox', { name: 'Search articles' });
    expect((search as HTMLInputElement).value).toBe('');
    expect(document.activeElement).toBe(search);
  });

  it('E06-S06 a new search from No articles match these filters keeps that state, busy, until its answer arrives, with no skeleton rows in between', async () => {
    const user = userEvent.setup();
    renderCoreAt(listHref({ q: 'zz-404' }), [
      articlesQuery({ ...firstPage, search: 'zz-404' }, articlesPage([], { totalCount: 0 })),
      articlesQuery({ ...firstPage, search: 'zz-4045' }, articlesPage([], { totalCount: 0 }), 200),
      articlesQuery(
        { ...firstPage, search: 'zz-40' },
        articlesPage(articleRange(2), { totalCount: 2 }),
        200,
      ),
    ]);
    const noMatch = () =>
      screen.getByRole('heading', { level: 2, name: 'No articles match these filters' });
    await screen.findByRole('heading', { level: 2, name: 'No articles match these filters' });
    const skeletonRowsShown = watchForSkeletonRows();
    const search = screen.getByRole('searchbox', { name: 'Search articles' });

    await user.type(search, '5');

    await waitFor(() => expect(noMatch().closest('[aria-busy="true"]')).not.toBeNull());
    await waitFor(() => expect(noMatch().closest('[aria-busy]')).toBeNull());

    await user.type(search, '{Backspace}{Backspace}');

    await waitFor(() => expect(noMatch().closest('[aria-busy="true"]')).not.toBeNull());
    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(2));
    expect(skeletonRowsShown()).toBe(false);
    expect(document.activeElement).toBe(search);
  });

  it('E06-S06 a page whose cursor no longer applies offers Go to the first page, which keeps the sort and the search', async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(listHref({ q: 'axle', sort: 'name', page: '3', after: 'stale' }), [
      articlesQuery(
        { first: 25, after: 'stale', orderBy: byName('ASC'), search: 'axle' },
        {
          data: null,
          errors: [
            {
              message: 'The cursor belongs to another order of the list',
              path: ['coreArticles'],
              extensions: { code: 'BAD_USER_INPUT', errorCode: 'core.list.invalid_cursor' },
            },
          ],
        },
      ),
      articlesQuery(
        { first: 25, orderBy: byName('ASC'), search: 'axle' },
        articlesPage(articleRange(2), { totalCount: 2 }),
      ),
    ]);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'This page of results is out of date' }),
    ).toBeDefined();
    expect(
      screen.getByText(
        'The rows changed since this link was made, so this page can no longer be found.',
      ),
    ).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Go to the first page' }));

    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(2));
    expect(router.state.location.href).toBe(listHref({ q: 'axle', sort: 'name' }));
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 1, name: 'Articles' }),
    );
  });

  it('E06-S06 the default sort, Last changed newest first, stays out of the URL; Article number sorts as sort=code and Last changed ascending as sort=changed', async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(listHref(), [
      articlesQuery(firstPage, articlesPage(articleRange(2), { totalCount: 2 })),
      articlesQuery(
        { first: 25, orderBy: byCode('ASC') },
        articlesPage(articleRange(2, 700), { totalCount: 2 }),
      ),
      articlesQuery(
        { first: 25, orderBy: byChange('ASC') },
        articlesPage(articleRange(2, 800), { totalCount: 2 }),
      ),
      articlesQuery(firstPage, articlesPage(articleRange(2, 900), { totalCount: 2 })),
    ]);
    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(2));
    expect(router.state.location.href).toBe(listHref());

    await user.click(within(table).getByRole('button', { name: 'Article number' }));
    await waitFor(() => expect(bodyRows(table)[0]?.[0]).toBe('AX-700'));
    expect(router.state.location.href).toBe(listHref({ sort: 'code' }));
    expect(ariaSort(table, 'Article number')).toBe('ascending');
    expect(ariaSort(table, 'Last changed')).toBe('none');

    const changedHeader = within(table).getByRole('button', { name: 'Last changed' });
    await user.click(changedHeader);
    await waitFor(() => expect(bodyRows(table)[0]?.[0]).toBe('AX-800'));
    expect(router.state.location.href).toBe(listHref({ sort: 'changed' }));
    expect(ariaSort(table, 'Last changed')).toBe('ascending');

    await user.click(changedHeader);
    await waitFor(() => expect(bodyRows(table)[0]?.[0]).toBe('AX-900'));
    expect(router.state.location.href).toBe(listHref());
    expect(ariaSort(table, 'Last changed')).toBe('descending');
  });
});
