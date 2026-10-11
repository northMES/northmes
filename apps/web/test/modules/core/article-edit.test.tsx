// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreArticle } from '../../../src/modules/core/article.graphql.ts';
import { CoreUpdateArticle } from '../../../src/modules/core/screens/edit-article/update-article.graphql.ts';
import { viewerQuery } from './access-fixtures.ts';
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

/**
 * coreUpdateArticle of axle with these values, in pieces and without a note unless the input says
 * otherwise, answered with result. The form always sends the note, empty to clear it.
 */
function updateOf(
  input: {
    expectedVersion: number;
    code: string;
    name: string;
    stockUnit?: string;
    note?: string;
    translations?: readonly { field: string; locale: string; text: string }[];
  },
  result: MockLink.MockedResponse['result'],
): MockLink.MockedResponse {
  return {
    request: {
      query: CoreUpdateArticle,
      variables: {
        input: {
          id: axle.id,
          stockUnit: 'PIECE',
          note: '',
          translations: [],
          articleGroupId: '',
          ...input,
        },
      },
    },
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
      viewerQuery(['core.article:read', 'core.article:update']),
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

  it('E06-S06 the edit form shows the stock unit and the note, and Save sends the changed ones, an emptied note too', async () => {
    const user = userEvent.setup();
    const noted = { ...axle, stockUnit: 'METRE', note: 'Ritning rev C' } as const;
    renderCoreAt(editHref(axle.id), [
      articleQuery(noted),
      updateOf(
        { expectedVersion: 1, code: 'AX-500', name: 'Axle 20 mm', stockUnit: 'KILOGRAM', note: '' },
        {
          data: { coreUpdateArticle: { ...noted, stockUnit: 'KILOGRAM', note: null, version: 2 } },
        },
      ),
    ]);

    const unit = (await screen.findByRole('combobox', { name: 'Stock unit' })) as HTMLSelectElement;
    expect(unit.value).toBe('METRE');
    expect(field('Note (optional)').value).toBe('Ritning rev C');
    await user.selectOptions(unit, 'Kilograms (kg)');
    await user.clear(field('Note (optional)'));
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Article AX-500' })).toBeDefined();
    const classification = screen.getByRole('region', { name: 'Classification' });
    expect(within(classification).getByText('Kilograms (kg)')).toBeDefined();
  });

  it("E06-S06 the edit form lists the name's translations, Add translation adds a row with focus on its language, and Remove takes one out", async () => {
    const user = userEvent.setup();
    const translated = {
      ...axle,
      translations: [
        { __typename: 'Translation', field: 'name', locale: 'en', text: 'Axle 20 mm' },
        { __typename: 'Translation', field: 'name', locale: 'de', text: 'Achse 20 mm' },
      ],
    } as const;
    renderCoreAt(editHref(axle.id), [
      articleQuery(translated),
      updateOf(
        {
          expectedVersion: 1,
          code: 'AX-500',
          name: 'Axle 20 mm',
          translations: [
            { field: 'name', locale: 'de', text: 'Achse 20 mm' },
            { field: 'name', locale: 'sv', text: 'Axel 20 mm' },
          ],
        },
        { data: { coreUpdateArticle: { ...translated, version: 2 } } },
      ),
    ]);

    const english = (await screen.findByRole('combobox', {
      name: 'Language of translation 1',
    })) as HTMLSelectElement;
    expect(english.value).toBe('en');
    expect(field('Translation 1').value).toBe('Axle 20 mm');
    await user.click(screen.getByRole('button', { name: 'Remove the English translation' }));
    // Focus moves to the next row's language, which is now the first.
    expect(document.activeElement).toBe(
      screen.getByRole('combobox', { name: 'Language of translation 1' }),
    );
    await user.click(screen.getByRole('button', { name: 'Add translation' }));
    const added = screen.getByRole('combobox', { name: 'Language of translation 2' });
    expect(document.activeElement).toBe(added);
    await user.selectOptions(added, 'Swedish');
    await user.type(field('Translation 2'), 'Axel 20 mm');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Article AX-500' })).toBeDefined();
  });

  it('E06-S06 Remove announces the translation it took out, by its language or else by its number', async () => {
    const user = userEvent.setup();
    const translated = {
      ...axle,
      translations: [
        { __typename: 'Translation', field: 'name', locale: 'en', text: 'Axle 20 mm' },
      ],
    } as const;
    renderCoreAt(editHref(axle.id), [articleQuery(translated)]);

    await user.click(await screen.findByRole('button', { name: 'Remove the English translation' }));
    await waitFor(() => expect(spoken()).toBe('English translation removed'));

    await user.click(screen.getByRole('button', { name: 'Add translation' }));
    await user.click(screen.getByRole('button', { name: 'Remove translation 1' }));
    await waitFor(() => expect(spoken()).toBe('Translation 1 removed'));
  });

  it('E06-S06 a translation without a language or a text says so on its row', async () => {
    const user = userEvent.setup();
    renderCoreAt(editHref(axle.id), [articleQuery(axle)]);

    await user.click(await screen.findByRole('button', { name: 'Add translation' }));
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    const summary = await screen.findByRole('group', { name: 'Fix 2 fields to save the article' });
    expect(
      within(summary)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Choose a language.', 'Enter the translation, or remove it.']);
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

  it('E06-S06 when Reload article fails, the conflict summary says so and the typed values stay', async () => {
    const user = userEvent.setup();
    renderCoreAt(editHref(axle.id), [
      articleQuery(axle),
      updateOf({ expectedVersion: 1, code: 'AX-500', name: 'Axle 20 mm, steel' }, versionConflict),
      {
        request: { query: CoreArticle, variables: { id: axle.id } },
        error: new Error('The network is down.'),
      },
    ]);

    await user.type(await screen.findByRole('textbox', { name: 'Name' }), ', steel');
    await user.click(screen.getByRole('button', { name: 'Save article' }));
    const summary = await screen.findByRole('group', {
      name: 'This article changed while you edited it',
    });
    await user.click(within(summary).getByRole('button', { name: 'Reload article' }));

    expect(
      await within(summary).findByText(
        'Could not reload the article. Check the connection, then try again.',
      ),
    ).toBeDefined();
    expect(field('Name').value).toBe('Axle 20 mm, steel');
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
