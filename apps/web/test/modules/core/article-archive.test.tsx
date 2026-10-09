// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreArticle } from '../../../src/modules/core/article.graphql.ts';
import { CoreRestoreArticle } from '../../../src/modules/core/restore-article.graphql.ts';
import { CoreArchiveArticle } from '../../../src/modules/core/screens/article/archive-article.graphql.ts';
import { CoreUpdateArticle } from '../../../src/modules/core/screens/edit-article/update-article.graphql.ts';
import { viewerQuery } from './access-fixtures.ts';
import {
  type ArticleNode,
  article,
  articleQuery,
  articlesPage,
  articlesQuery,
  bodyRows,
  firstPage,
  lastChangedText,
  plant,
  renderCoreAt,
  spoken,
} from './core-app.tsx';

afterEach(cleanup);

/** The viewer of a user who changes and archives articles at the plant. */
const editor = () =>
  viewerQuery(['core.article:read', 'core.article:update', 'core.article:archive']);

const archivedAt = '2026-10-09T07:30:00.000Z';
const axle = article('AX-500', 'Axle 20 mm');
const archivedAxle = article('AX-500', 'Axle 20 mm', 2, archivedAt);

/** The article's page href. */
function articleHref(articleId: string): string {
  return coreLinks.articles.article({ plant, articleId }).href;
}

/** A command on axle with expectedVersion, answered with result. */
function commandOf(
  query: typeof CoreArchiveArticle | typeof CoreRestoreArticle,
  expectedVersion: number,
  result: MockLink.MockedResponse['result'],
): MockLink.MockedResponse {
  return { request: { query, variables: { input: { id: axle.id, expectedVersion } } }, result };
}

const archiveOf = (expectedVersion: number, node: ArticleNode) =>
  commandOf(CoreArchiveArticle, expectedVersion, { data: { coreArchiveArticle: node } });

const restoreOf = (expectedVersion: number, node: ArticleNode) =>
  commandOf(CoreRestoreArticle, expectedVersion, { data: { coreRestoreArticle: node } });

/** coreArticle answered with node, for a reload of the article. */
function reloadOf(node: ArticleNode): MockLink.MockedResponse {
  return {
    request: { query: CoreArticle, variables: { id: node.id } },
    result: { data: { coreArticle: node } },
  };
}

/** A command on axle with expectedVersion that a validator refuses with its own message. */
function refusedCommandOf(
  query: typeof CoreArchiveArticle | typeof CoreRestoreArticle,
  expectedVersion: number,
): MockLink.MockedResponse {
  return commandOf(query, expectedVersion, {
    data: null,
    errors: [
      {
        message: 'Article AX-500 is on an open production order',
        extensions: { code: 'PRECONDITION', errorCode: 'core.command_rejected' },
      },
    ],
  });
}

/** A command on axle with expectedVersion that gets no answer, as when the network is down. */
function unansweredCommandOf(
  query: typeof CoreArchiveArticle | typeof CoreRestoreArticle,
  expectedVersion: number,
): MockLink.MockedResponse {
  return {
    request: { query, variables: { input: { id: axle.id, expectedVersion } } },
    error: new TypeError('Failed to fetch'),
  };
}

describe('archive and restore an article', () => {
  it("E06-S06 Archive on the article's page asks first, then archives it: the page shows Archived and Restore, offers no Edit, focuses the h1 and announces it", async () => {
    const user = userEvent.setup();
    renderCoreAt(articleHref(axle.id), [articleQuery(axle), editor(), archiveOf(1, archivedAxle)]);

    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Archive article AX-500?' });
    expect(
      within(dialog).getByText(
        'Archived articles are hidden from lists and cannot be changed until restored. Orders that use it keep it.',
      ),
    ).toBeDefined();
    await user.click(within(dialog).getByRole('button', { name: 'Archive article' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    const heading = screen.getByRole('heading', { level: 1, name: 'Article AX-500' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.getByText('Archived')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Restore' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    await waitFor(() => expect(spoken()).toBe('Article AX-500 archived'));
  });

  it("E06-S06 Restore on an archived article's page asks first, then restores it with Edit again and announces it", async () => {
    const user = userEvent.setup();
    const restored = article('AX-500', 'Axle 20 mm', 3);
    renderCoreAt(articleHref(axle.id), [
      articleQuery(archivedAxle),
      editor(),
      restoreOf(2, restored),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Restore' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Restore article AX-500?' });
    expect(
      within(dialog).getByText('The article shows in lists again and can be changed again.'),
    ).toBeDefined();
    await user.click(within(dialog).getByRole('button', { name: 'Restore article' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(await screen.findByRole('link', { name: 'Edit' })).toBeDefined();
    expect(screen.queryByText('Archived')).toBeNull();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDefined();
    await waitFor(() => expect(spoken()).toBe('Article AX-500 restored'));
  });

  it('E06-S06 an archive refused for a stale version says so in the dialog, reloads the article and archives it on the next try', async () => {
    const user = userEvent.setup();
    const changed = article('AX-500', 'Axle 20 mm, steel', 2);
    renderCoreAt(articleHref(axle.id), [
      articleQuery(axle),
      editor(),
      commandOf(CoreArchiveArticle, 1, {
        data: null,
        errors: [
          {
            message: `Article ${axle.id} is at version 2, and the change was made on version 1`,
            extensions: { code: 'CONFLICT', errorCode: 'core.version_conflict' },
          },
        ],
      }),
      reloadOf(changed),
      archiveOf(2, article('AX-500', 'Axle 20 mm, steel', 3, archivedAt)),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Archive article' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'Someone changed this article after you opened it. The page now shows the saved article. Check it, then archive it again.',
    );
    await waitFor(() => expect(screen.getByText('Axle 20 mm, steel')).toBeDefined());
    await user.click(within(dialog).getByRole('button', { name: 'Archive article' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByText('Archived')).toBeDefined();
  });

  it('E06-S06 an archive refused for a stale version whose reload gets no answer says the saved article could not be loaded, and keeps the page as it was', async () => {
    const user = userEvent.setup();
    renderCoreAt(articleHref(axle.id), [
      articleQuery(axle),
      editor(),
      commandOf(CoreArchiveArticle, 1, {
        data: null,
        errors: [
          {
            message: `Article ${axle.id} is at version 2, and the change was made on version 1`,
            extensions: { code: 'CONFLICT', errorCode: 'core.version_conflict' },
          },
        ],
      }),
      {
        request: { query: CoreArticle, variables: { id: axle.id } },
        error: new TypeError('Failed to fetch'),
      },
    ]);

    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Archive article' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'Someone changed this article after you opened it, and the saved article could not be loaded. Check the connection, then try again.',
    );
    expect(screen.getByText('Axle 20 mm')).toBeDefined();
  });

  it("E06-S06 an archive the server refuses shows the server's message in the dialog", async () => {
    const user = userEvent.setup();
    renderCoreAt(articleHref(axle.id), [
      articleQuery(axle),
      editor(),
      refusedCommandOf(CoreArchiveArticle, 1),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Archive article' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'Could not archive the article. Article AX-500 is on an open production order.',
    );
  });

  it('E06-S06 an archive that gets no answer asks to check the connection in the dialog', async () => {
    const user = userEvent.setup();
    renderCoreAt(articleHref(axle.id), [
      articleQuery(axle),
      editor(),
      unansweredCommandOf(CoreArchiveArticle, 1),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Archive article' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'Could not archive the article. Check the connection, then try again.',
    );
  });

  it('E06-S06 Show archived lists archived articles with the Archived badge, puts archived=1 in the URL and keeps focus', async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(coreLinks.articles({ plant }).href, [
      articlesQuery(firstPage, articlesPage([article('AX-400', 'Axle 10 mm')], { totalCount: 1 })),
      articlesQuery(
        { ...firstPage, includeArchived: true },
        articlesPage([article('AX-400', 'Axle 10 mm'), archivedAxle], { totalCount: 2 }),
      ),
    ]);
    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() =>
      expect(bodyRows(table)).toEqual([['AX-400', 'Axle 10 mm', 'Plant A', lastChangedText]]),
    );

    const showArchived = screen.getByRole('checkbox', { name: 'Show archived' });
    await user.click(showArchived);

    await waitFor(() =>
      expect(bodyRows(table)).toEqual([
        ['AX-400', 'Axle 10 mm', 'Plant A', lastChangedText],
        ['AX-500', 'Axle 20 mmArchived', 'Plant A', lastChangedText],
      ]),
    );
    expect(router.state.location.search).toEqual({ archived: 1 });
    expect(showArchived.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(showArchived);
  });

  it('E06-S06 a link with archived=1 opens the list with Show archived checked, and unchecking it hides archived articles again', async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(`${coreLinks.articles({ plant }).href}?archived=1`, [
      articlesQuery(
        { ...firstPage, includeArchived: true },
        articlesPage([archivedAxle], { totalCount: 1 }),
      ),
      articlesQuery(firstPage, articlesPage([], { totalCount: 0 })),
    ]);
    const showArchived = await screen.findByRole('checkbox', { name: 'Show archived' });
    expect(showArchived.getAttribute('aria-checked')).toBe('true');
    const table = await screen.findByRole('table', { name: 'Articles' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(1));

    await user.click(showArchived);

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(await screen.findByRole('heading', { name: 'No articles yet' })).toBeDefined();
  });

  it('E06-S06 a save refused because the article was archived meanwhile keeps the typed values and offers Restore article, after which Save goes through', async () => {
    const user = userEvent.setup();
    const restored = article('AX-500', 'Axle 20 mm', 3);
    renderCoreAt(coreLinks.articles.article.edit({ plant, articleId: axle.id }).href, [
      articleQuery(axle),
      {
        request: {
          query: CoreUpdateArticle,
          variables: {
            input: { id: axle.id, expectedVersion: 1, code: 'AX-500', name: 'Axle 20 mm, steel' },
          },
        },
        result: {
          data: null,
          errors: [
            {
              message:
                'Article AX-500 is archived, and an archived article cannot be changed until it is restored',
              extensions: { code: 'PRECONDITION', errorCode: 'core.archived' },
            },
          ],
        },
      },
      reloadOf(archivedAxle),
      restoreOf(2, restored),
      {
        request: {
          query: CoreUpdateArticle,
          variables: {
            input: { id: axle.id, expectedVersion: 3, code: 'AX-500', name: 'Axle 20 mm, steel' },
          },
        },
        result: {
          data: { coreUpdateArticle: { ...restored, name: 'Axle 20 mm, steel', version: 4 } },
        },
      },
    ]);

    await user.type(await screen.findByRole('textbox', { name: 'Name' }), ', steel');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    const summary = await screen.findByRole('group', { name: 'This article is archived' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(
      within(summary).getByText(
        'Archived articles cannot be changed until they are restored. Your entries are kept.',
      ),
    ).toBeDefined();
    await user.click(within(summary).getByRole('button', { name: 'Restore article' }));

    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'This article is archived' })).toBeNull(),
    );
    await waitFor(() => expect(spoken()).toBe('Article AX-500 restored'));
    const name = screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement;
    expect(name.value).toBe('Axle 20 mm, steel');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Article AX-500' })).toBeDefined();
  });

  it('E06-S06 on the edit form of an archived article, a Restore article that gets no answer asks to check the connection, and a later one that goes through clears the failure and focuses Article number', async () => {
    const user = userEvent.setup();
    const restored = article('AX-500', 'Axle 20 mm', 3);
    renderCoreAt(coreLinks.articles.article.edit({ plant, articleId: axle.id }).href, [
      articleQuery(archivedAxle),
      reloadOf(archivedAxle),
      unansweredCommandOf(CoreRestoreArticle, 2),
      reloadOf(archivedAxle),
      restoreOf(2, restored),
    ]);

    const summary = await screen.findByRole('group', { name: 'This article is archived' });
    await user.click(within(summary).getByRole('button', { name: 'Restore article' }));
    expect(
      await within(summary).findByText(
        'Could not restore the article. Check the connection, then try again.',
      ),
    ).toBeDefined();

    await user.click(within(summary).getByRole('button', { name: 'Restore article' }));

    await waitFor(() => expect(spoken()).toBe('Article AX-500 restored'));
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'This article is archived' })).toBeNull(),
    );
    expect(
      screen.queryByText('Could not restore the article. Check the connection, then try again.'),
    ).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Article number' }));
  });

  it("E06-S06 on the edit form of an archived article, a Restore article the server refuses shows the server's message and keeps the typed values", async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.articles.article.edit({ plant, articleId: axle.id }).href, [
      articleQuery(archivedAxle),
      reloadOf(archivedAxle),
      refusedCommandOf(CoreRestoreArticle, 2),
    ]);

    await user.type(await screen.findByRole('textbox', { name: 'Name' }), ', steel');
    const summary = await screen.findByRole('group', { name: 'This article is archived' });
    await user.click(within(summary).getByRole('button', { name: 'Restore article' }));

    expect(
      await within(summary).findByText(
        'Could not restore the article. Article AX-500 is on an open production order.',
      ),
    ).toBeDefined();
    expect((screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe(
      'Axle 20 mm, steel',
    );
  });
});
