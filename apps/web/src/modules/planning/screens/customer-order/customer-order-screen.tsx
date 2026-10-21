// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDay } from '@northmes/contracts/format';
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { cn } from 'cn';
import { ChartNoAxesGantt, Clock, Info } from 'lucide-react';
import { Fragment, type ReactNode, useEffect, useId, useRef } from 'react';
import { DetailTabs } from '../../../../ui/components/detail-tabs/index.ts';
import { OwnerTag } from '../../../../ui/components/owner-tag/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/primitives/alert.tsx';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/primitives/table.tsx';
import { CustomerLink } from '../../components/customer-link/index.ts';
import {
  type CustomerOrderPageSearch,
  customerOrderPageSearch,
} from '../../customer-order-page-search.ts';
import type { CustomerOrderLine, GanttSnapshot } from '../../gantt-data.ts';
import { phase1Reason } from '../../mock-reasons.ts';
import { orderById, plantTime, timelineLinks } from '../../order-facts.ts';
import { usePlanningSnapshot } from '../../use-planning-snapshot.ts';
import { quantityText, statusLabel } from '../gantt/gantt-rows.ts';
import { linesOfCustomerOrder, sharesOf } from './customer-order-facts.ts';
import { CustomerOrderSupplyDialog } from './customer-order-supply-dialog.tsx';

/** Why the History tab is empty while the planning pages read the fixture G1. */
const historyReason =
  "A customer order's history waits for the planning server; this page reads the fixture G1.";

const head = 'h-auto px-3 py-2 text-xs font-semibold text-muted-foreground';
const cell = 'px-3 py-2 whitespace-normal';
const link = 'text-link underline underline-offset-2 hover:no-underline';

/** A section of the page: a card named by its h2, with a line that says what it holds. */
function Section({
  title,
  lead,
  children,
}: {
  readonly title: string;
  readonly lead: string;
  readonly children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 text-card-foreground"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{lead}</p>
      </div>
      {children}
    </section>
  );
}

/** A term, its value and the note under the value that names its source or rule (KO1). */
function Definition({
  term,
  children,
  note,
}: {
  readonly term: string;
  readonly children: ReactNode;
  readonly note?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-muted-foreground">{term}</dt>
      <dd className="flex flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-sm">{children}</span>
        {note !== undefined && <span className="text-xs text-muted-foreground">{note}</span>}
      </dd>
    </div>
  );
}

/** The plant that delivers the lines, as the Delivering plant definition says it (KO1). */
function deliveringText(snapshot: GanttSnapshot, lines: readonly CustomerOrderLine[]): string {
  const names = new Map((snapshot.plants ?? []).map((plant) => [plant.slug, plant.name]));
  const plants = [...new Set(lines.map((line) => line.deliveringPlant))].map((slug) =>
    slug === undefined ? 'Not set' : (names.get(slug) ?? slug),
  );
  if (plants.length !== 1) return plants.join(', ');
  const scope =
    lines.length === 1 ? '' : lines.length === 2 ? ', both lines' : `, all ${lines.length} lines`;
  return `${plants[0]}${scope}`;
}

/** The Customer order section: the order's facts from the ERP and its delivering plant (KO1). */
function CustomerOrderSection({
  snapshot,
  lines,
}: {
  readonly snapshot: GanttSnapshot;
  readonly lines: readonly CustomerOrderLine[];
}) {
  const first = lines[0];
  if (first === undefined) return null;
  const customer = snapshot.customers?.find((each) => each.code === first.customerCode);
  const supplied = lines.filter((line) => line.productionOrderId !== undefined).length;
  const erp = snapshot.erp;
  return (
    <Section
      title="Customer order"
      lead={
        erp === undefined
          ? 'From the ERP.'
          : `Through the connection ${erp.name}, imported ${plantTime(snapshot, erp.importedAtMs)}.`
      }
    >
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Definition term="Customer order">
          <span className="font-mono">{first.customerOrder}</span>
          <OwnerTag>From the ERP</OwnerTag>
        </Definition>
        <Definition term="Customer">
          <span>
            <CustomerLink code={first.customerCode} name={customer?.name ?? first.customerCode} />{' '}
            <span className="font-mono text-xs text-muted-foreground">{first.customerCode}</span>
          </span>
          <OwnerTag>From the ERP</OwnerTag>
        </Definition>
        <Definition
          term="Customer's reference"
          note="The customer's own order number, as the ERP sent it."
        >
          <span className="font-mono">{first.customersReference}</span>
          <OwnerTag>From the ERP</OwnerTag>
        </Definition>
        <Definition term="Lines">
          {`${lines.length === 1 ? '1 line' : `${lines.length} lines`}, ${supplied} supplied, ${lines.length - supplied} not supplied`}
        </Definition>
        <Definition
          term="Delivering plant"
          note="A company admin sets it. You cannot change it here: it needs the company permission to set delivering plants."
        >
          {deliveringText(snapshot, lines)}
        </Definition>
      </dl>
    </Section>
  );
}

/** The Lines and supply section: each line, the order that supplies it and what else it supplies (KO1). */
function LinesSection({
  snapshot,
  number,
  lines,
  onSupply,
}: {
  readonly snapshot: GanttSnapshot;
  readonly number: string;
  readonly lines: readonly CustomerOrderLine[];
  readonly onSupply: (line: number) => void;
}) {
  const { plant } = useShell();
  return (
    <Section
      title="Lines and supply"
      lead="Demand is the quantity of a line that a production order supplies. One production order can supply lines of several customer orders of one article."
    >
      <Table>
        <TableCaption className="sr-only">
          Lines of customer order {number} and the production orders that supply them
        </TableCaption>
        <TableHeader className="bg-muted">
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className={head}>
              Line
            </TableHead>
            <TableHead scope="col" className={head}>
              Article
            </TableHead>
            <TableHead scope="col" className={cn(head, 'text-end')}>
              Quantity
            </TableHead>
            <TableHead scope="col" className={head}>
              Wanted
            </TableHead>
            <TableHead scope="col" className={head}>
              Supplied by
            </TableHead>
            <TableHead scope="col" className={cn(head, 'text-end')}>
              Demand
            </TableHead>
            <TableHead scope="col" className={head}>
              Planned end
            </TableHead>
            <TableHead scope="col" className={head}>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => {
            const order =
              line.productionOrderId === undefined
                ? undefined
                : orderById(snapshot, line.productionOrderId);
            const analysis = order === undefined ? undefined : snapshot.analysis.orders[order.id];
            const outline = cn(buttonVariants({ variant: 'outline' }), 'h-8 px-2.5');
            return (
              <Fragment key={line.id}>
                <TableRow className={order === undefined ? undefined : 'border-b-0'}>
                  <TableCell className={cn(cell, 'font-mono')}>{line.line}</TableCell>
                  <TableCell className={cell}>{line.article}</TableCell>
                  <TableCell className={cn(cell, 'text-end font-mono')}>
                    {quantityText(line.quantity)}
                  </TableCell>
                  <TableCell className={cn(cell, 'font-mono')}>
                    {formatPlantDay(line.wantedDate)}
                  </TableCell>
                  <TableCell className={cell}>
                    {order === undefined ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge tone="neutral">Not supplied</StatusBadge>
                        <span className="text-xs text-muted-foreground">
                          No production order yet
                        </span>
                      </span>
                    ) : (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Link
                          to={planningLinks.orders.order({ plant, orderId: order.id }).href}
                          className={cn('font-mono', link)}
                        >
                          Order {order.number}
                        </Link>
                        <StatusBadge tone={order.status === 'released' ? 'success' : 'info'}>
                          {statusLabel(order.status)}
                        </StatusBadge>
                        {analysis?.late && (
                          <StatusBadge tone="destructive" icon={Clock}>
                            Late {formatDuration(-analysis.slackElapsedS)}
                          </StatusBadge>
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className={cn(cell, 'text-end font-mono')}>
                    {order === undefined ? '' : quantityText(line.quantity)}
                  </TableCell>
                  <TableCell className={cn(cell, 'font-mono')}>
                    {order === undefined
                      ? ''
                      : analysis?.plannedEndMs === undefined
                        ? 'Not placed'
                        : plantTime(snapshot, analysis.plannedEndMs)}
                  </TableCell>
                  <TableCell className={cell}>
                    <span className="flex items-center justify-end gap-1">
                      {order === undefined ? (
                        <Button
                          id={supplyButtonId(line.line)}
                          variant="outline"
                          className="h-8 px-2.5"
                          aria-label={`Supply from an order, line ${line.line}`}
                          onClick={() => onSupply(line.line)}
                        >
                          Supply from an order
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            className="h-8 px-2.5"
                            aria-label={`Change supply, line ${line.line}`}
                            disabled
                          >
                            Change supply
                          </Button>
                          <Link
                            to={timelineLinks(snapshot, order, plant).gantt}
                            aria-label={`Open on Gantt, order ${order.number}`}
                            className={outline}
                          >
                            <ChartNoAxesGantt aria-hidden />
                            Open on Gantt
                          </Link>
                        </>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
                {order !== undefined && (
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableCell className={cell} />
                    <TableCell colSpan={7} className={cn(cell, 'text-xs text-muted-foreground')}>
                      <span className="flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          Order <b className="font-medium text-foreground">{order.number}</b>
                          {`, ${quantityText(order.quantity)}, deadline ${plantTime(snapshot, order.deadlineMs)}, supplies:`}
                        </span>
                        {sharesOf(snapshot, order, line).map((share) => (
                          <span key={share.text}>
                            <b className="font-medium text-foreground">
                              {quantityText(share.quantity)}
                            </b>
                            {` to ${share.text}`}
                          </span>
                        ))}
                      </span>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">{phase1Reason}</p>
    </Section>
  );
}

/** The id of a line's Supply from an order button, where focus returns when its step closes. */
function supplyButtonId(line: number): string {
  return `supply-line-${line}`;
}

/** Who changes which field of a customer order from the ERP, and why (KO1). */
const ownership: readonly {
  readonly field: string;
  readonly who: 'erp' | 'planner' | 'admin';
  readonly why: string;
}[] = [
  {
    field: "Order number, customer, customer's reference",
    who: 'erp',
    why: 'The ERP owns the order. A change made here would be overwritten by the next import.',
  },
  {
    field: "A line's article, quantity and wanted date",
    who: 'erp',
    why: 'The ERP owns the lines. A change made here would be overwritten by the next import.',
  },
  {
    field: 'Which production order supplies a line, and how much',
    who: 'planner',
    why: "Demand is planning's record: the planner decides which order supplies each line.",
  },
  {
    field: 'Delivering plant of a line',
    who: 'admin',
    why: 'It moves the line between plants, so it needs a permission at company scope.',
  },
];

const whoLabels = { erp: 'The ERP', planner: 'You, as planner', admin: 'A company admin' } as const;
const whoTones = { erp: 'neutral', planner: 'info', admin: 'warning' } as const;

function WhoChangesWhat() {
  return (
    <Section
      title="Who changes what"
      lead="Customer orders come from the ERP; NorthMES does not create them."
    >
      <Table>
        <TableCaption className="sr-only">
          Who changes each field of a customer order from the ERP
        </TableCaption>
        <TableHeader className="bg-muted">
          <TableRow className="hover:bg-transparent">
            {['Field', 'Changed by', 'Why'].map((label) => (
              <TableHead key={label} scope="col" className={head}>
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ownership.map((row) => (
            <TableRow key={row.field}>
              <TableCell className={cn(cell, 'font-medium')}>{row.field}</TableCell>
              <TableCell className={cell}>
                <StatusBadge tone={whoTones[row.who]}>{whoLabels[row.who]}</StatusBadge>
              </TableCell>
              <TableCell className={cell}>{row.why}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

/**
 * A customer order's page under Planning (plan 07, customer orders and demand; design #728, KO1
 * to KO3): its number in the h1 with the From the ERP tag, its customer and the customer's
 * reference beside it, and the tabs General and History with the open one in the URL's tab.
 * General says what the ERP owns, holds the order's facts with its delivering plant, which only a
 * company admin changes, each line with the production order that supplies it, its demand and
 * everything else that order supplies, and who changes which field. Supply from an order opens the
 * step for a line without an order, with the line in the URL's supply (KO3); it writes nothing
 * until the planning server has planning.setProductionOrderDemand. Change supply waits for its
 * step. A customer order the snapshot does not hold shows the not-found state.
 */
export function CustomerOrderScreen() {
  const { plant } = useShell();
  const { customerOrderId = '' } = useParams({ strict: false });
  const search = customerOrderPageSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const show = (next: CustomerOrderPageSearch) =>
    navigate({ to: '.', search: next, replace: true });
  const { snapshot, error, retry } = usePlanningSnapshot();
  const lines = snapshot === undefined ? [] : linesOfCustomerOrder(snapshot, customerOrderId);
  const first = lines[0];
  const customer =
    first === undefined
      ? undefined
      : snapshot?.customers?.find((each) => each.code === first.customerCode);

  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load the customer order', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (first === undefined) {
    state = {
      status: 'empty',
      title: 'This customer order does not exist or you cannot see it',
      description:
        'The link may be out of date, or the customer order belongs to a plant you have no role in.',
      action: (
        <Link
          to={planningLinks.customerOrders({ plant }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Back to Customer orders
        </Link>
      ),
    };
  }
  const supplyLine =
    search.supply === undefined
      ? undefined
      : lines.find((line) => line.line === search.supply && line.productionOrderId === undefined);
  // The line whose step was open last: the URL has lost it by the time the step closes.
  const lastSupply = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (supplyLine !== undefined) lastSupply.current = supplyLine.line;
  }, [supplyLine]);
  // A supply key that names no line without an order does not apply, so it leaves the URL.
  const staleSupply =
    snapshot !== undefined && search.supply !== undefined && supplyLine === undefined;
  useEffect(() => {
    if (!staleSupply) return;
    const { supply: _, ...rest } = search;
    navigate({ to: '.', search: rest, replace: true });
  }, [staleSupply, search, navigate]);
  const plantName =
    snapshot?.plants?.find((each) => each.slug === supplyLine?.deliveringPlant)?.name ??
    supplyLine?.deliveringPlant ??
    '';
  const withoutSupply = () => {
    const { supply: _, ...rest } = search;
    return rest;
  };
  return (
    <PageFrame
      title={first === undefined ? 'Customer order' : `Customer order ${first.customerOrder}`}
      crumbs={[{ label: 'Customer orders', href: planningLinks.customerOrders({ plant }).href }]}
      state={state}
      meta={
        first === undefined ? undefined : (
          <span className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <OwnerTag>From the ERP</OwnerTag>
            <span>
              <CustomerLink code={first.customerCode} name={customer?.name ?? first.customerCode} />
              {", the customer's reference "}
              <span className="font-mono">{first.customersReference}</span>
            </span>
          </span>
        )
      }
    >
      {snapshot !== undefined && first !== undefined && (
        <>
          {snapshot.fixture !== undefined && (
            <p className="text-xs text-muted-foreground">Showing fixture {snapshot.fixture}.</p>
          )}
          <DetailTabs
            label={`Customer order ${first.customerOrder}`}
            value={search.tab ?? 'general'}
            onValueChange={(tab) =>
              // A tab is a step Back undoes, so it pushes (ADR 0062).
              navigate({
                to: '.',
                search: tab === 'history' ? { ...search, tab: 'history' } : withoutTab(search),
              })
            }
            tabs={[
              {
                value: 'general',
                label: 'General',
                content: (
                  <>
                    <Alert role="note" className="border-info bg-info-subtle text-foreground">
                      <Info aria-hidden className="text-info" />
                      <AlertTitle>
                        Customer order {first.customerOrder} comes from the ERP
                      </AlertTitle>
                      <AlertDescription className="text-foreground">
                        The ERP owns the order number, the customer, the reference and each line's
                        article, quantity and wanted date; the next import changes them. In NorthMES
                        you choose which production order supplies a line, and how much of it.
                      </AlertDescription>
                    </Alert>
                    <CustomerOrderSection snapshot={snapshot} lines={lines} />
                    <LinesSection
                      snapshot={snapshot}
                      number={first.customerOrder}
                      lines={lines}
                      onSupply={(line) => show({ ...search, supply: line })}
                    />
                    <WhoChangesWhat />
                  </>
                ),
              },
              {
                value: 'history',
                label: 'History',
                content: <p className="text-sm text-muted-foreground">{historyReason}</p>,
              },
            ]}
          />
          <CustomerOrderSupplyDialog
            snapshot={snapshot}
            line={supplyLine}
            plantName={plantName}
            returnFocus={() =>
              lastSupply.current === undefined
                ? null
                : document.getElementById(supplyButtonId(lastSupply.current))
            }
            onClose={() => show(withoutSupply())}
          />
        </>
      )}
    </PageFrame>
  );
}

function withoutTab(search: CustomerOrderPageSearch): CustomerOrderPageSearch {
  const { tab: _, ...rest } = search;
  return rest;
}
