// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { PageFrame } from '../../../../ui/components/page-frame/index.ts';
import { PlanningBoard } from './board.graphql.ts';
import { OrderRow } from './order-row.tsx';

/**
 * The E02 board stub: the plant's production orders, each with its number, article name, quantity,
 * status and version, or the error when the query fails. The data-testid hooks name each row and
 * cell by the order number for the end-to-end specs. Its page frame gives it the h1, the document
 * title and the breadcrumb in the shell's top bar. The real board comes with E08.
 */
export function BoardScreen() {
  const { data, error, loading } = useQuery(PlanningBoard);
  return (
    <PageFrame title="Planning board">
      <section data-testid="board-screen">
        {loading && <p>Loading the production orders</p>}
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
    </PageFrame>
  );
}
