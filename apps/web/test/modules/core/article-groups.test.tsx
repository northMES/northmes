// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreArticleGroups } from '../../../src/modules/core/article-groups.graphql.ts';
import { CoreArchiveArticleGroup } from '../../../src/modules/core/screens/article-group/archive-article-group.graphql.ts';
import { CoreArticleGroup } from '../../../src/modules/core/screens/article-group/article-group.graphql.ts';
import { CoreUpdateArticleGroup } from '../../../src/modules/core/screens/article-group/update-article-group.graphql.ts';
import { CoreCreateArticle } from '../../../src/modules/core/screens/new-article/create-article.graphql.ts';
import { CoreCreateArticleGroup } from '../../../src/modules/core/screens/new-article-group/create-article-group.graphql.ts';
import { viewerQuery } from './access-fixtures.ts';
import {
  article,
  articleQuery,
  bodyRows,
  lastChanged,
  lastChangedText,
  plant,
  renderCoreAt,
  spoken,
} from './core-app.tsx';

afterEach(cleanup);

/** A fictional article group with an id made from its code. */
function group(code: string, name: string, version = 1, archivedAt: string | null = null) {
  const digits = [...code].map((char) => char.charCodeAt(0).toString(16)).join('');
  return {
    __typename: 'ArticleGroup' as const,
    id: `019a0000-0000-7000-8000-${digits.padStart(12, '0').slice(-12)}`,
    code,
    name,
    version,
    archivedAt,
    updatedAt: lastChanged,
  };
}

const flanges = group('FL', 'Flanges');
const consumables = group('CO', 'Consumables');

/**
 * coreArticleGroups, with or without the archived ones, answered with these groups: the first
 * page, or with `after` and `next` the page after that cursor and the cursor of the page after it.
 */
function groupsQuery(
  groups: readonly ReturnType<typeof group>[],
  includeArchived = false,
  { after, next, totalCount }: { after?: string; next?: string; totalCount?: number } = {},
): MockLink.MockedResponse {
  return {
    request: {
      query: CoreArticleGroups,
      variables: after === undefined ? { includeArchived } : { includeArchived, after },
    },
    result: {
      data: {
        coreArticleGroups: {
          __typename: 'ArticleGroupConnection',
          totalCount: totalCount ?? groups.length,
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: next !== undefined,
            endCursor: next ?? null,
          },
          edges: groups.map((node) => ({ __typename: 'ArticleGroupEdge', node })),
        },
      },
    },
  };
}

/** The textbox named label. */
function field(label: string): HTMLInputElement {
  return screen.getByRole('textbox', { name: label }) as HTMLInputElement;
}

describe('article groups', () => {
  it("E06-S06 Article groups lists the company's groups by code, each code a link to its page, and offers New article group to a holder of core.articleGroup:create at the company", async () => {
    renderCoreAt(coreLinks.articleGroups({ plant }).href, [
      groupsQuery([consumables, flanges]),
      viewerQuery(['core.articleGroup:read'], ['core.articleGroup:create']),
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Article groups' })).toBeDefined();
    const table = await screen.findByRole('table', { name: 'Article groups' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(2));
    expect(bodyRows(table)).toEqual([
      ['CO', 'Consumables', lastChangedText],
      ['FL', 'Flanges', lastChangedText],
    ]);
    expect(within(table).getByRole('link', { name: 'FL' }).getAttribute('href')).toBe(
      coreLinks.articleGroups.articleGroup({ plant, articleGroupId: flanges.id }).href,
    );
    expect(await screen.findByRole('link', { name: 'New article group' })).toBeDefined();
  });

  it('E06-S06 Article groups and the article form read every page of the groups, past the first', async () => {
    const hoses = group('HO', 'Hoses');
    renderCoreAt(coreLinks.articleGroups({ plant }).href, [
      groupsQuery([consumables, flanges], false, { next: 'page-2', totalCount: 3 }),
      groupsQuery([hoses], false, { after: 'page-2', totalCount: 3 }),
      viewerQuery(['core.articleGroup:read']),
    ]);

    const table = await screen.findByRole('table', { name: 'Article groups' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(3));
    expect(bodyRows(table).map((row) => row[0])).toEqual(['CO', 'FL', 'HO']);
    cleanup();

    renderCoreAt(coreLinks.articles.new({ plant }).href, [
      groupsQuery([consumables, flanges], false, { next: 'page-2', totalCount: 3 }),
      groupsQuery([hoses], false, { after: 'page-2', totalCount: 3 }),
    ]);
    const select = (await screen.findByRole('combobox', {
      name: 'Article group (optional)',
    })) as HTMLSelectElement;
    await waitFor(() =>
      expect([...select.options].map((option) => option.textContent)).toEqual([
        'Choose a group',
        'Consumables',
        'Flanges',
        'Hoses',
      ]),
    );
  });

  it('E06-S06 a later page of groups that fails to load says so with Try again, which loads it', async () => {
    const user = userEvent.setup();
    const hoses = group('HO', 'Hoses');
    renderCoreAt(coreLinks.articleGroups({ plant }).href, [
      groupsQuery([consumables, flanges], false, { next: 'page-2', totalCount: 3 }),
      {
        request: {
          query: CoreArticleGroups,
          variables: { includeArchived: false, after: 'page-2' },
        },
        error: new Error('Network down'),
      },
      groupsQuery([hoses], false, { after: 'page-2', totalCount: 3 }),
      viewerQuery(['core.articleGroup:read']),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    const table = await screen.findByRole('table', { name: 'Article groups' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(3));
  });

  it('E06-S06 a Plant admin reads the article groups without New article group', async () => {
    renderCoreAt(coreLinks.articleGroups({ plant }).href, [
      groupsQuery([flanges]),
      viewerQuery(['core.articleGroup:read']),
    ]);

    await screen.findByRole('table', { name: 'Article groups' });
    // The viewer's answer arrives after the list; give it the time to show any action.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('link', { name: 'New article group' })).toBeNull();
  });

  it('E06-S06 New article group saves the trimmed code and name, returns to the list and announces the group', async () => {
    const user = userEvent.setup();
    const sent: Record<string, unknown>[] = [];
    const router = renderCoreAt(coreLinks.articleGroups.new({ plant }).href, [
      {
        request: {
          query: CoreCreateArticleGroup,
          variables: ({ input }: { input: Record<string, unknown> }) => {
            sent.push(input);
            return true;
          },
        },
        result: ({ input }: { input: { id: string } }) => ({
          data: { coreCreateArticleGroup: { ...group('HO', 'Hoses'), id: input.id } },
        }),
      } as MockLink.MockedResponse,
      groupsQuery([group('HO', 'Hoses')]),
    ]);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'New article group' }),
    ).toBeDefined();
    await user.type(field('Code'), ' HO ');
    await user.type(field('Name'), 'Hoses ');
    await user.click(screen.getByRole('button', { name: 'Save article group' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Article groups' })).toBeDefined();
    expect(router.state.location.pathname).toBe(coreLinks.articleGroups({ plant }).href);
    expect(sent).toEqual([{ id: expect.any(String), code: 'HO', name: 'Hoses' }]);
    await waitFor(() => expect(spoken()).toBe('Article group HO created'));
  });

  it("E06-S06 a group's page is its edit form: Save sends expectedVersion, and Archive asks first and archives the group", async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.articleGroups.articleGroup({ plant, articleGroupId: flanges.id }).href, [
      {
        request: { query: CoreArticleGroup, variables: { id: flanges.id } },
        result: { data: { coreArticleGroup: flanges } },
      },
      viewerQuery(
        ['core.articleGroup:read'],
        ['core.articleGroup:update', 'core.articleGroup:archive'],
      ),
      {
        request: {
          query: CoreArchiveArticleGroup,
          variables: { input: { id: flanges.id, expectedVersion: 1 } },
        },
        result: {
          data: { coreArchiveArticleGroup: { ...flanges, version: 2, archivedAt: lastChanged } },
        },
      },
    ]);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Article group FL' }),
    ).toBeDefined();
    expect(field('Name').value).toBe('Flanges');
    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Archive article group FL?' });
    await user.click(within(dialog).getByRole('button', { name: 'Archive article group' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(await screen.findByText('Archived')).toBeDefined();
    await waitFor(() => expect(spoken()).toBe('Article group FL archived'));
  });

  it('E06-S06 Save on a group sends the changed name with the version the form was filled from', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.articleGroups.articleGroup({ plant, articleGroupId: flanges.id }).href, [
      {
        request: { query: CoreArticleGroup, variables: { id: flanges.id } },
        result: { data: { coreArticleGroup: flanges } },
      },
      viewerQuery(['core.articleGroup:read'], ['core.articleGroup:update']),
      {
        request: {
          query: CoreUpdateArticleGroup,
          variables: {
            input: { id: flanges.id, expectedVersion: 1, code: 'FL', name: 'Flanges, steel' },
          },
        },
        result: {
          data: { coreUpdateArticleGroup: { ...flanges, name: 'Flanges, steel', version: 2 } },
        },
      },
      groupsQuery([{ ...flanges, name: 'Flanges, steel', version: 2 }]),
    ]);

    // The form is read-only until the viewer's permissions say the user may change the group.
    const save = await screen.findByRole('button', { name: 'Save article group' });
    await user.type(screen.getByRole('textbox', { name: 'Name' }), ', steel');
    await user.click(save);

    expect(await screen.findByRole('heading', { level: 1, name: 'Article groups' })).toBeDefined();
    await waitFor(() => expect(spoken()).toBe('Article group FL saved'));
  });

  it("E06-S06 the article form offers the company's active groups, and New article saves the chosen one", async () => {
    const user = userEvent.setup();
    const sent: Record<string, unknown>[] = [];
    renderCoreAt(coreLinks.articles.new({ plant }).href, [
      groupsQuery([consumables, flanges]),
      {
        request: {
          query: CoreCreateArticle,
          variables: ({ input }: { input: Record<string, unknown> }) => {
            sent.push(input);
            return true;
          },
        },
        result: ({ input }: { input: { id: string; code: string; name: string } }) => ({
          data: {
            coreCreateArticle: {
              ...article(input.code, input.name),
              id: input.id,
              articleGroup: flanges,
            },
          },
        }),
      } as MockLink.MockedResponse,
    ]);

    const select = (await screen.findByRole('combobox', {
      name: 'Article group (optional)',
    })) as HTMLSelectElement;
    await waitFor(() =>
      expect([...select.options].map((option) => option.textContent)).toEqual([
        'Choose a group',
        'Consumables',
        'Flanges',
      ]),
    );
    await user.type(field('Article number'), 'AX-20410');
    await user.type(field('Name'), 'Fläns DN50 rostfri');
    await user.selectOptions(select, 'Flanges');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Stock unit' }), 'Pieces (pcs)');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Article AX-20410' }),
    ).toBeDefined();
    expect(sent[0]).toMatchObject({ articleGroupId: flanges.id });
  });

  it("E06-S06 an article's page names its group in Classification, or says it has none", async () => {
    const grouped = { ...article('AX-20410', 'Fläns'), articleGroup: flanges };
    renderCoreAt(coreLinks.articles.article({ plant, articleId: grouped.id }).href, [
      articleQuery(grouped),
    ]);

    await screen.findByRole('heading', { level: 1, name: 'Article AX-20410' });
    const classification = screen.getByRole('region', { name: 'Classification' });
    expect(within(classification).getByText('Flanges')).toBeDefined();
    cleanup();

    const plain = article('AX-500', 'Axle');
    renderCoreAt(coreLinks.articles.article({ plant, articleId: plain.id }).href, [
      articleQuery(plain),
    ]);
    await screen.findByRole('heading', { level: 1, name: 'Article AX-500' });
    expect(
      within(screen.getByRole('region', { name: 'Classification' })).getByText('No article group'),
    ).toBeDefined();
  });
});
