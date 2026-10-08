// SPDX-License-Identifier: AGPL-3.0-or-later
import { MockedProvider } from '@apollo/client/testing/react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanningBoard } from '../src/board.graphql.ts';
import { BoardScreen } from '../src/board-screen.tsx';

afterEach(cleanup);

/** A fictional order of the board's query, with the article the core subgraph resolves. */
function order(number: string, quantity: string, status: string, article: string) {
  return {
    __typename: 'ProductionOrder',
    id: `order-${number}`,
    number,
    quantity,
    status,
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
              order('7101', '40.000000', 'planned', 'Bracket 40 mm'),
              order('7102', '12.500000', 'released', 'Hinge pin'),
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
});
