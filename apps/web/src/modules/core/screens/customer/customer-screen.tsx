// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDateTime, formatPlantDay } from '@northmes/contracts/format';
import { coreLinks } from '@northmes/core-contracts';
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { cn } from 'cn';
import { ChartNoAxesGantt, Clock } from 'lucide-react';
import { type ReactNode, useEffect, useId, useMemo, useRef } from 'react';
import { Temporal } from 'temporal-polyfill';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { DetailTabs } from '../../../../ui/components/detail-tabs/index.ts';
import { OwnerTag } from '../../../../ui/components/owner-tag/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { SearchField } from '../../../../ui/components/search-field/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import {
  type CustomerSummary,
  isLateLine,
  linesOf,
  linesText,
  ordersText,
  summaryOf,
} from '../../customer-facts.ts';
import {
  type CustomerPageSearch,
  customerPageSearch,
  urlSearchOf,
} from '../../customer-list-search.ts';
import type { Customer, CustomerLine, CustomersSnapshot } from '../../customers-data.ts';
import { useCustomers } from '../../customers-source-context.ts';

/** The id of the lines' search input, where Clear filters moves focus. */
const searchFieldId = 'customer-lines-search';

/** Why the History tab is empty while the customers pages read the fixture G1. */
const historyReason =
  "A customer's history waits for the customers API; this page reads the fixture G1.";

const link = 'text-link underline underline-offset-2 hover:no-underline';

/** A section of the page: a card named by its h2, with a line that says what it holds. */
function Section({
  title,
  lead,
  action,
  children,
}: {
  readonly title: string;
  readonly lead: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 text-card-foreground"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id={id} className="text-base font-semibold">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{lead}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A term, its value and the note under the value that names its source (CC1). */
function Definition({
  term,
  children,
  note,
  mono = false,
}: {
  readonly term: string;
  readonly children: ReactNode;
  readonly note?: ReactNode;
  readonly mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-muted-foreground">{term}</dt>
      <dd className="flex flex-col gap-0.5">
        <span className={cn('flex flex-wrap items-center gap-2 text-sm', mono && 'font-mono')}>
          {children}
        </span>
        {note !== undefined && <span className="text-xs text-muted-foreground">{note}</span>}
      </dd>
    </div>
  );
}

/** The Customer section: number and name from the ERP and the summary of its open lines (CC1). */
function CustomerSection({
  snapshot,
  summary,
}: {
  readonly snapshot: CustomersSnapshot;
  readonly summary: CustomerSummary;
}) {
  const { customer } = summary;
  const imported = customer.owner === 'erp';
  const erp = snapshot.erp;
  return (
    <Section
      title="Customer"
      lead="The ERP sends the customer number and name only. Addresses and contacts stay in the ERP."
    >
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Definition term="Customer number" mono>
          {customer.code}
          {imported && <OwnerTag>From the ERP</OwnerTag>}
        </Definition>
        <Definition term="Name">
          {customer.name}
          {imported && <OwnerTag>From the ERP</OwnerTag>}
        </Definition>
        <Definition
          term="Source"
          note={
            imported && erp !== undefined
              ? `Through the connection ${erp.name}, imported ${formatPlantDateTime(erp.importedAtMs, snapshot.plant.timeZone)}. The next import changes number and name; NorthMES never does.`
              : undefined
          }
        >
          {imported ? 'From the ERP' : 'NorthMES'}
        </Definition>
        <Definition term="Open customer order lines" mono>
          {linesText(summary.lines)}
        </Definition>
        <Definition term="Supplied by" note={summary.orders.join(', ')} mono>
          {ordersText(summary.orders.length)}
        </Definition>
        <Definition term="Next wanted date" mono>
          {summary.nextWanted === undefined ? 'None' : formatPlantDay(summary.nextWanted)}
        </Definition>
      </dl>
    </Section>
  );
}

/** The plant date of an instant, "2026-11-03": the first day of the Gantt's range at an order. */
function plantDateOf(epochMs: number, timeZone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(epochMs)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
    .toString();
}

/** The order that supplies a line, with its status and Late by; or Not supplied (CC1, CC4). */
function SuppliedBy({ line, plant }: { readonly line: CustomerLine; readonly plant: string }) {
  const supply = line.supply;
  if (supply === undefined) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <StatusBadge tone="neutral">Not supplied</StatusBadge>
        <span className="text-xs text-muted-foreground">No production order yet</span>
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Link
        to={planningLinks.orders.order({ plant, orderId: supply.orderId }).href}
        className={`font-mono ${link}`}
      >
        Order {supply.number}
      </Link>
      <StatusBadge tone={supply.status === 'released' ? 'success' : 'info'}>
        {supply.status === 'released' ? 'Released' : 'Planned'}
      </StatusBadge>
      {supply.late && (
        <StatusBadge tone="destructive" icon={Clock}>
          Late {formatDuration(-supply.slackElapsedS)}
        </StatusBadge>
      )}
    </span>
  );
}

function columnsOf(snapshot: CustomersSnapshot, plant: string): DataTableColumn<CustomerLine>[] {
  const timeZone = snapshot.plant.timeZone;
  return [
    {
      id: 'customerOrder',
      header: 'Customer order',
      sticky: true,
      cell: (line) => (
        <span className="flex flex-col">
          <span>
            <Link
              to={
                planningLinks.customerOrders.customerOrder({
                  plant,
                  customerOrderId: line.customerOrder,
                }).href
              }
              className={`font-mono ${link}`}
            >
              {line.customerOrder}
            </Link>{' '}
            <span className="text-xs text-muted-foreground">line {line.line}</span>
          </span>
          <span className="font-mono text-xs text-muted-foreground">{line.customersReference}</span>
        </span>
      ),
    },
    {
      id: 'wanted',
      header: 'Wanted',
      cell: (line) => <span className="font-mono">{formatPlantDay(line.wantedDate)}</span>,
    },
    { id: 'article', header: 'Article', cell: (line) => line.article },
    {
      id: 'quantity',
      header: 'Quantity',
      numeric: true,
      cell: (line) => <span className="font-mono">{line.quantity} pcs</span>,
    },
    {
      id: 'suppliedBy',
      header: 'Supplied by',
      cell: (line) => <SuppliedBy line={line} plant={plant} />,
    },
    {
      id: 'plannedEnd',
      header: 'Planned end',
      cell: (line) => (
        <span className="font-mono">
          {line.supply === undefined
            ? ''
            : line.supply.plannedEndMs === undefined
              ? 'Not placed'
              : formatPlantDateTime(line.supply.plannedEndMs, timeZone)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      headerHidden: true,
      cell: (line) => {
        const outline = `${buttonVariants({ variant: 'outline' })} h-8 px-2.5`;
        if (line.supply === undefined) {
          return (
            <span className="flex justify-end">
              <Link
                to={
                  planningLinks.customerOrders.customerOrder(
                    { plant, customerOrderId: line.customerOrder },
                    { supply: String(line.line) },
                  ).href
                }
                aria-label={`Supply from an order, line ${line.line} of ${line.customerOrder}`}
                className={outline}
              >
                Supply from an order
              </Link>
            </span>
          );
        }
        const supply = line.supply;
        return (
          <span className="flex justify-end">
            <Link
              to={
                planningLinks.gantt(
                  { plant },
                  {
                    zoom: 'week',
                    from: plantDateOf(supply.plannedStartMs ?? snapshot.nowMs, timeZone),
                    order: supply.orderId,
                  },
                ).href
              }
              aria-label={`Open on Gantt, order ${supply.number}`}
              className={outline}
            >
              <ChartNoAxesGantt aria-hidden />
              Open on Gantt
            </Link>
          </span>
        );
      },
    },
  ];
}

/** Whether a line passes the view's search, Late only and Not supplied. */
function lineMatches(line: CustomerLine, view: CustomerPageSearch): boolean {
  if (view.late === 1 && !isLateLine(line)) return false;
  if (view.unsupplied === 1 && line.supply !== undefined) return false;
  if (view.q === undefined) return true;
  const needle = view.q.toLowerCase();
  return [
    line.customerOrder,
    line.customersReference,
    line.article,
    line.supply?.number ?? '',
  ].some((text) => text.toLowerCase().includes(needle));
}

/** "a", "a and b" or "a, b and c". */
function listText(items: readonly string[]): string {
  return items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`;
}

/** The status line of the lines: what the filters keep and, with Late only, why (CC1, CC4). */
function linesStatus(
  all: readonly CustomerLine[],
  shown: readonly CustomerLine[],
  view: CustomerPageSearch,
): string {
  const sorted = 'Sorted by wanted date.';
  if (view.late === 1) {
    const late = shown.filter((line) => line.supply !== undefined);
    const orders = [...new Set(late.map((line) => line.supply?.number ?? ''))];
    const lines = late.map((line) => `line ${line.line} of customer order ${line.customerOrder}`);
    const reason =
      late.length === 0
        ? ''
        : orders.length === 1
          ? ` Order ${orders[0]} ends after its deadline, so ${listText(lines)} ${lines.length === 1 ? 'is' : 'are'} at risk.`
          : ` Orders ${listText(orders)} end after their deadlines, so ${listText(lines)} are at risk.`;
    return `${shown.length} of ${linesText(all.length)}, late only.${reason} ${sorted}`;
  }
  const late = shown.filter(isLateLine).length;
  const notSupplied = shown.filter((line) => line.supply === undefined).length;
  const lines =
    shown.length === all.length
      ? linesText(all.length)
      : `${shown.length} of ${linesText(all.length)}`;
  return `${lines}, ${late} late, ${notSupplied} not supplied. ${sorted}`;
}

/** The Customer order lines section: the open lines, their filters and their supply (CC1, CC4). */
function LinesSection({
  snapshot,
  customer,
  view,
  show,
}: {
  readonly snapshot: CustomersSnapshot;
  readonly customer: Customer;
  readonly view: CustomerPageSearch;
  readonly show: (next: CustomerPageSearch) => void;
}) {
  const { plant } = useShell();
  const lateId = `${searchFieldId}-late`;
  const unsuppliedId = `${searchFieldId}-unsupplied`;
  const all = useMemo(
    () =>
      linesOf(snapshot, customer.code).sort(
        (a, b) =>
          a.wantedDate.localeCompare(b.wantedDate) ||
          a.customerOrder.localeCompare(b.customerOrder) ||
          a.line - b.line,
      ),
    [snapshot, customer.code],
  );
  const shown = all.filter((line) => lineMatches(line, view));
  const status = linesStatus(all, shown, view);
  // The filters change the rows without moving focus, so the new status is spoken (WCAG 4.1.3).
  const announced = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (announced.current !== undefined && announced.current !== status) announce(status);
    announced.current = status;
  }, [status]);
  const columns = useMemo(() => columnsOf(snapshot, plant), [snapshot, plant]);
  const filtered = view.q !== undefined || view.late === 1 || view.unsupplied === 1;
  const withFlag = (key: 'late' | 'unsupplied', on: boolean) => {
    const { [key]: _, ...rest } = view;
    show(on ? { ...rest, [key]: 1 } : rest);
  };
  return (
    <Section
      title="Customer order lines"
      lead="Every open line of this customer and the production order that supplies it. Wanted dates are the customer's; deadlines are the production orders'."
      action={
        <Link
          to={planningLinks.customerOrders({ plant }, { customer: customer.code }).href}
          className={`${buttonVariants({ variant: 'outline' })} h-8 px-3`}
        >
          Open in Customer orders
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          id={searchFieldId}
          label="Search lines"
          value={view.q ?? ''}
          onSearch={(q) => {
            const { q: _, ...rest } = view;
            show(q.trim() === '' ? rest : { ...rest, q: q.trim() });
          }}
          className="w-full max-w-xs"
        />
        <Field orientation="horizontal" className="w-auto">
          <Checkbox
            id={lateId}
            checked={view.late === 1}
            onCheckedChange={(checked) => withFlag('late', checked)}
          />
          <FieldLabel htmlFor={lateId}>Late only</FieldLabel>
        </Field>
        <Field orientation="horizontal" className="w-auto">
          <Checkbox
            id={unsuppliedId}
            checked={view.unsupplied === 1}
            onCheckedChange={(checked) => withFlag('unsupplied', checked)}
          />
          <FieldLabel htmlFor={unsuppliedId}>Not supplied</FieldLabel>
        </Field>
        {filtered && (
          <Button
            variant="link"
            onClick={() => {
              const { q: _q, late: _l, unsupplied: _u, ...rest } = view;
              show(rest);
              document.getElementById(searchFieldId)?.focus();
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground" data-list-status>
        {status}
      </p>
      <DataTable
        label={`Customer order lines of ${customer.name}`}
        columns={columns}
        rows={shown}
        getRowId={(line) => line.id}
        scrollLabel="Customer order lines, scrolls sideways"
      />
      {shown.length === 0 && (
        <p className="text-sm">
          <span className="font-semibold">No lines match these filters.</span>{' '}
          <span className="text-muted-foreground">
            Clear the filters to see every open line of {customer.name}.
          </span>
        </p>
      )}
    </Section>
  );
}

/**
 * A customer's page under Master data (design #728, CC1 to CC6): its name in the h1 with the From
 * the ERP tag and its number beside it, and the tabs General and History with the open one in the
 * URL's tab. General holds the Customer section, number and name from the ERP with the source and
 * the summary of its open lines, and the Customer order lines section: each open line with its
 * customer order, the customer's reference, wanted date, article and quantity, and the order that
 * supplies it with its status and Late by, or Not supplied with Supply from an order. Search, Late
 * only and Not supplied live in the URL (ADR 0062). The page changes nothing: the ERP owns the
 * customer. A customer the snapshot does not hold shows the not-found state (CC6).
 */
export function CustomerScreen() {
  const { plant } = useShell();
  const { customerId = '' } = useParams({ strict: false });
  const view = customerPageSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const show = (next: CustomerPageSearch) =>
    navigate({ to: '.', search: urlSearchOf(next), replace: true });
  const { snapshot, error, retry } = useCustomers(view.preview);
  const customer = snapshot?.customers.find((each) => each.code === customerId);

  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load the customer', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (customer === undefined) {
    state = {
      status: 'empty',
      title: 'This customer does not exist or you cannot see it',
      description:
        'The link may be out of date, or the customer belongs to a company you have no role in.',
      action: (
        <Link
          to={coreLinks.customers({ plant }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Back to Customers
        </Link>
      ),
    };
  }
  return (
    <PageFrame
      title={customer?.name ?? 'Customer'}
      crumbs={[{ label: 'Customers', href: coreLinks.customers({ plant }).href }]}
      state={state}
      meta={
        customer === undefined ? undefined : (
          <span className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {customer.owner === 'erp' && <OwnerTag>From the ERP</OwnerTag>}
            <span className="font-mono">Customer {customer.code}</span>
          </span>
        )
      }
    >
      {snapshot !== undefined && customer !== undefined && (
        <>
          {snapshot.fixture !== undefined && (
            <p className="text-xs text-muted-foreground">Showing fixture {snapshot.fixture}.</p>
          )}
          <DetailTabs
            label={`Customer ${customer.code}`}
            value={view.tab ?? 'general'}
            onValueChange={(tab) =>
              // A tab is a step Back undoes, so it pushes (ADR 0062).
              navigate({
                to: '.',
                search: urlSearchOf(
                  tab === 'history' ? { ...view, tab: 'history' } : withoutTab(view),
                ),
              })
            }
            tabs={[
              {
                value: 'general',
                label: 'General',
                content: (
                  <>
                    <CustomerSection snapshot={snapshot} summary={summaryOf(snapshot, customer)} />
                    <LinesSection snapshot={snapshot} customer={customer} view={view} show={show} />
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
        </>
      )}
    </PageFrame>
  );
}

function withoutTab(view: CustomerPageSearch): CustomerPageSearch {
  const { tab: _, ...rest } = view;
  return rest;
}
