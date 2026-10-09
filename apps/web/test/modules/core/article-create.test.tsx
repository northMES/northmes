// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreCreateArticle } from '../../../src/modules/core/screens/new-article/create-article.graphql.ts';
import {
  articleRange,
  articlesPage,
  articlesQuery,
  firstPage,
  plant,
  renderCoreAt,
} from './core-app.tsx';

afterEach(cleanup);

/** A uuidv7: version 7 in the third group, variant 10 in the fourth. */
const uuidv7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface CreateInput {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/**
 * coreCreateArticle with a new uuidv7 and these code and name, answered by result for the input
 * the form sent.
 */
function createOf(
  code: string,
  name: string,
  result: (input: CreateInput) => MockLink.MockedResponse['result'],
): MockLink.MockedResponse {
  return {
    request: {
      query: CoreCreateArticle,
      variables: ({ input }: { input: CreateInput }) =>
        uuidv7.test(input.id) && input.code === code && input.name === name,
    },
    result: ({ input }: { input: CreateInput }) => result(input),
  } as MockLink.MockedResponse;
}

/** The article that coreCreateArticle returns for an input. */
function created(input: CreateInput) {
  return {
    data: { coreCreateArticle: { __typename: 'Article', version: 1, archivedAt: null, ...input } },
  };
}

/** The polite live region's text. */
function spoken(): string | null | undefined {
  return document.querySelector('[aria-live="polite"]')?.textContent;
}

/** The textbox named label. */
function field(label: string): HTMLInputElement {
  return screen.getByRole('textbox', { name: label }) as HTMLInputElement;
}

describe('new article', () => {
  it("E06-S06 New article saves the trimmed number and name under a new uuidv7, opens the article's page in place of the form and announces the article", async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(coreLinks.articles({ plant }).href, [
      articlesQuery(firstPage, articlesPage(articleRange(2), { totalCount: 2 })),
      createOf('BR-900', 'Wall bracket 90 mm', created),
      articlesQuery(firstPage, articlesPage(articleRange(2), { totalCount: 2 })),
    ]);

    await user.click(await screen.findByRole('link', { name: 'New article' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'New article' })).toBeDefined();
    expect(document.title).toBe('New article · NorthMES');
    await user.type(field('Article number'), ' BR-900 ');
    await user.type(field('Name'), 'Wall bracket 90 mm ');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Article BR-900' })).toBeDefined();
    const identity = screen.getByRole('region', { name: 'Identity' });
    expect(within(identity).getByText('Wall bracket 90 mm')).toBeDefined();
    const articleId = router.state.location.pathname.split('/').at(-1) ?? '';
    expect(articleId).toMatch(uuidv7);
    expect(router.state.location.pathname).toBe(
      coreLinks.articles.article({ plant, articleId }).href,
    );
    await waitFor(() => expect(spoken()).toBe('Article BR-900 created'));

    // The save replaced the form in the history, so Back returns to the list.
    router.history.back();
    expect(await screen.findByRole('heading', { level: 1, name: 'Articles' })).toBeDefined();
  });

  it('E06-S06 Save with empty fields shows each message on its field and in the summary, which takes focus, and sends nothing', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.articles.new({ plant }).href, []);

    await user.click(await screen.findByRole('button', { name: 'Save article' }));

    const summary = await screen.findByRole('group', { name: 'Fix 2 fields to save the article' });
    expect(document.activeElement).toBe(summary);
    expect(
      within(summary)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Enter an article number.', 'Enter a name.']);
    expect(field('Article number').getAttribute('aria-invalid')).toBe('true');
    expect(field('Name').getAttribute('aria-invalid')).toBe('true');
  });

  it('E06-S06 an article number over 32 characters states the range and the length typed', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.articles.new({ plant }).href, []);

    await user.type(await screen.findByRole('textbox', { name: 'Article number' }), 'C'.repeat(34));
    await user.type(field('Name'), 'Clamp');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    const summary = await screen.findByRole('group', { name: 'Fix 1 field to save the article' });
    expect(within(summary).getByRole('link').textContent).toBe(
      'Article number can be 1 to 32 characters. It has 34.',
    );
  });

  it('E06-S06 a taken article number lands on its field with the typed values kept, and the summary takes focus', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.articles.new({ plant }).href, [
      createOf('BR-140', 'Wall bracket, wide', () => ({
        data: null,
        errors: [
          {
            message: 'The code is already taken.',
            path: ['coreCreateArticle'],
            extensions: {
              code: 'CONFLICT',
              errorCode: 'core.code_taken',
              fieldErrors: [
                { path: ['code'], message: 'The code is already taken.', code: 'core.code_taken' },
              ],
            },
          },
        ],
      })),
    ]);

    await user.type(await screen.findByRole('textbox', { name: 'Article number' }), 'BR-140');
    await user.type(field('Name'), 'Wall bracket, wide');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    const summary = await screen.findByRole('group', { name: 'Fix 1 field to save the article' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    const message = 'Article number BR-140 is already in use. Choose another number.';
    expect(within(summary).getByRole('link').textContent).toBe(message);
    expect(field('Article number').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getAllByText(message)).toHaveLength(2);
    expect(field('Article number').value).toBe('BR-140');
    expect(field('Name').value).toBe('Wall bracket, wide');
    expect(screen.getByRole('heading', { level: 1, name: 'New article' })).toBeDefined();
  });

  it('E06-S06 a save that fails without field errors says Could not save the article and keeps the typed values, and a retry sends the same id', async () => {
    const user = userEvent.setup();
    const sent: string[] = [];
    const sentAs = (input: CreateInput) => {
      sent.push(input.id);
      return input.code === 'CL-300';
    };
    renderCoreAt(coreLinks.articles.new({ plant }).href, [
      {
        request: {
          query: CoreCreateArticle,
          variables: ({ input }: { input: CreateInput }) => sentAs(input),
        },
        error: new Error('Failed to fetch'),
      } as MockLink.MockedResponse,
      {
        request: {
          query: CoreCreateArticle,
          variables: ({ input }: { input: CreateInput }) => sentAs(input),
        },
        result: ({ input }: { input: CreateInput }) => created(input),
      } as MockLink.MockedResponse,
    ]);

    await user.type(await screen.findByRole('textbox', { name: 'Article number' }), 'CL-300');
    await user.type(field('Name'), 'Clamp 300 mm');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    const summary = await screen.findByRole('group', { name: 'Could not save the article' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(within(summary).getByText('Your entries are kept. Try again.')).toBeDefined();
    expect(field('Article number').value).toBe('CL-300');
    expect(field('Name').value).toBe('Clamp 300 mm');

    await user.click(screen.getByRole('button', { name: 'Save article' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Article CL-300' })).toBeDefined();
    expect(new Set(sent).size).toBe(1);
  });

  it('E06-S06 Cancel returns to the list', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.articles.new({ plant }).href, [
      articlesQuery(firstPage, articlesPage(articleRange(2), { totalCount: 2 })),
    ]);

    const cancel = await screen.findByRole('link', { name: 'Cancel' });
    expect(cancel.getAttribute('href')).toBe(coreLinks.articles({ plant }).href);
    await user.click(cancel);

    expect(await screen.findByRole('heading', { level: 1, name: 'Articles' })).toBeDefined();
  });
});
