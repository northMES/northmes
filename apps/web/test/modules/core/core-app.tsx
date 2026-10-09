// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { coreLinks } from '@northmes/core-contracts';
import { createShellRoutes, ShellProvider } from '@northmes/web-sdk';
import {
  createMemoryHistory,
  createRouter,
  Outlet,
  RouterProvider,
  useParams,
} from '@tanstack/react-router';
import { render, within } from '@testing-library/react';
import { CoreArticle } from '../../../src/modules/core/article.graphql.ts';
import { coreModule } from '../../../src/modules/core/index.ts';
import { CoreArticles } from '../../../src/modules/core/screens/articles/articles.graphql.ts';

/** The plant of every test, as the $plant segment names it. */
export const plant = 'plant-a';

/**
 * The $plant route's component of the tests: the shell state of the plant in the URL, whose first
 * page the user may open is Articles.
 */
function PlantStub() {
  const { plant } = useParams({ strict: false });
  return (
    <ShellProvider
      value={{ plant, home: { label: 'Articles', href: coreLinks.articles({ plant }).href } }}
    >
      <main>
        <Outlet />
      </main>
    </ShellProvider>
  );
}

/** The company settings route's component of the tests: the page alone, without a plant. */
function SettingsStub() {
  return (
    <main>
      <Outlet />
    </main>
  );
}

/**
 * Renders the core module's routes at href, at a plant or in company settings, with a MockedProvider that answers each of mocks once,
 * and returns the router, whose state.location shows the URL.
 */
export function renderCoreAt(href: string, mocks: readonly MockLink.MockedResponse[]) {
  const router = createRouter({
    routeTree: createShellRoutes({
      modules: [coreModule],
      plantComponent: PlantStub,
      settingsComponent: SettingsStub,
    }),
    history: createMemoryHistory({ initialEntries: [href] }),
  });
  render(
    <MockedProvider mocks={mocks}>
      <RouterProvider router={router} />
    </MockedProvider>,
  );
  return router;
}

/** A fictional article as the API returns it. */
export interface ArticleNode {
  readonly __typename: 'Article';
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly version: number;
  readonly archivedAt: string | null;
  readonly updatedAt: string;
  readonly allPlants: boolean;
  readonly plants: readonly PlantNode[];
}

/** A plant of an article, as the API returns it. */
export interface PlantNode {
  readonly __typename: 'Plant';
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

/** The plants of the tests' company, Acme AB, by name: Plant A is the plant every test opens. */
export const plants = {
  a: {
    __typename: 'Plant',
    id: '019a0000-0000-7000-8000-00000000a001',
    slug: 'plant-a',
    name: 'Plant A',
  },
  b: {
    __typename: 'Plant',
    id: '019a0000-0000-7000-8000-00000000a002',
    slug: 'plant-b',
    name: 'Plant B',
  },
  c: {
    __typename: 'Plant',
    id: '019a0000-0000-7000-8000-00000000a003',
    slug: 'plant-c',
    name: 'Plant C',
  },
} as const satisfies Record<string, PlantNode>;

/** When the fixtures' articles last changed: 2026-10-05 14:07 in the browser's time zone. */
export const lastChanged = new Date(2026, 9, 5, 14, 7).toISOString();

/** lastChanged as the Last changed column shows it. */
export const lastChangedText = '2026-10-05 14:07';

/**
 * A fictional article with an id made from its code, active unless archivedAt says otherwise,
 * assigned to Plant A.
 */
export function article(
  code: string,
  name: string,
  version = 1,
  archivedAt: string | null = null,
  updatedAt = lastChanged,
): ArticleNode {
  const digits = [...code].map((char) => char.charCodeAt(0).toString(16)).join('');
  const id = `019a0000-0000-7000-8000-${digits.padStart(12, '0').slice(-12)}`;
  return {
    __typename: 'Article',
    id,
    code,
    name,
    version,
    archivedAt,
    updatedAt,
    allPlants: false,
    plants: [plants.a],
  };
}

/** The polite live region's text. */
export function spoken(): string | null | undefined {
  return document.querySelector('[aria-live="polite"]')?.textContent;
}

/** count fictional articles, from AX-500 on, as one page of the list. */
export function articleRange(count: number, first = 500): ArticleNode[] {
  return Array.from({ length: count }, (_, index) =>
    article(`AX-${first + index}`, `Axle ${first + index} mm`),
  );
}

/** The cursor of an article in a page. */
export function cursorOf(node: ArticleNode): string {
  return `cursor-${node.code}`;
}

interface PageOptions {
  readonly totalCount: number;
  readonly hasNextPage?: boolean;
  readonly hasPreviousPage?: boolean;
}

/** The answer of coreArticles with these articles as its page. */
export function articlesPage(
  nodes: readonly ArticleNode[],
  { totalCount, hasNextPage = false, hasPreviousPage = false }: PageOptions,
) {
  return {
    data: {
      coreArticles: {
        __typename: 'ArticleConnection',
        totalCount,
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage,
          hasPreviousPage,
          startCursor: nodes[0] === undefined ? null : cursorOf(nodes[0]),
          endCursor: nodes.at(-1) === undefined ? null : cursorOf(nodes.at(-1) as ArticleNode),
        },
        edges: nodes.map((node) => ({ __typename: 'ArticleEdge', cursor: cursorOf(node), node })),
      },
    },
  };
}

/**
 * The variables of the first page, newest change first, as a list without URL state sends them
 * (design ui-222, A5).
 */
export const firstPage = { first: 25, orderBy: [{ field: 'UPDATED_AT', direction: 'DESC' }] };

/** coreArticles with variables, answered with result. */
export function articlesQuery(
  variables: Record<string, unknown>,
  result: MockLink.MockedResponse['result'],
  delay?: number,
): MockLink.MockedResponse {
  return { request: { query: CoreArticles, variables }, result, delay };
}

/** coreArticle for the article's id, answered with the article. */
export function articleQuery(node: ArticleNode): MockLink.MockedResponse {
  return {
    request: { query: CoreArticle, variables: { id: node.id } },
    result: { data: { coreArticle: node } },
  };
}

/** The text of each cell of each body row of a table. */
export function bodyRows(table: HTMLElement): (string | null)[][] {
  const [, ...rows] = within(table).getAllByRole('row');
  return rows.map((row) =>
    within(row)
      .getAllByRole('cell')
      .map((cell) => cell.textContent),
  );
}
