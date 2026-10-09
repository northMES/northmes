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
            input: { id: shared.id, expectedVersion: 1, code: 'AX-500', name: 'Axle 22 mm' },
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
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    const summary = await screen.findByRole('group', { name: 'Fix 1 field to save the article' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    await user.click(
      within(summary).getByRole('link', { name: 'Choose at least one plant, or All plants.' }),
    );
    expect(document.activeElement).toBe(plantA);
  });

  it('ADR0073-W2 New article lists a missing number, a missing name and a missing plant in one save', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.articles.new({ plant }).href, [assigner(), companiesQuery()]);

    const plantsSection = await screen.findByRole('region', { name: 'Plants' });
    await user.click(await within(plantsSection).findByRole('checkbox', { name: 'Plant A' }));
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    const summary = await screen.findByRole('group', { name: 'Fix 3 fields to save the article' });
    expect(
      within(summary).getByRole('link', { name: 'Choose at least one plant, or All plants.' }),
    ).toBeDefined();
  });

  it('ADR0073-W2 Save plants without a plant moves focus to the first plant, which the message describes', async () => {
    const user = userEvent.setup();
    const axle = article('AX-500', 'Axle 20 mm');
    renderCoreAt(coreLinks.articles.article({ plant, articleId: axle.id }).href, [
      articleQuery(axle),
      assigner(),
      companiesQuery(),
    ]);

    const plantsSection = await screen.findByRole('region', { name: 'Plants' });
    const plantA = await within(plantsSection).findByRole('checkbox', { name: 'Plant A' });
    await user.click(plantA);
    await user.click(within(plantsSection).getByRole('button', { name: 'Save plants' }));

    await waitFor(() => expect(document.activeElement).toBe(plantA));
    const message = within(plantsSection).getByText('Choose at least one plant, or All plants.');
    expect(plantA.getAttribute('aria-describedby')?.split(' ')).toContain(message.id);
  });

  it('ADR0073-W2 Save plants refused for a stale version says so and shows the saved plants', async () => {
    const user = userEvent.setup();
    const axle = article('AX-500', 'Axle 20 mm', 3);
    const saved = withPlants({ ...axle, version: 4 }, false, [plants.a, plants.c]);
    renderCoreAt(coreLinks.articles.article({ plant, articleId: axle.id }).href, [
      articleQuery(axle),
      assigner(),
      companiesQuery(),
      {
        request: {
          query: CoreSetArticlePlants,
          variables: {
            input: {
              id: axle.id,
              expectedVersion: 3,
              allPlants: false,
              plants: ['plant-a', 'plant-b'],
            },
          },
        },
        result: {
          data: null,
          errors: [
            {
              message: `Article ${axle.id} is at version 4, and the change was made on version 3`,
              path: ['coreSetArticlePlants'],
              extensions: { code: 'CONFLICT', errorCode: 'core.version_conflict' },
            },
          ],
        },
      },
      articleQuery(saved),
    ]);

    const plantsSection = await screen.findByRole('region', { name: 'Plants' });
    await user.click(await within(plantsSection).findByRole('checkbox', { name: 'Plant B' }));
    await user.click(within(plantsSection).getByRole('button', { name: 'Save plants' }));

    expect((await within(plantsSection).findByRole('alert')).textContent).toBe(
      'Someone changed this article after you opened it. The page now shows the saved plants. Check them, then save again.',
    );
    const checked = (name: string) =>
      within(plantsSection).getByRole('checkbox', { name }).getAttribute('aria-checked');
    expect([checked('Plant A'), checked('Plant B'), checked('Plant C')]).toEqual([
      'true',
      'false',
      'true',
    ]);
  });

  it('ADR0073-W2 Save plants refused with core.forbidden names the permission at the company, core.archived says the article is archived, another refusal shows the API message, and only a save without an answer asks to check the connection', async () => {
    const axle = article('AX-500', 'Axle 20 mm', 3);
    const refusal = (message: string, code: string, errorCode: string) => ({
      result: {
        data: null,
        errors: [{ message, path: ['coreSetArticlePlants'], extensions: { code, errorCode } }],
      },
    });
    const cases = [
      {
        answer: refusal(
          `You need core.article:assign at scope ${axle.id}`,
          'FORBIDDEN',
          'core.forbidden',
        ),
        shown:
          'You do not have permission to change the plants of this article. This needs the permission to assign articles to plants (core.article:assign) at Acme AB.',
      },
      {
        answer: refusal(
          'Article AX-500 is archived, and an archived article cannot be changed until it is restored',
          'PRECONDITION',
          'core.archived',
        ),
        shown:
          'This article is archived. Archived articles cannot be changed until they are restored.',
      },
      {
        answer: refusal(
          'No plant of the company has the slug plant-b.',
          'BAD_USER_INPUT',
          'core.plant_unknown',
        ),
        shown: 'Could not save the plants. No plant of the company has the slug plant-b.',
      },
      {
        answer: { error: new Error('Failed to fetch') },
        shown: 'Could not save the plants. Check the connection, then try again.',
      },
    ];
    for (const { answer, shown } of cases) {
      const user = userEvent.setup();
      renderCoreAt(coreLinks.articles.article({ plant, articleId: axle.id }).href, [
        articleQuery(axle),
        assigner(),
        companiesQuery(),
        {
          request: {
            query: CoreSetArticlePlants,
            variables: {
              input: {
                id: axle.id,
                expectedVersion: 3,
                allPlants: false,
                plants: ['plant-a', 'plant-b'],
              },
            },
          },
          ...answer,
        } as MockLink.MockedResponse,
      ]);

      const plantsSection = await screen.findByRole('region', { name: 'Plants' });
      await user.click(await within(plantsSection).findByRole('checkbox', { name: 'Plant B' }));
      await user.click(within(plantsSection).getByRole('button', { name: 'Save plants' }));

      expect(await within(plantsSection).findByText(shown)).toBeDefined();
      cleanup();
    }
  });
});
