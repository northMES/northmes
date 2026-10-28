// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { ApolloLink } from '@apollo/client/link';
import { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { coreLinks } from '@northmes/core-contracts';
import {
  ContributionsProvider,
  createShellRoutes,
  ShellProvider,
  type SlotContribution,
} from '@northmes/web-sdk';
import {
  createMemoryHistory,
  createRouter,
  Outlet,
  RouterProvider,
  useParams,
} from '@tanstack/react-router';
import { render, within } from '@testing-library/react';
import { from, mergeMap, tap } from 'rxjs';
import { CoreArticle } from '../../../src/modules/core/article.graphql.ts';
import { coreModule } from '../../../src/modules/core/index.ts';
import type { PlantSettingsSource } from '../../../src/modules/core/plant-settings-data.ts';
import { g1PlantSettingsSource } from '../../../src/modules/core/plant-settings-data-g1.ts';
import { PlantSettingsSourceProvider } from '../../../src/modules/core/plant-settings-source-context.ts';
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
 * Renders the core module's routes at href, at a plant or in company settings, with a
 * MockedProvider that answers each of mocks once and the contributions the shell would give the
 * slots, and returns the router, whose state.location shows the URL. A hold from holdRequests
 * keeps its requests from the mocks until the test releases them. The plant settings pages read
 * plantSettingsSource, the fixture G1 when the test gives none.
 */
export function renderCoreAt(
  href: string,
  mocks: readonly MockLink.MockedResponse[],
  {
    contributions = [],
    hold,
    plantSettingsSource = g1PlantSettingsSource,
  }: {
    readonly contributions?: readonly SlotContribution[];
    readonly hold?: ApolloLink;
    readonly plantSettingsSource?: PlantSettingsSource;
  } = {},
) {
  const router = createRouter({
    routeTree: createShellRoutes({
      modules: [coreModule],
      plantComponent: PlantStub,
      settingsComponent: SettingsStub,
    }),
    history: createMemoryHistory({ initialEntries: [href] }),
  });
  render(
    <MockedProvider mocks={mocks} link={hold && ApolloLink.from([hold, new MockLink(mocks)])}>
      <ContributionsProvider value={contributions}>
        <PlantSettingsSourceProvider value={plantSettingsSource}>
          <RouterProvider router={router} />
        </PlantSettingsSourceProvider>
      </ContributionsProvider>
    </MockedProvider>,
  );
  return router;
}

/**
 * Holds each request that matches until the test calls release, so a loading state stays on the
 * screen until the test has checked it, however slow the machine. A request after release goes
 * to the mocks at once.
 */
export function holdRequests(matches: (operation: ApolloLink.Operation) => boolean) {
  const { promise, resolve } = Promise.withResolvers<void>();
  const link = new ApolloLink((operation, forward) =>
    matches(operation)
      ? from(promise).pipe(mergeMap(() => forward(operation)))
      : forward(operation),
  );
  return { link, release: () => resolve() };
}

/**
 * Holds each request of the held operations until the first operation has answered, so the page
 * renders with the viewer's permissions known. A test that says a control the permissions hide is
 * absent, on a page where the viewer's answer renders nothing else to wait for, asserts the
 * absence once the page shows: the page rendered after the answer that would have shown it.
 */
export function answeredAfter(first: string, ...held: readonly string[]): ApolloLink {
  const { promise, resolve } = Promise.withResolvers<void>();
  return new ApolloLink((operation, forward) => {
    if (operation.operationName === first) {
      // An error releases the held requests too, so a missing mock fails on its own message.
      return forward(operation).pipe(tap({ next: () => resolve(), error: () => resolve() }));
    }
    return operation.operationName !== undefined && held.includes(operation.operationName)
      ? from(promise).pipe(mergeMap(() => forward(operation)))
      : forward(operation);
  });
}

/** A fictional article as the API returns it. */
export interface ArticleNode {
  readonly __typename: 'Article';
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly translations: readonly {
    readonly __typename: 'Translation';
    readonly field: string;
    readonly locale: string;
    readonly text: string;
  }[];
  readonly articleGroup: {
    readonly __typename: 'ArticleGroup';
    readonly id: string;
    readonly code: string;
    readonly name: string;
  } | null;
  readonly stockUnit: 'PIECE' | 'METRE' | 'KILOGRAM' | 'LITRE';
  readonly note: string | null;
  readonly source: string | null;
  readonly version: number;
  readonly archivedAt: string | null;
  readonly createdAt: string;
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

/** When the fixtures' articles were created: 2026-09-12 07:15 in the browser's time zone. */
export const createdAt = new Date(2026, 8, 12, 7, 15).toISOString();

/** createdAt as the article's page shows it. */
export const createdAtText = '2026-09-12 07:15';

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
    translations: [],
    articleGroup: null,
    stockUnit: 'PIECE',
    note: null,
    source: null,
    version,
    archivedAt,
    createdAt,
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

/**
 * Watches the document for skeleton rows from now on; the function it returns stops watching and
 * says whether any showed, however briefly.
 */
export function watchForSkeletonRows(): () => boolean {
  let seen = false;
  const observer = new MutationObserver(() => {
    if (document.querySelector('[data-slot="skeleton"]') !== null) seen = true;
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    return seen;
  };
}
