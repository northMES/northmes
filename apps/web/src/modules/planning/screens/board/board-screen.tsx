// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { Skeleton } from '../../../../ui/primitives/skeleton.tsx';
import { PlanningBoard } from './board.graphql.ts';
import { OrderRow } from './order-row.tsx';

/**
 * The E02 board stub: the plant's production orders, each with its number, article name, quantity,
 * status and version. The data-testid hooks name each row and cell by the order number for the
 * end-to-end specs. Its page frame gives it the h1, the document title, the breadcrumb in the
 * shell's top bar, and the loading and error states. The real board comes with E08.
 */
/** The keys of the skeleton rows and cells the board draws while its orders load. */
const skeletonRows = ['skeleton-0', 'skeleton-1', 'skeleton-2'];
const skeletonCells = ['number', 'article', 'quantity', 'status', 'version', 'action'];

export function BoardScreen() {
  const { data, error, refetch } = useQuery(PlanningBoard);
  let state: PageState = { status: 'ready' };
  if (data === undefined && error !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load the production orders',
      description: 'Check the connection, then try again.',
      onRetry: () => {
        refetch().catch(() => {});
      },
    };
  } else if (data === undefined) {
    state = { status: 'loading' };
  }
  return (
    <PageFrame title="Planning board" state={state}>
      <section data-testid="board-screen">
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
            {state.status === 'loading'
              ? skeletonRows.map((row) => (
                  <tr key={row}>
                    {skeletonCells.map((cell) => (
                      <td key={cell}>
                        <Skeleton aria-hidden className="h-3 w-16 motion-reduce:animate-none" />
                      </td>
                    ))}
                  </tr>
                ))
              : data?.planningProductionOrders.map((order) => (
                  <OrderRow key={order.id} order={order} />
                ))}
          </tbody>
        </table>
      </section>
    </PageFrame>
  );
}
