// SPDX-License-Identifier: AGPL-3.0-or-later
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreArticle } from '../../../src/modules/core/article.graphql.ts';
import { companiesQuery, forbiddenError, viewerQuery } from './access-fixtures.ts';
import {
  article,
  articleQuery,
  articlesPage,
  articlesQuery,
  firstPage,
  plant,
  renderCoreAt,
} from './core-app.tsx';

afterEach(cleanup);

const axle = article('AX-500', 'Axle 20 mm');

/** The article's page href. */
function articleHref(articleId: string): string {
  return coreLinks.articles.article({ plant, articleId }).href;
}

/** The terms and details of a definition list, as pairs. */
function definitions(list: HTMLElement): (string | null)[][] {
  const terms = within(list).getAllByRole('term');
  return terms.map((term) => [term.textContent, term.nextElementSibling?.textContent ?? null]);
}

describe('article page', () => {
  it("E06-S06 an article's page shows its number and name, with Edit", async () => {
    renderCoreAt(articleHref(axle.id), [
      articleQuery(axle),
      viewerQuery(['core.article:read', 'core.article:update']),
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Article AX-500' })).toBeDefined();
    expect(document.title).toBe('Article AX-500 · NorthMES');
    const identity = screen.getByRole('region', { name: 'Identity' });
    expect(definitions(identity)).toEqual([
      ['Article number', 'AX-500'],
      ['Name', 'Axle 20 mm'],
      ['Plants', 'Plant A'],
    ]);
    expect((await screen.findByRole('link', { name: 'Edit' })).getAttribute('href')).toBe(
      coreLinks.articles.article.edit({ plant, articleId: axle.id }).href,
    );
  });

  it("E06-S06 the article number in the list opens the article's page", async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(coreLinks.articles({ plant }).href, [
      articlesQuery(firstPage, articlesPage([axle], { totalCount: 1 })),
      articleQuery(axle),
    ]);

    await user.click(await screen.findByRole('link', { name: 'AX-500' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Article AX-500' })).toBeDefined();
    expect(router.state.location.href).toBe(articleHref(axle.id));
  });

  it('E06-S06 while the article loads, the h1 reads Article and the page offers no Edit', async () => {
    renderCoreAt(articleHref(axle.id), [{ ...articleQuery(axle), delay: 50 }]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Article' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    expect(await screen.findByRole('heading', { level: 1, name: 'Article AX-500' })).toBeDefined();
  });

  it('E06-S06 an article that does not exist shows the not-found state with Back to Articles', async () => {
    renderCoreAt(articleHref(axle.id), [
      {
        request: { query: CoreArticle, variables: { id: axle.id } },
        result: { data: { coreArticle: null } },
      },
    ]);

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'This article does not exist or you cannot see it',
      }),
    ).toBeDefined();
    expect(
      screen.getByText(
        'The link may be out of date, or the article belongs to a plant you have no role in.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Back to Articles' }).getAttribute('href')).toBe(
      coreLinks.articles({ plant }).href,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Article' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
  });

  it('E06-S06 a failed load shows Could not load the article, and Try again loads it', async () => {
    const user = userEvent.setup();
    renderCoreAt(articleHref(axle.id), [
      {
        request: { query: CoreArticle, variables: { id: axle.id } },
        error: new Error('Failed to fetch'),
      },
      articleQuery(axle),
    ]);

    const alert = await screen.findByRole('alert');
    expect(
      within(alert).getByRole('heading', { name: 'Could not load the article' }),
    ).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Article AX-500' })).toBeDefined(),
    );
  });

  it('E06-S06 a link to an article opened without core.article:read shows the forbidden state under the h1 Article, with no data', async () => {
    renderCoreAt(articleHref(axle.id), [
      {
        request: { query: CoreArticle, variables: { id: axle.id } },
        result: { data: { coreArticle: null }, errors: [forbiddenError(['coreArticle'])] },
      },
      companiesQuery(),
    ]);

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'You need the permission to read articles in Acme AB',
      }),
    ).toBeDefined();
    expect(
      screen.getByText('Ask your plant admin for a role that can read articles.'),
    ).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Article' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Identity' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
