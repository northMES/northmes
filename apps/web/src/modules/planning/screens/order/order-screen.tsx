// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration } from '@northmes/contracts/format';
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { ChartNoAxesGantt, Clock, Pencil, Wand2 } from 'lucide-react';
import { DetailTabs } from '../../../../ui/components/detail-tabs/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import type { GanttOrder, GanttSnapshot } from '../../gantt-data.ts';
import { planReason } from '../../mock-reasons.ts';
import { orderById, plantTime, timelineLinks } from '../../order-facts.ts';
import { orderPageSearch } from '../../order-page-search.ts';
import { usePlanningSnapshot } from '../../use-planning-snapshot.ts';
import { quantityText, statusLabel } from '../gantt/gantt-rows.ts';
import { OrderGeneral } from './order-general.tsx';
import { OrderHistory } from './order-history.tsx';

/** The page's actions (PO1): Edit, Plan this order, Zoom to order on the Gantt and Show on board. */
function OrderActions({
  snapshot,
  order,
}: {
  readonly snapshot: GanttSnapshot;
  readonly order: GanttOrder;
}) {
  const { plant } = useShell();
  const links = timelineLinks(snapshot, order, plant);
  const outline = buttonVariants({ variant: 'outline' });
  return (
    <>
      <Link
        to={planningLinks.orders.order.edit({ plant, orderId: order.id }).href}
        className={outline}
      >
        <Pencil aria-hidden />
        Edit
      </Link>
      <Button variant="outline" disabled>
        <Wand2 aria-hidden />
        Plan this order
      </Button>
      <Link to={links.gantt} className={outline}>
        <ChartNoAxesGantt aria-hidden />
        Zoom to order on the Gantt
      </Link>
      <Link to={links.board} className={outline}>
        Show on board
      </Link>
    </>
  );
}

/** The order's status and, when it is late, Late by, beside the h1 (PO1). */
function OrderBadges({
  snapshot,
  order,
}: {
  readonly snapshot: GanttSnapshot;
  readonly order: GanttOrder;
}) {
  const analysis = snapshot.analysis.orders[order.id];
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <StatusBadge tone={order.status === 'released' ? 'success' : 'info'}>
        {statusLabel(order.status)}
      </StatusBadge>
      {analysis?.late && (
        <StatusBadge tone="destructive" icon={Clock}>
          Late {formatDuration(-analysis.slackElapsedS)}
        </StatusBadge>
      )}
    </span>
  );
}

/**
 * A production order's page (plan 07, planning records; design #686, PO1 to PO3): its number in
 * the h1 with its status, article, quantity and deadline beside it, the tabs General and History
 * with the open one in the URL's tab (design ui-222), and the planning actions in the top bar. The
 * General tab holds the order's facts with the rule or source behind each, the customer order
 * lines it supplies, its operations in routing sequence and its job orders with their placements.
 * Plan this order is drawn but disabled until plan() lands; Edit, Zoom to order on the Gantt and
 * Show on board are links. An order the snapshot does not hold shows the not-found state (ST7).
 */
export function OrderScreen() {
  const { plant } = useShell();
  const { orderId = '' } = useParams({ strict: false });
  const search = orderPageSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const { snapshot, error, retry } = usePlanningSnapshot();
  const order = snapshot === undefined ? undefined : orderById(snapshot, orderId);
  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load the order', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (order === undefined) {
    state = {
      status: 'empty',
      title: 'This order does not exist or you cannot see it',
      description:
        'The link may be out of date, or the order belongs to a plant you have no role in.',
      action: (
        <Link
          to={planningLinks.jobOrders({ plant }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Back to Job orders
        </Link>
      ),
    };
  }
  const loaded = snapshot !== undefined && order !== undefined;
  return (
    <PageFrame
      title={order === undefined ? 'Order' : `Order ${order.number}`}
      state={state}
      actions={loaded ? <OrderActions snapshot={snapshot} order={order} /> : undefined}
      meta={
        loaded ? (
          <span className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <OrderBadges snapshot={snapshot} order={order} />
            <span>
              {order.article}, {quantityText(order.quantity)}, deadline{' '}
              {plantTime(snapshot, order.deadlineMs)}
            </span>
          </span>
        ) : undefined
      }
    >
      {loaded && (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <p>{planReason}</p>
            {snapshot.fixture !== undefined && <p>Showing fixture {snapshot.fixture}.</p>}
          </div>
          <DetailTabs
            label={`Order ${order.number}`}
            value={search.tab ?? 'general'}
            onValueChange={(tab) =>
              navigate({ to: '.', search: tab === 'history' ? { tab: 'history' } : {} })
            }
            tabs={[
              {
                value: 'general',
                label: 'General',
                content: <OrderGeneral snapshot={snapshot} order={order} />,
              },
              {
                value: 'history',
                label: 'History',
                content: <OrderHistory snapshot={snapshot} order={order} />,
              },
            ]}
          />
        </>
      )}
    </PageFrame>
  );
}
