// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { EyeOff } from 'lucide-react';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { StatusBadge, type StatusTone } from '../../../../ui/components/status-badge/index.ts';
import { formatQuantity } from '../../../../ui/lib/quantity.ts';
import { type BoardOrder, PlanningBoard } from './board.graphql.ts';
import { ReleaseOrderButton } from './release-order-button.tsx';

/**
 * The words and tone of each status the API returns: Planned as the job table of planning-221
 * draws it, and Released in the tone of a started order. A status without an entry shows as the
 * API sent it.
 */
const statuses: Readonly<Record<string, { readonly label: string; readonly tone: StatusTone }>> = {
  planned: { label: 'Planned', tone: 'info' },
  released: { label: 'Released', tone: 'success' },
};

function OrderStatus({ status }: { readonly status: string }) {
  const { label, tone } = statuses[status] ?? { label: status, tone: 'neutral' };
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

/**
 * The article's code and name on one line, as the production orders list of ui-222 LI35 draws
 * them, and LI35's cell state for an article the reader cannot see.
 */
function OrderArticle({ article }: { readonly article: BoardOrder['article'] }) {
  if (article === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <EyeOff aria-hidden="true" className="size-4 shrink-0" />
        <span className="italic">Article not available to you</span>
      </span>
    );
  }
  return (
    <span>
      <span className="font-mono text-muted-foreground">{article.code}</span> {article.name}
    </span>
  );
}

const columns: readonly DataTableColumn<BoardOrder>[] = [
  {
    id: 'order',
    header: 'Order',
    cell: (order) => <span className="font-mono">{order.number}</span>,
  },
  { id: 'article', header: 'Article', cell: (order) => <OrderArticle article={order.article} /> },
  {
    id: 'quantity',
    header: 'Quantity',
    numeric: true,
    cell: (order) => <span className="font-mono">{formatQuantity(order.quantity)}</span>,
  },
  { id: 'status', header: 'Status', cell: (order) => <OrderStatus status={order.status} /> },
  {
    id: 'actions',
    header: 'Actions',
    headerHidden: true,
    cell: (order) => <ReleaseOrderButton order={order} />,
  },
];

/**
 * The E02 board stub: the plant's production orders in the DataTable as the lists of ui-222 draw
 * it, each with its order number, article, quantity, status and Release for a planned order. Its
 * page frame gives it the h1, the document title, the breadcrumb in the shell's top bar, and the
 * loading, empty and error states. The real board of planning-221 replaces it.
 */
export function BoardScreen() {
  const { data, error, refetch } = useQuery(PlanningBoard);
  const orders = data?.planningProductionOrders;
  let state: PageState = { status: 'ready' };
  if (orders === undefined && error !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load the production orders',
      error,
      onRetry: () => refetch(),
    };
  } else if (orders === undefined) {
    state = { status: 'loading' };
  } else if (orders.length === 0) {
    state = {
      status: 'empty',
      title: 'No production orders yet',
      description: 'The production orders of this plant show here once they exist.',
    };
  }
  return (
    <PageFrame title="Planning board" state={state}>
      <DataTable
        label="Production orders"
        columns={columns}
        rows={orders ?? []}
        getRowId={(order) => order.id}
        loading={orders === undefined}
      />
    </PageFrame>
  );
}
