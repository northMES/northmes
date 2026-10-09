// SPDX-License-Identifier: AGPL-3.0-or-later
import { MockedProvider } from '@apollo/client/testing/react';
import { planningLinks } from '@northmes/planning-contracts';
import { createShellRoutes } from '@northmes/web-sdk';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { planningModule } from '../../../src/modules/planning/index.ts';
import { PlanningBoard } from '../../../src/modules/planning/screens/board/board.graphql.ts';

afterEach(cleanup);

describe('planning web module', () => {
  it("E02-S05 a plant's planningLinks.board href opens the board stub", async () => {
    const router = createRouter({
      routeTree: createShellRoutes({ modules: [planningModule] }),
      history: createMemoryHistory({
        initialEntries: [planningLinks.board({ plant: 'plant-a' }).href],
      }),
    });
    const boardQuery = {
      request: { query: PlanningBoard },
      result: {
        data: {
          planningProductionOrders: [
            {
              __typename: 'ProductionOrder',
              id: 'order-7101',
              number: '7101',
              quantity: '40.000000',
              status: 'planned',
              version: 1,
              article: { __typename: 'Article', id: 'article-7101', name: 'Bracket 40 mm' },
            },
          ],
        },
      },
    };

    render(
      <MockedProvider mocks={[boardQuery]}>
        <RouterProvider router={router} />
      </MockedProvider>,
    );

    expect((await screen.findByTestId('article-7101')).textContent).toBe('Bracket 40 mm');
  });
});
