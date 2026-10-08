// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { PlanningBoard } from './board.graphql.ts';

/**
 * The E02 board stub: the plant's production orders, each with its number, article name, quantity
 * and status, or the error when the query fails. The data-testid hooks name each row and cell by
 * the order number for the end-to-end specs. The real board comes with E08.
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
          </tr>
        </thead>
        <tbody>
          {data?.planningProductionOrders.map((order) => (
            <tr key={order.id} data-testid={`order-${order.number}`}>
              <td>{order.number}</td>
              <td data-testid={`article-${order.number}`}>{order.article?.name}</td>
              <td>{order.quantity}</td>
              <td data-testid={`status-${order.number}`}>{order.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
