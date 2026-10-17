// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { MockedProvider } from '@apollo/client/testing/react';
import { planningLinks } from '@northmes/planning-contracts';
import { createShellRoutes } from '@northmes/web-sdk';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
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
              article: {
                __typename: 'Article',
                id: 'article-7101',
                code: 'BR-40',
                name: 'Bracket 40 mm',
              },
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

    expect(await screen.findByText('Bracket 40 mm')).toBeTruthy();
  });

  it('plan 18 the board stub shows the View control, and Gantt keeps zoom, from and order', async () => {
    const router = createRouter({
      routeTree: createShellRoutes({ modules: [planningModule] }),
      history: createMemoryHistory({
        initialEntries: [
          `${planningLinks.board({ plant: 'plant-a' }).href}?zoom=week&from=2026-11-02&order=po-1003`,
        ],
      }),
    });
    render(
      <MockedProvider
        mocks={[
          { request: { query: PlanningBoard }, result: { data: { planningProductionOrders: [] } } },
        ]}
      >
        <RouterProvider router={router} />
      </MockedProvider>,
    );
    const view = await screen.findByRole('group', { name: 'View' });
    expect(within(view).getByRole('button', { name: 'Board' }).getAttribute('aria-pressed')).toBe(
      'true',
    );

    await userEvent.click(within(view).getByRole('button', { name: 'Gantt' }));

    await waitFor(() => {
      expect(router.state.location.search).toEqual({
        view: 'gantt',
        zoom: 'week',
        from: '2026-11-02',
        order: 'po-1003',
      });
    });
  });
});
