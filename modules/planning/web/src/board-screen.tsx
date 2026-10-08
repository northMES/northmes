// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery } from '@apollo/client/react';
import { type BoardOrder, PlanningBoard } from './board.graphql.ts';
import { PlanningReleaseProductionOrder } from './release.graphql.ts';

/**
 * One order of the board stub. A planned order has a Release button, whose answer the normalized
 * cache merges into this order, so the row shows the new status and version without another run of
 * the board's query.
 */
function OrderRow({ order }: { readonly order: BoardOrder }) {
  const [release] = useMutation(PlanningReleaseProductionOrder);
  return (
    <tr data-testid={`order-${order.number}`}>
      <td>{order.number}</td>
      <td data-testid={`article-${order.number}`}>{order.article?.name}</td>
      <td>{order.quantity}</td>
      <td data-testid={`status-${order.number}`}>{order.status}</td>
      <td data-testid={`version-${order.number}`}>{order.version}</td>
      <td>
        {order.status === 'planned' && (
          <button
            type="button"
            aria-label={`Release order ${order.number}`}
            onClick={() => release({ variables: { input: { id: order.id } } })}
          >
            Release
          </button>
        )}
      </td>
    </tr>
  );
}

/**
 * The E02 board stub: the plant's production orders, each with its number, article name, quantity,
 * status and version, or the error when the query fails. The data-testid hooks name each row and
 * cell by the order number for the end-to-end specs. The real board comes with E08.
 */
export function BoardScreen() {
  const { data, error } = useQuery(PlanningBoard);
  return (
    <section data-testid="board-screen">
      <h1>Planning board</h1>
      {error && <p role="alert">The production orders could not be loaded: {error.message}</p>}
      <table>
        <thead>
          <tr>
            <th scope="col">Number</th>
            <th scope="col">Article</th>
            <th scope="col">Quantity</th>
            <th scope="col">Status</th>
            <th scope="col">Version</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {data?.planningProductionOrders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </tbody>
      </table>
    </section>
  );
}
