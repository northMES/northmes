// SPDX-License-Identifier: AGPL-3.0-or-later
import { MockedProvider } from '@apollo/client/testing/react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanningBoard } from '../src/board.graphql.ts';
import { BoardScreen } from '../src/board-screen.tsx';
import { PlanningReleaseProductionOrder } from '../src/release.graphql.ts';

afterEach(cleanup);

/** A fictional order of the board's query, with the article the core subgraph resolves. */
function order(number: string, quantity: string, status: string, article: string, version: number) {
  return {
    __typename: 'ProductionOrder',
    id: `order-${number}`,
    number,
    quantity,
    status,
    version,
    article: { __typename: 'Article', id: `article-${number}`, name: article },
  };
}

/** The text of each cell of a row. */
function cells(row: HTMLElement): (string | null)[] {
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
}

describe('BoardScreen', () => {
  it('E02-S05 the board stub lists production orders with their article names', async () => {
    const mocks = [
      {
        request: { query: PlanningBoard },
        result: {
          data: {
            planningProductionOrders: [
              order('7101', '40.000000', 'planned', 'Bracket 40 mm', 1),
              order('7102', '12.500000', 'released', 'Hinge pin', 2),
            ],
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <BoardScreen />
      </MockedProvider>,
    );

    const board = await screen.findByTestId('board-screen');
    expect(cells(await within(board).findByTestId('order-7101'))).toEqual([
      '7101',
      'Bracket 40 mm',
      '40.000000',
      'planned',
    ]);
    expect(cells(within(board).getByTestId('order-7102'))).toEqual([
      '7102',
      'Hinge pin',
      '12.500000',
      'released',
    ]);
    expect(within(board).getByTestId('article-7102').textContent).toBe('Hinge pin');
    expect(within(board).getByTestId('status-7102').textContent).toBe('released');
  });

  it('E02-S05 the board stub shows the error when its query fails', async () => {
    const mocks = [
      { request: { query: PlanningBoard }, error: new Error('The GraphQL gateway is not ready.') },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <BoardScreen />
      </MockedProvider>,
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The production orders could not be loaded: The GraphQL gateway is not ready.',
    );
  });

  it('E02-S05 the Release button sends planningReleaseProductionOrder and the row shows released', async () => {
    const user = userEvent.setup();
    // One answer for the board's query: a second run of it would find no mock and fail, so the row
    // can only change through the mutation's result in the cache.
    const mocks = [
      {
        request: { query: PlanningBoard },
        result: {
          data: {
            planningProductionOrders: [order('7101', '40.000000', 'planned', 'Bracket 40 mm', 1)],
          },
        },
      },
      {
        request: {
          query: PlanningReleaseProductionOrder,
          variables: { input: { id: 'order-7101' } },
        },
        result: {
          data: {
            planningReleaseProductionOrder: {
              __typename: 'ProductionOrder',
              id: 'order-7101',
              status: 'released',
              version: 2,
            },
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <BoardScreen />
      </MockedProvider>,
    );

    const row = await screen.findByTestId('order-7101');
    await user.click(within(row).getByRole('button', { name: 'Release order 7101' }));

    await waitFor(() =>
      expect(within(row).getByTestId('status-7101').textContent).toBe('released'),
    );
    expect(within(row).getByTestId('version-7101').textContent).toBe('2');
    expect(within(row).queryByRole('button')).toBeNull();
  });
});
