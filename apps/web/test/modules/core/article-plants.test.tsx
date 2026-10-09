// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreCompanies } from '../../../src/modules/core/companies.graphql.ts';
import { CoreSetArticlePlants } from '../../../src/modules/core/screens/article/set-article-plants.graphql.ts';
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

/** An article with these plants. */
function withPlants(node: ArticleNode, allPlants: boolean, assigned: ArticleNode['plants']) {
  return { ...node, allPlants, plants: assigned };
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
        ['AX-500', 'Axle 20 mm', 'All plants', lastChangedText],
        ['AX-510', 'Axle 25 mm', 'Plant A', lastChangedText],
        ['AX-520', 'Axle 30 mm', 'Plant A, Plant B', lastChangedText],
        ['AX-530', 'Axle 35 mm', '3 plants', lastChangedText],
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
                version: 1,
                archivedAt: null,
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

  it("ADR0073-W2 an article's page names its plants, and a holder of core.article:assign at the company adds a plant with Save plants", async () => {
    const user = userEvent.setup();
    const axle = article('AX-500', 'Axle 20 mm', 3);
    const sent: unknown[] = [];
    renderCoreAt(coreLinks.articles.article({ plant, articleId: axle.id }).href, [
      articleQuery(axle),
      assigner(),
      companiesQuery(),
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
              version: 4,
              allPlants: false,
              plants: [plants.a, plants.b],
            },
          },
        },
      } as MockLink.MockedResponse,
    ]);

    const identity = await screen.findByRole('region', { name: 'Identity' });
    await waitFor(() => expect(within(identity).getByText('Plant A')).toBeDefined());
    const plantsSection = await screen.findByRole('region', { name: 'Plants' });
    await user.click(await within(plantsSection).findByRole('checkbox', { name: 'Plant B' }));
    await user.click(within(plantsSection).getByRole('button', { name: 'Save plants' }));

    await waitFor(() => expect(spoken()).toBe('Plants of article AX-500 saved'));
    expect(sent).toEqual([
      { id: axle.id, expectedVersion: 3, allPlants: false, plants: ['plant-a', 'plant-b'] },
    ]);
    await waitFor(() => expect(within(identity).getByText('Plant A, Plant B')).toBeDefined());
  });

  it("ADR0073-W2 an article's page shows a Plant admin the plants but no Plants section", async () => {
    const axle = article('AX-500', 'Axle 20 mm');
    renderCoreAt(coreLinks.articles.article({ plant, articleId: axle.id }).href, [
      articleQuery(axle),
      plantAdmin(),
    ]);

    const identity = await screen.findByRole('region', { name: 'Identity' });
    await waitFor(() => expect(within(identity).getByText('Plant A')).toBeDefined());
    expect(screen.queryByRole('region', { name: 'Plants' })).toBeNull();
  });
});
