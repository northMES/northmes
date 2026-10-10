// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CoreArticleFacets } from '../../../src/modules/core/screens/articles/article-facets.graphql.ts';
import {
  article,
  articlesPage,
  articlesQuery,
  bodyRows,
  firstPage,
  plant,
  renderCoreAt,
} from './core-app.tsx';

afterEach(cleanup);

beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // A browser without storage keeps the columns for the page alone.
  }
});

const hosesId = '019a0000-0000-7000-8000-0000000000a1';
const shaftsId = '019a0000-0000-7000-8000-0000000000a2';
const hoses = { __typename: 'ArticleGroup', id: hosesId, code: 'HO', name: 'Hoses' } as const;

/** The counts of the fictional plant's articles, for the given filters. */
function facetsQuery(
  variables: Record<string, unknown>,
  counts: {
    total: number;
    groups?: [string | null, string | null, number][];
    units?: [string, number][];
    sources?: [string | null, number][];
  },
): MockLink.MockedResponse {
  return {
    request: { query: CoreArticleFacets, variables },
    result: {
      data: {
        coreArticleFacets: {
          __typename: 'ArticleFacets',
          total: counts.total,
          articleGroups: (counts.groups ?? []).map(([id, name, count]) => ({
            __typename: 'ArticleGroupCount',
            id,
            code: id === null ? null : name?.slice(0, 2).toUpperCase(),
            name,
            count,
          })),
          stockUnits: (counts.units ?? []).map(([stockUnit, count]) => ({
            __typename: 'StockUnitCount',
            stockUnit,
            count,
          })),
          sources: (counts.sources ?? []).map(([source, count]) => ({
            __typename: 'SourceCount',
            source,
            count,
          })),
        },
      },
    },
  };
}

const allCounts = {
  total: 6,
  groups: [
    [hosesId, 'Hoses', 2],
    [shaftsId, 'Shafts', 1],
    [null, null, 3],
  ] as [string | null, string | null, number][],
  units: [
    ['PIECE', 4],
    ['METRE', 2],
  ] as [string, number][],
  sources: [
    ['Pyramid', 3],
    [null, 3],
  ] as [string | null, number][],
};

const hose = { ...article('AX-31007', 'Hydraulslang 12 mm'), articleGroup: hoses };
const hose2 = { ...article('AX-31008', 'Hydraulslang 16 mm'), articleGroup: hoses };

describe('the articles list filters', () => {
  it('E06-S06 the Article group menu lists each group with its count, and picking one filters the list, keeps the pick in the URL and shows its chip', async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(coreLinks.articles({ plant }).href, [
      articlesQuery(firstPage, articlesPage([hose], { totalCount: 6 })),
      facetsQuery({}, allCounts),
      articlesQuery(
        { ...firstPage, articleGroupIds: [hosesId] },
        articlesPage([hose, hose2], { totalCount: 2 }),
      ),
      facetsQuery({ articleGroupIds: [hosesId] }, { ...allCounts, total: 2 }),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Article group' }));
    const items = await screen.findAllByRole('menuitemcheckbox');
    expect(items.map((item) => item.textContent)).toEqual([
      'Hoses 2',
      'Shafts 1',
      'No article group 3',
    ]);
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Hoses 2' }));
    await user.keyboard('{Escape}');

    await waitFor(() => expect(router.state.location.searchStr).toBe(`?articleGroup=${hosesId}`));
    expect(router.state.location.search).toEqual({ articleGroup: hosesId });
    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(2));
    expect(screen.getByRole('button', { name: 'Article group, 1 selected' })).toBeDefined();
    expect(screen.getByText('Article group:').parentElement?.textContent).toBe(
      'Article group: Hoses 2',
    );
    expect(screen.getByRole('button', { name: 'Remove the article group filter' })).toBeDefined();
  });

  it('E06-S06 a link with articleGroup, stockUnit and source opens the list with those filters, none and NorthMES picking the empty values', async () => {
    renderCoreAt(
      `${coreLinks.articles({ plant }).href}?articleGroup=${hosesId}%2Cnone&stockUnit=METRE&source=NorthMES`,
      [
        articlesQuery(
          {
            ...firstPage,
            articleGroupIds: [hosesId, null],
            stockUnits: ['METRE'],
            sources: [null],
          },
          articlesPage([hose], { totalCount: 1 }),
        ),
        facetsQuery(
          { articleGroupIds: [hosesId, null], stockUnits: ['METRE'], sources: [null] },
          { ...allCounts, total: 1 },
        ),
      ],
    );

    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(1));
    expect(await screen.findByRole('button', { name: 'Article group, 2 selected' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Stock unit, 1 selected' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Source, 1 selected' })).toBeDefined();
    expect(screen.getByText('Source:').parentElement?.textContent).toBe('Source: NorthMES 3');
  });

  it('E06-S06 Clear filters removes every filter and keeps the search', async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(`${coreLinks.articles({ plant }).href}?q=slang&stockUnit=METRE`, [
      articlesQuery(
        { ...firstPage, search: 'slang', stockUnits: ['METRE'] },
        articlesPage([hose], { totalCount: 1 }),
      ),
      facetsQuery({ search: 'slang', stockUnits: ['METRE'] }, { ...allCounts, total: 1 }),
      articlesQuery({ ...firstPage, search: 'slang' }, articlesPage([hose], { totalCount: 1 })),
      facetsQuery({ search: 'slang' }, { ...allCounts, total: 1 }),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'slang' }));
  });

  it('E06-S06 Group by Article group shows a header row per group with its count, opens a group to its rows, and counts the groups and articles', async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(coreLinks.articles({ plant }).href, [
      articlesQuery(firstPage, articlesPage([hose], { totalCount: 6 })),
      facetsQuery({}, allCounts),
      articlesQuery(
        { first: 100, orderBy: firstPage.orderBy, articleGroupIds: [hosesId] },
        articlesPage([hose, hose2], { totalCount: 2 }),
      ),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Group by' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Article group' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ group: 'articleGroup' }));
    const table = await screen.findByRole('table', { name: 'Articles' });
    const toggles = await within(table).findAllByRole('button', { expanded: false });
    expect(toggles.map((button) => button.textContent)).toEqual([
      'Hoses 2 articles',
      'Shafts 1 article',
      'No article group 3 articles',
    ]);
    expect(screen.getByText('3 groups, 6 articles')).toBeDefined();
    await user.click(within(table).getByRole('button', { name: 'Hoses 2 articles' }));

    await waitFor(() =>
      expect(within(table).getAllByRole('cell')[0]?.textContent).toBe('AX-31007'),
    );
    expect(
      within(table).getByRole('button', { name: 'Hoses 2 articles' }).getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('E06-S06 Columns hides Source, which the table drops, and the choice stays for the next visit', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.articles({ plant }).href, [
      articlesQuery(firstPage, articlesPage([hose], { totalCount: 1 })),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Columns' }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Source' }));
    await user.keyboard('{Escape}');

    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() =>
      expect(
        within(table)
          .getAllByRole('columnheader')
          .map((cell) => cell.textContent),
      ).not.toContain('Source'),
    );
    cleanup();

    renderCoreAt(coreLinks.articles({ plant }).href, [
      articlesQuery(firstPage, articlesPage([hose], { totalCount: 1 })),
    ]);
    const again = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() => expect(bodyRows(again)).toHaveLength(1));
    expect(
      within(again)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).not.toContain('Source');
  });
});
