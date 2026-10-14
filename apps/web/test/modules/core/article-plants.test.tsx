// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreCompanies } from '../../../src/modules/core/companies.graphql.ts';
import { CoreArchiveArticle } from '../../../src/modules/core/screens/article/archive-article.graphql.ts';
import { CoreSetArticlePlants } from '../../../src/modules/core/screens/article/set-article-plants.graphql.ts';
import { CoreUpdateArticle } from '../../../src/modules/core/screens/edit-article/update-article.graphql.ts';
import { CoreCreateArticle } from '../../../src/modules/core/screens/new-article/create-article.graphql.ts';
import { viewerQuery } from './access-fixtures.ts';
import {
  type ArticleNode,
  article,
  articleQuery,
  articlesPage,
  articlesQuery,
  bodyRows,
  firstPage,
  lastChanged,
  lastChangedText,
  plant,
  plants,
  renderCoreAt,
  spoken,
} from './core-app.tsx';

afterEach(cleanup);

/** coreCompanies: Acme AB with Plant A, Plant B and Plant C. */
function companiesQuery(): MockLink.MockedResponse {
  return {
    request: { query: CoreCompanies },
    result: {
      data: {
        coreCompanies: [
          {
            __typename: 'Company',
            id: '019a0000-0000-7000-8000-0000000c0001',
            name: 'Acme AB',
            plants: [plants.a, plants.b, plants.c],
          },
        ],
      },
    },
  };
}

/** The viewer of a user who holds core.article:assign at the company, and every article action. */
const assigner = () =>
  viewerQuery(
    ['core.article:read', 'core.article:create', 'core.article:update'],
    ['core.article:read', 'core.article:create', 'core.article:assign'],
  );

/** The viewer of a Plant admin, who does not hold core.article:assign. */
const plantAdmin = () =>
  viewerQuery(['core.article:read', 'core.article:create', 'core.article:update'], []);

/** The viewer of a Plant admin, who changes and archives articles at the plant only. */
const plantEditor = () =>
  viewerQuery(['core.article:read', 'core.article:update', 'core.article:archive'], []);

/** The viewer of a user who changes and archives articles at the company. */
const companyEditor = () =>
  viewerQuery(
    ['core.article:read', 'core.article:update', 'core.article:archive'],
    ['core.article:read', 'core.article:update', 'core.article:archive'],
  );

/** The answer of a command that the principal may not run where the article is changed. */
function forbiddenAnswer(field: string) {
  return {
    data: null,
    errors: [
      {
        message: 'You need core.article:update at the scope of Article 019a',
        path: [field],
        extensions: { code: 'FORBIDDEN', errorCode: 'core.forbidden' },
      },
    ],
  };
}

/** An article with these plants. */
function withPlants(node: ArticleNode, allPlants: boolean, assigned: ArticleNode['plants']) {
  return { ...node, allPlants, plants: assigned };
}

/** coreUpdateArticle of an article with its saved values, answered with result. */
function updateOf(
  node: ArticleNode,
  result: MockLink.MockedResponse['result'],
): MockLink.MockedResponse {
  return {
    request: {
      query: CoreUpdateArticle,
      variables: {
        input: {
          id: node.id,
          expectedVersion: node.version,
          code: node.code,
          name: node.name,
          stockUnit: 'PIECE',
          note: '',
          translations: [],
          articleGroupId: '',
        },
      },
    },
    result,
  };
}

/** coreSetArticlePlants of Plant A and Plant B on this version, answered with result. */
function plantsAnswer(
  id: string,
  expectedVersion: number,
  result: MockLink.MockedResponse['result'],
): MockLink.MockedResponse {
  return {
    request: {
      query: CoreSetArticlePlants,
      variables: {
        input: { id, expectedVersion, allPlants: false, plants: ['plant-a', 'plant-b'] },
      },
    },
    result,
  };
}

interface CreateInput {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly allPlants?: boolean;
  readonly plants?: readonly string[];
}

describe("an article's plants", () => {
  it("ADR0073-W2 the articles list shows each article's plants: All plants, one or two names, or the number from three on", async () => {
    const rows = [
      withPlants(article('AX-500', 'Axle 20 mm'), true, []),
      withPlants(article('AX-510', 'Axle 25 mm'), false, [plants.a]),
      withPlants(article('AX-520', 'Axle 30 mm'), false, [plants.a, plants.b]),
      withPlants(article('AX-530', 'Axle 35 mm'), false, [plants.a, plants.b, plants.c]),
    ];
    renderCoreAt(coreLinks.articles({ plant }).href, [
      articlesQuery(firstPage, articlesPage(rows, { totalCount: 4 })),
    ]);

    const table = await screen.findByRole('table', { name: 'Articles' });

    await waitFor(() =>
      expect(bodyRows(table)).toEqual([
        ['AX-500', 'Axle 20 mm', 'All plants', '', 'pcs', 'NorthMES', lastChangedText],
        ['AX-510', 'Axle 25 mm', 'Plant A', '', 'pcs', 'NorthMES', lastChangedText],
        ['AX-520', 'Axle 30 mm', 'Plant A, Plant B', '', 'pcs', 'NorthMES', lastChangedText],
        ['AX-530', 'Axle 35 mm', '3 plants', '', 'pcs', 'NorthMES', lastChangedText],
      ]),
    );
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toContain('Plants');
  });

  it('ADR0073-W2 New article offers a holder of core.article:assign at the company the Plants field at the plant in the URL, and All plants sends allPlants', async () => {
    const user = userEvent.setup();
    const sent: CreateInput[] = [];
    renderCoreAt(coreLinks.articles.new({ plant }).href, [
      assigner(),
      companiesQuery(),
      {
        request: {
          query: CoreCreateArticle,
          variables: ({ input }: { input: CreateInput }) => input.code === 'BR-900',
        },
        result: ({ input }: { input: CreateInput }) => {
          sent.push(input);
          return {
            data: {
              coreCreateArticle: {
                __typename: 'Article',
                id: input.id,
                code: input.code,
                name: input.name,
                translations: [],
                articleGroup: null,
                stockUnit: 'PIECE',
                note: null,
                source: null,
                version: 1,
                archivedAt: null,
                createdAt: lastChanged,
                updatedAt: lastChanged,
                allPlants: true,
                plants: [],
              },
            },
          };
        },
      } as MockLink.MockedResponse,
    ]);

    const plantsSection = await screen.findByRole('region', { name: 'Plants' });
    const plantA = await within(plantsSection).findByRole('checkbox', { name: 'Plant A' });
    expect(plantA.getAttribute('aria-checked')).toBe('true');
    expect(
      within(plantsSection).getByRole('checkbox', { name: 'Plant B' }).getAttribute('aria-checked'),
    ).toBe('false');
    await user.type(screen.getByRole('textbox', { name: 'Article number' }), 'BR-900');
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Wall bracket 90 mm');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Stock unit' }), 'Pieces (pcs)');
    await user.click(within(plantsSection).getByRole('radio', { name: 'All plants' }));
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ code: 'BR-900', allPlants: true, plants: [] });
  });

  it('ADR0073-W2 New article refuses Chosen plants with no plant on the field, and sends nothing', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.articles.new({ plant }).href, [assigner(), companiesQuery()]);

    const plantsSection = await screen.findByRole('region', { name: 'Plants' });
    await user.click(await within(plantsSection).findByRole('checkbox', { name: 'Plant A' }));
    await user.type(screen.getByRole('textbox', { name: 'Article number' }), 'BR-901');
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Wall bracket');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    expect(
      await within(plantsSection).findByText('Choose at least one plant, or All plants.'),
    ).toBeDefined();
  });

  it('ADR0073-W2 New article shows a Plant admin no Plants field', async () => {
    renderCoreAt(coreLinks.articles.new({ plant }).href, [plantAdmin()]);

    expect(await screen.findByRole('heading', { level: 1, name: 'New article' })).toBeDefined();
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Identity' })).not.toBeNull());
    expect(screen.queryByRole('region', { name: 'Plants' })).toBeNull();
  });

  it("ADR0073-W2 an article's page names its plants and offers a holder of core.article:assign at the company no Plants section, which Edit holds", async () => {
    const axle = article('AX-500', 'Axle 20 mm');
    renderCoreAt(coreLinks.articles.article({ plant, articleId: axle.id }).href, [
      articleQuery(axle),
      assigner(),
      companiesQuery(),
    ]);

    const origin = await screen.findByRole('region', { name: 'Origin' });
    await waitFor(() => expect(within(origin).getByText('Plant A')).toBeDefined());
    // The viewer's answer arrives after the article; give it the time to show any section.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('region', { name: 'Plants' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save plants' })).toBeNull();
  });

  it('ADR0073-W2 Edit article offers a holder of core.article:assign at the company the Plants field filled with the plants, and Save article sends a changed choice with the version the update answered', async () => {
    const user = userEvent.setup();
    const axle = article('AX-500', 'Axle 20 mm', 3);
    const sent: unknown[] = [];
    renderCoreAt(coreLinks.articles.article.edit({ plant, articleId: axle.id }).href, [
      articleQuery(axle),
      assigner(),
      companiesQuery(),
      updateOf(axle, { data: { coreUpdateArticle: { ...axle, version: 4 } } }),
      {
        request: {
          query: CoreSetArticlePlants,
          variables: (variables: Record<string, unknown>) => {
            sent.push(variables.input);
            return true;
          },
        },
        result: {
          data: {
            coreSetArticlePlants: {
              __typename: 'Article',
              id: axle.id,
              version: 5,
              allPlants: false,
              plants: [plants.a, plants.b],
            },
          },
        },
      } as MockLink.MockedResponse,
    ]);

    const plantsSection = await screen.findByRole('region', { name: 'Plants' });
    const plantA = await within(plantsSection).findByRole('checkbox', { name: 'Plant A' });
    expect(plantA.getAttribute('aria-checked')).toBe('true');
    await user.click(within(plantsSection).getByRole('checkbox', { name: 'Plant B' }));
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Article AX-500' })).toBeDefined();
    expect(sent).toEqual([
      { id: axle.id, expectedVersion: 4, allPlants: false, plants: ['plant-a', 'plant-b'] },
    ]);
    const origin = await screen.findByRole('region', { name: 'Origin' });
    await waitFor(() => expect(within(origin).getByText('Plant A, Plant B')).toBeDefined());
  });

  it('ADR0073-W2 Edit article saves unchanged plants without core.setArticlePlants', async () => {
    const user = userEvent.setup();
    const axle = article('AX-500', 'Axle 20 mm', 3);
    renderCoreAt(coreLinks.articles.article.edit({ plant, articleId: axle.id }).href, [
      articleQuery(axle),
      assigner(),
      companiesQuery(),
      updateOf(
        { ...axle, name: 'Axle 22 mm' },
        { data: { coreUpdateArticle: { ...axle, name: 'Axle 22 mm', version: 4 } } },
      ),
    ]);

    const plantsSection = await screen.findByRole('region', { name: 'Plants' });
    await within(plantsSection).findByRole('checkbox', { name: 'Plant A' });
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Axle 22 mm');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Article AX-500' })).toBeDefined();
    await waitFor(() => expect(spoken()).toBe('Article AX-500 saved'));
  });

  it('ADR0073-W2 Edit article shows a Plant admin no Plants field', async () => {
    const axle = article('AX-500', 'Axle 20 mm');
    renderCoreAt(coreLinks.articles.article.edit({ plant, articleId: axle.id }).href, [
      articleQuery(axle),
      plantEditor(),
    ]);

    expect(await screen.findByRole('textbox', { name: 'Name' })).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('region', { name: 'Plants' })).toBeNull();
  });
  it("ADR0073-W2 an article's page shows a Plant admin the plants but no Plants section", async () => {
    const axle = article('AX-500', 'Axle 20 mm');
    renderCoreAt(coreLinks.articles.article({ plant, articleId: axle.id }).href, [
      articleQuery(axle),
      plantAdmin(),
    ]);

    const origin = await screen.findByRole('region', { name: 'Origin' });
    await waitFor(() => expect(within(origin).getByText('Plant A')).toBeDefined());
    expect(screen.queryByRole('region', { name: 'Plants' })).toBeNull();
  });
  it('ADR0073-W2 a Plant admin gets Edit and Archive on an article of Plant A alone, and neither on one of Plant A and Plant B or of All plants', async () => {
    const own = article('AX-500', 'Axle 20 mm');
    const cases = [
      { node: own, offered: true },
      { node: withPlants(own, false, [plants.a, plants.b]), offered: false },
      { node: withPlants(own, true, []), offered: false },
    ];
    for (const { node, offered } of cases) {
      renderCoreAt(coreLinks.articles.article({ plant, articleId: node.id }).href, [
        articleQuery(node),
        plantEditor(),
      ]);
      const identity = await screen.findByRole('region', { name: 'Identity' });
      await waitFor(() => expect(within(identity).getByText('Axle 20 mm')).toBeDefined());
      if (offered) {
        expect(await screen.findByRole('link', { name: 'Edit' })).toBeDefined();
        expect(screen.getByRole('button', { name: 'Archive' })).toBeDefined();
      } else {
        // The viewer's answer arrives after the article; give it the time to show any action.
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
      }
      cleanup();
    }
  });

  it('ADR0073-W2 an edit refused with core.forbidden says the user may not change the article, not to try again', async () => {
    const user = userEvent.setup();
    const shared = withPlants(article('AX-500', 'Axle 20 mm'), false, [plants.a, plants.b]);
    renderCoreAt(coreLinks.articles.article.edit({ plant, articleId: shared.id }).href, [
      articleQuery(shared),
      {
        request: {
          query: CoreUpdateArticle,
          variables: {
            input: {
              id: shared.id,
              expectedVersion: 1,
              code: 'AX-500',
              name: 'Axle 22 mm',
              stockUnit: 'PIECE',
              note: '',
              translations: [],
              articleGroupId: '',
            },
          },
        },
        result: forbiddenAnswer('coreUpdateArticle'),
      },
    ]);

    const name = (await screen.findByRole('textbox', { name: 'Name' })) as HTMLInputElement;
    await user.clear(name);
    await user.type(name, 'Axle 22 mm');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    const summary = await screen.findByRole('group', { name: 'Could not save the article' });
    expect(summary.textContent).toContain(
      'You do not have permission to change this article here. An article that more than one plant uses, or All plants, needs the permission at the company. Your entries are kept.',
    );
    expect(summary.textContent).not.toContain('Try again');
    expect(name.value).toBe('Axle 22 mm');
  });

  it('ADR0073-W2 an archive refused with core.forbidden says the user may not archive the article here', async () => {
    const user = userEvent.setup();
    const shared = withPlants(article('AX-500', 'Axle 20 mm'), false, [plants.a, plants.b]);
    renderCoreAt(coreLinks.articles.article({ plant, articleId: shared.id }).href, [
      articleQuery(shared),
      companyEditor(),
      {
        request: {
          query: CoreArchiveArticle,
          variables: { input: { id: shared.id, expectedVersion: 1 } },
        },
        result: forbiddenAnswer('coreArchiveArticle'),
      },
    ]);

    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Archive article' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'You do not have permission to archive this article here. An article that more than one plant uses, or All plants, needs the permission at the company.',
    );
  });

  it('ADR0073-W2 New article lists a save without a plant in the error summary, which takes focus and links to the first plant', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.articles.new({ plant }).href, [assigner(), companiesQuery()]);

    const plantsSection = await screen.findByRole('region', { name: 'Plants' });
    const plantA = await within(plantsSection).findByRole('checkbox', { name: 'Plant A' });
    await user.click(plantA);
    await user.type(screen.getByRole('textbox', { name: 'Article number' }), 'BR-902');
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Wall bracket');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Stock unit' }), 'Pieces (pcs)');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    const summary = await screen.findByRole('group', { name: 'Fix 1 field to save the article' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    await user.click(
      within(summary).getByRole('link', { name: 'Choose at least one plant, or All plants.' }),
    );
    expect(document.activeElement).toBe(plantA);
  });

  it('ADR0073-W2 New article lists a missing number, a missing name, a missing stock unit and a missing plant in one save', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.articles.new({ plant }).href, [assigner(), companiesQuery()]);

    const plantsSection = await screen.findByRole('region', { name: 'Plants' });
    await user.click(await within(plantsSection).findByRole('checkbox', { name: 'Plant A' }));
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    const summary = await screen.findByRole('group', { name: 'Fix 4 fields to save the article' });
    expect(
      within(summary).getByRole('link', { name: 'Choose at least one plant, or All plants.' }),
    ).toBeDefined();
  });

  it('ADR0073-W2 Edit article lists a save without a plant in the error summary and sends nothing', async () => {
    const user = userEvent.setup();
    const axle = article('AX-500', 'Axle 20 mm');
    renderCoreAt(coreLinks.articles.article.edit({ plant, articleId: axle.id }).href, [
      articleQuery(axle),
      assigner(),
      companiesQuery(),
    ]);

    const plantsSection = await screen.findByRole('region', { name: 'Plants' });
    const plantA = await within(plantsSection).findByRole('checkbox', { name: 'Plant A' });
    await user.click(plantA);
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    const summary = await screen.findByRole('group', { name: 'Fix 1 field to save the article' });
    await user.click(
      within(summary).getByRole('link', { name: 'Choose at least one plant, or All plants.' }),
    );
    expect(document.activeElement).toBe(plantA);
  });

  it('ADR0073-W2 Edit article shows a plants change refused for a stale version as the version conflict, with the typed plants kept', async () => {
    const user = userEvent.setup();
    const axle = article('AX-500', 'Axle 20 mm', 3);
    renderCoreAt(coreLinks.articles.article.edit({ plant, articleId: axle.id }).href, [
      articleQuery(axle),
      assigner(),
      companiesQuery(),
      updateOf(axle, { data: { coreUpdateArticle: { ...axle, version: 4 } } }),
      plantsAnswer(axle.id, 4, {
        data: null,
        errors: [
          {
            message: `Article ${axle.id} is at version 5, and the change was made on version 4`,
            path: ['coreSetArticlePlants'],
            extensions: { code: 'CONFLICT', errorCode: 'core.version_conflict' },
          },
        ],
      }),
    ]);

    const plantsSection = await screen.findByRole('region', { name: 'Plants' });
    await user.click(await within(plantsSection).findByRole('checkbox', { name: 'Plant B' }));
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    expect(
      await screen.findByRole('group', { name: 'This article changed while you edited it' }),
    ).toBeDefined();
    expect(
      within(plantsSection).getByRole('checkbox', { name: 'Plant B' }).getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('ADR0073-W2 Edit article shows a plants change refused with core.forbidden as the permission to assign at the company, with the entries kept', async () => {
    const user = userEvent.setup();
    const axle = article('AX-500', 'Axle 20 mm', 3);
    renderCoreAt(coreLinks.articles.article.edit({ plant, articleId: axle.id }).href, [
      articleQuery(axle),
      assigner(),
      companiesQuery(),
      updateOf(axle, { data: { coreUpdateArticle: { ...axle, version: 4 } } }),
      plantsAnswer(axle.id, 4, {
        data: null,
        errors: [
          {
            message: `You need core.article:assign at scope ${axle.id}`,
            path: ['coreSetArticlePlants'],
            extensions: { code: 'FORBIDDEN', errorCode: 'core.forbidden' },
          },
        ],
      }),
    ]);

    const plantsSection = await screen.findByRole('region', { name: 'Plants' });
    await user.click(await within(plantsSection).findByRole('checkbox', { name: 'Plant B' }));
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    const summary = await screen.findByRole('group', { name: 'Could not save the article' });
    expect(summary.textContent).toContain(
      'You do not have permission to change the plants of this article. This needs the permission to assign articles to plants (core.article:assign) at Acme AB. Your entries are kept.',
    );
  });
});
