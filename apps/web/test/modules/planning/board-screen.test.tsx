// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanningBoard } from '../../../src/modules/planning/screens/board/board.graphql.ts';
import { BoardScreen } from '../../../src/modules/planning/screens/board/index.ts';
import { PlanningReleaseProductionOrder } from '../../../src/modules/planning/screens/board/release.graphql.ts';

afterEach(cleanup);

/** A fictional order of the board's query, with the article the core module resolves. */
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

/** The board query, answered with these orders. */
function boardQuery(...orders: ReturnType<typeof order>[]): MockLink.MockedResponse {
  return {
    request: { query: PlanningBoard },
    result: { data: { planningProductionOrders: orders } },
  };
}

/** The release of the order with `id` at version 1, answered with `result`. */
function releaseOf(id: string, result: MockLink.MockedResponse['result']): MockLink.MockedResponse {
  return {
    request: {
      query: PlanningReleaseProductionOrder,
      variables: { input: { id, expectedVersion: 1 } },
    },
    result,
  };
}

/** Renders the board screen with a MockedProvider that answers `mocks`, each once. */
function renderBoard(mocks: MockLink.MockedResponse[]) {
  render(
    <MockedProvider mocks={mocks}>
      <BoardScreen />
    </MockedProvider>,
  );
}

/** The text of each cell of a row. */
function cells(row: HTMLElement): (string | null)[] {
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
}

describe('BoardScreen', () => {
  it('E02-S05 the board stub says it is loading the production orders until they arrive', async () => {
    renderBoard([{ ...boardQuery(order('PO-1', '40.000000', 'planned', 'Hinge', 1)), delay: 50 }]);

    expect(screen.getByText('Loading the production orders')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Loading the production orders')).toBeNull());
  });

  it('E02-S05 the board stub lists production orders with their article names', async () => {
    renderBoard([
      boardQuery(
        order('7101', '40.000000', 'planned', 'Bracket 40 mm', 1),
        order('7102', '12.500000', 'released', 'Hinge pin', 2),
      ),
    ]);

    const board = await screen.findByTestId('board-screen');
    expect(cells(await within(board).findByTestId('order-7101'))).toEqual([
      '7101',
      'Bracket 40 mm',
      '40.000000',
      'planned',
      '1',
      'Release',
    ]);
    expect(cells(within(board).getByTestId('order-7102'))).toEqual([
      '7102',
      'Hinge pin',
      '12.500000',
      'released',
      '2',
      '',
    ]);
    expect(within(board).getByTestId('article-7102').textContent).toBe('Hinge pin');
    expect(within(board).getByTestId('status-7102').textContent).toBe('released');
  });

  it('E02-S05 the board stub shows the error when its query fails', async () => {
    renderBoard([{ request: { query: PlanningBoard }, error: new Error('The API is not ready.') }]);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The production orders could not be loaded: The API is not ready.',
    );
  });

  it('E02-S05 the Release button sends planningReleaseProductionOrder and the row shows released', async () => {
    const user = userEvent.setup();
    // One answer for the board's query: a second run of it would find no mock and fail, so the row
    // can only change through the mutation's result in the cache.
    renderBoard([
      boardQuery(order('7101', '40.000000', 'planned', 'Bracket 40 mm', 1)),
      releaseOf('order-7101', {
        data: {
          planningReleaseProductionOrder: {
            __typename: 'ProductionOrder',
            id: 'order-7101',
            status: 'released',
            version: 2,
          },
        },
      }),
    ]);

    const row = await screen.findByTestId('order-7101');
    await user.click(within(row).getByRole('button', { name: 'Release order 7101' }));

    await waitFor(() =>
      expect(within(row).getByTestId('status-7101').textContent).toBe('released'),
    );
    expect(within(row).getByTestId('version-7101').textContent).toBe('2');
    expect(within(row).queryByRole('button')).toBeNull();
  });

  it('E02-S05 a double click on Release sends one release, and the row shows released with no failure', async () => {
    const user = userEvent.setup();
    // One answer for one release: a second release would find no mock and fail.
    renderBoard([
      boardQuery(order('7101', '40.000000', 'planned', 'Bracket 40 mm', 1)),
      releaseOf('order-7101', {
        data: {
          planningReleaseProductionOrder: {
            __typename: 'ProductionOrder',
            id: 'order-7101',
            status: 'released',
            version: 2,
          },
        },
      }),
    ]);

    const row = await screen.findByTestId('order-7101');
    await user.dblClick(within(row).getByRole('button', { name: 'Release order 7101' }));

    await waitFor(() =>
      expect(within(row).getByTestId('status-7101').textContent).toBe('released'),
    );
    expect(within(row).queryByRole('alert')).toBeNull();
  });

  it('E02-S05 a rejected release shows the message and errorCode in the row', async () => {
    const user = userEvent.setup();
    renderBoard([
      boardQuery(order('7101', '40.000000', 'planned', 'Bracket 40 mm', 1)),
      // The answer of a validator's veto: no data, and one error with the validator's message.
      releaseOf('order-7101', {
        data: null,
        errors: [
          {
            message: 'Order 7101 asks for 40, above the release limit of 25',
            path: ['planningReleaseProductionOrder'],
            extensions: {
              code: 'PRECONDITION',
              errorCode: 'core.command_rejected',
              details: { rejectedBy: 'example-validator' },
            },
          },
        ],
      }),
    ]);

    const row = await screen.findByTestId('order-7101');
    await user.click(within(row).getByRole('button', { name: 'Release order 7101' }));

    expect((await within(row).findByRole('alert')).textContent).toBe(
      'Order 7101 asks for 40, above the release limit of 25 (core.command_rejected)',
    );
    expect(within(row).getByTestId('status-7101').textContent).toBe('planned');
    expect(within(row).getByTestId('version-7101').textContent).toBe('1');
    expect(within(row).getByRole('button', { name: 'Release order 7101' })).toBeTruthy();
  });
});
