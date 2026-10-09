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

/**
 * Renders the core module's routes at href, with a MockedProvider that answers each of mocks once,
 * and returns the router, whose state.location shows the URL.
 */
export function renderCoreAt(href: string, mocks: readonly MockLink.MockedResponse[]) {
  const router = createRouter({
    routeTree: createShellRoutes({ modules: [coreModule], plantComponent: PlantStub }),
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
}

/** A fictional article with an id made from its code, active unless archivedAt says otherwise. */
export function article(
  code: string,
  name: string,
  version = 1,
  archivedAt: string | null = null,
): ArticleNode {
  const digits = [...code].map((char) => char.charCodeAt(0).toString(16)).join('');
  const id = `019a0000-0000-7000-8000-${digits.padStart(12, '0').slice(-12)}`;
  return { __typename: 'Article', id, code, name, version, archivedAt };
}

/** The polite live region's text. */
export function spoken(): string | null | undefined {
  return document.querySelector('[aria-live="polite"]')?.textContent;
}

/** count fictional articles, from AX-500 on, as one page of a list sorted by article number. */
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

/** The variables of the first page by article number, as a list without URL state sends them. */
export const firstPage = { first: 25, orderBy: [{ field: 'CODE', direction: 'ASC' }] };

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
