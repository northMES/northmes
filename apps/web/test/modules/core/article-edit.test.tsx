// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreArticle } from '../../../src/modules/core/article.graphql.ts';
import { CoreUpdateArticle } from '../../../src/modules/core/screens/edit-article/update-article.graphql.ts';
import { article, articleQuery, plant, renderCoreAt } from './core-app.tsx';

afterEach(cleanup);

const axle = article('AX-500', 'Axle 20 mm');

/** The edit page's href of an article. */
function editHref(articleId: string): string {
  return coreLinks.articles.article.edit({ plant, articleId }).href;
}

/** The textbox named label. */
function field(label: string): HTMLInputElement {
  return screen.getByRole('textbox', { name: label }) as HTMLInputElement;
}

/** The polite live region's text. */
function spoken(): string | null | undefined {
  return document.querySelector('[aria-live="polite"]')?.textContent;
}

/** coreUpdateArticle of axle with these values, answered with result. */
function updateOf(
  input: { expectedVersion: number; code: string; name: string },
  result: MockLink.MockedResponse['result'],
): MockLink.MockedResponse {
  return {
    request: { query: CoreUpdateArticle, variables: { input: { id: axle.id, ...input } } },
    result,
  };
}

/** The answer of a change made on a version that is no longer the article's. */
const versionConflict = {
  data: null,
  errors: [
    {
      message: `Article ${axle.id} is at version 2, and the change was made on version 1`,
      path: ['coreUpdateArticle'],
      extensions: { code: 'CONFLICT', errorCode: 'core.version_conflict' },
    },
  ],
};

describe('edit article', () => {
  it("E06-S06 Edit opens the form filled in, and Save sends expectedVersion, opens the article's page with the change and announces it", async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(coreLinks.articles.article({ plant, articleId: axle.id }).href, [
      articleQuery(axle),
      updateOf(
        { expectedVersion: 1, code: 'AX-500', name: 'Axle 20 mm, steel' },
        { data: { coreUpdateArticle: { ...axle, name: 'Axle 20 mm, steel', version: 2 } } },
      ),
    ]);

    await user.click(await screen.findByRole('link', { name: 'Edit' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Edit article AX-500' }),
    ).toBeDefined();
    expect(document.title).toBe('Edit article AX-500 · NorthMES');
    expect(field('Article number').value).toBe('AX-500');
    expect(field('Name').value).toBe('Axle 20 mm');
    await user.type(field('Name'), ', steel');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Article AX-500' })).toBeDefined();
    expect(router.state.location.pathname).toBe(
      coreLinks.articles.article({ plant, articleId: axle.id }).href,
    );
    const identity = screen.getByRole('region', { name: 'Identity' });
    expect(within(identity).getByText('Axle 20 mm, steel')).toBeDefined();
    await waitFor(() => expect(spoken()).toBe('Article AX-500 saved'));
  });

  it('E06-S06 a version conflict says the article changed with the typed values kept, and Reload article fills in the saved values and their version', async () => {
    const user = userEvent.setup();
    const saved = { ...axle, name: 'Axle 20 mm, hardened', version: 2 };
    renderCoreAt(editHref(axle.id), [
      articleQuery(axle),
      updateOf({ expectedVersion: 1, code: 'AX-500', name: 'Axle 20 mm, steel' }, versionConflict),
      {
        request: { query: CoreArticle, variables: { id: axle.id } },
        result: { data: { coreArticle: saved } },
      },
      updateOf(
        { expectedVersion: 2, code: 'AX-500', name: 'Axle 20 mm, hardened steel' },
        {
          data: { coreUpdateArticle: { ...saved, name: 'Axle 20 mm, hardened steel', version: 3 } },
        },
      ),
    ]);

    await user.type(await screen.findByRole('textbox', { name: 'Name' }), ', steel');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    const summary = await screen.findByRole('group', {
      name: 'This article changed while you edited it',
    });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(
      within(summary).getByText(
        'Someone saved this article after you opened it. Your entries are kept. Reload the article to see the saved values, then make your change again.',
      ),
    ).toBeDefined();
    expect(field('Name').value).toBe('Axle 20 mm, steel');

    await user.click(within(summary).getByRole('button', { name: 'Reload article' }));

    await waitFor(() => expect(field('Name').value).toBe('Axle 20 mm, hardened'));
    expect(
      screen.queryByRole('group', { name: 'This article changed while you edited it' }),
    ).toBeNull();
    expect(document.activeElement).toBe(field('Article number'));
    await user.type(field('Name'), ' steel');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Article AX-500' })).toBeDefined();
    await waitFor(() => expect(spoken()).toBe('Article AX-500 saved'));
  });

  it('E06-S06 the edit page of an article that does not exist shows the not-found state', async () => {
    renderCoreAt(editHref(axle.id), [
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
    expect(screen.getByRole('heading', { level: 1, name: 'Edit article' })).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
