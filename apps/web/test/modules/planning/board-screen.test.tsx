// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanningBoard } from '../../../src/modules/planning/screens/board/board.graphql.ts';
import { BoardScreen } from '../../../src/modules/planning/screens/board/index.ts';
import { PlanningReleaseProductionOrder } from '../../../src/modules/planning/screens/board/release.graphql.ts';
import { formatQuantity } from '../../../src/ui/lib/quantity.ts';

afterEach(cleanup);

/** A fictional order of the board's query, with the article the core module resolves. */
function order(
  number: string,
  quantity: string,
  status: string,
  article: { readonly code: string; readonly name: string } | null,
  version = 1,
) {
  return {
    __typename: 'ProductionOrder',
    id: `order-${number}`,
    number,
    quantity,
    status,
    version,
    article: article && { __typename: 'Article', id: `article-${number}`, ...article },
  };
}

const bracket = { code: 'BR-40', name: 'Bracket 40 mm' };
const hingePin = { code: 'HP-12', name: 'Hinge pin' };

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

/** The table row of the order with this number, once the orders have loaded. */
async function rowOf(number: string): Promise<HTMLElement> {
  const table = await screen.findByRole('table', { name: 'Production orders' });
  const cell = await within(table).findByRole('cell', { name: number });
  const row = cell.closest('tr');
  if (row === null) throw new Error(`No row holds order ${number}`);
  return row;
}

/** The cell of a row under the column header with this name. */
function cellOf(row: HTMLElement, header: string): HTMLElement {
  const table = row.closest('table');
  if (table === null) throw new Error('The row is not in a table');
  const headers = within(table).getAllByRole('columnheader');
  const index = headers.findIndex((cell) => cell.textContent === header);
  const cell = within(row).getAllByRole('cell')[index];
  if (index < 0 || cell === undefined) throw new Error(`No ${header} cell`);
  return cell;
}

describe('BoardScreen', () => {
  it('E02-S05 the board stub marks its table busy and draws skeleton rows until the production orders arrive', async () => {
    renderBoard([{ ...boardQuery(order('PO-1', '40.000000', 'planned', bracket)), delay: 50 }]);

    const table = screen.getByRole('table', { name: 'Production orders' });
    expect(table.getAttribute('aria-busy')).toBe('true');
    expect(table.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    await rowOf('PO-1');
    expect(table.getAttribute('aria-busy')).toBeNull();
    expect(table.querySelectorAll('[data-slot="skeleton"]').length).toBe(0);
  });

  it('E02-S05 the board stub lists production orders in a data table: order, article code and name, quantity without trailing zeros, status in words and Release', async () => {
    renderBoard([
      boardQuery(
        order('7101', '40.000000', 'planned', bracket),
        order('7102', '125.500000', 'released', hingePin, 2),
      ),
    ]);

    const table = await screen.findByRole('table', { name: 'Production orders' });
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Order',
      'Article',
      'Quantity',
      'Status',
      'Actions',
    ]);
    const planned = await rowOf('7101');
    expect(within(cellOf(planned, 'Article')).getByText('BR-40')).toBeTruthy();
    expect(within(cellOf(planned, 'Article')).getByText('Bracket 40 mm')).toBeTruthy();
    expect(cellOf(planned, 'Quantity').textContent).toBe('40');
    expect(cellOf(planned, 'Status').textContent).toBe('Planned');
    expect(
      within(cellOf(planned, 'Actions')).getByRole('button', { name: 'Release order 7101' }),
    ).toBeTruthy();

    const released = await rowOf('7102');
    expect(cellOf(released, 'Quantity').textContent).toBe(formatQuantity('125.500000'));
    expect(cellOf(released, 'Status').textContent).toBe('Released');
    expect(within(released).queryByRole('button')).toBeNull();
    expect(within(table).queryByText('2')).toBeNull();
  });

  it('E02-S05 an order whose article core does not hold says so, and a status without a label shows as the API sent it', async () => {
    renderBoard([boardQuery(order('7103', '5.000000', 'on_hold', null))]);

    const row = await rowOf('7103');
    expect(cellOf(row, 'Article').textContent).toBe('Unknown article');
    expect(cellOf(row, 'Status').textContent).toBe('on_hold');
  });

  it('E02-S05 the board stub shows the empty state when the plant has no production orders', async () => {
    renderBoard([boardQuery()]);

    expect(
      (await screen.findByRole('heading', { level: 2, name: 'No production orders yet' }))
        .textContent,
    ).toBe('No production orders yet');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it("E02-S05 the board stub shows the page frame's error state when its query fails, and Try again loads the orders", async () => {
    renderBoard([
      { request: { query: PlanningBoard }, error: new Error('The API is not ready.') },
      boardQuery(order('7101', '40.000000', 'planned', bracket)),
    ]);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('heading', { level: 2 }).textContent).toBe(
      'Could not load the production orders',
    );
    expect(alert.textContent).toContain('Check the connection, then try again.');
    expect(screen.queryByRole('table')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await rowOf('7101')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('E02-S05 the Release button sends planningReleaseProductionOrder with the version and the row shows Released', async () => {
    const user = userEvent.setup();
    // One answer for the board's query: a second run of it would find no mock and fail, so the row
    // can only change through the mutation's result in the cache.
    renderBoard([
      boardQuery(order('7101', '40.000000', 'planned', bracket)),
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

    const row = await rowOf('7101');
    await user.click(within(row).getByRole('button', { name: 'Release order 7101' }));

    await waitFor(() => expect(cellOf(row, 'Status').textContent).toBe('Released'));
    expect(within(row).queryByRole('button')).toBeNull();
  });

  it('E02-S05 a double click on Release sends one release, and the row shows Released with no failure', async () => {
    const user = userEvent.setup();
    // One answer for one release: a second release would find no mock and fail.
    renderBoard([
      boardQuery(order('7101', '40.000000', 'planned', bracket)),
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

    const row = await rowOf('7101');
    await user.dblClick(within(row).getByRole('button', { name: 'Release order 7101' }));

    await waitFor(() => expect(cellOf(row, 'Status').textContent).toBe('Released'));
    expect(within(row).queryByRole('alert')).toBeNull();
  });

  it('E02-S05 a rejected release shows the message and errorCode in the row', async () => {
    const user = userEvent.setup();
    renderBoard([
      boardQuery(order('7101', '40.000000', 'planned', bracket)),
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

    const row = await rowOf('7101');
    await user.click(within(row).getByRole('button', { name: 'Release order 7101' }));

    expect((await within(row).findByRole('alert')).textContent).toBe(
      'Order 7101 asks for 40, above the release limit of 25 (core.command_rejected)',
    );
    expect(cellOf(row, 'Status').textContent).toBe('Planned');
    expect(within(row).getByRole('button', { name: 'Release order 7101' })).toBeTruthy();
  });
});
