// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDay } from '@northmes/contracts/format';
import { useShell } from '@northmes/web-sdk';
import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { Lock } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
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
import type { GanttOrder, GanttSnapshot, OrderAnalysis } from '../../gantt-data.ts';
import { phase1Reason } from '../../mock-reasons.ts';
import {
  demandOf,
  machineNamer,
  operationStatus,
  ownerLabel,
  plantTime,
  slackText,
  timelineLinks,
} from '../../order-facts.ts';
import { quantityText, statusLabel } from '../gantt/gantt-rows.ts';
import { deadlineRuleText } from '../job-orders/job-orders-late-facts.tsx';

/** A section of the page: a card named by its h2, with a line that says where its content comes from. */
function Section({
  id,
  title,
  lead,
  action,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly lead?: ReactNode;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}) {
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
          {lead !== undefined && <p className="text-sm text-muted-foreground">{lead}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A term, its value and the note under the value that names its source or rule (PO1). */
function Definition({
  term,
  value,
  note,
  mono = false,
}: {
  readonly term: string;
  readonly value: ReactNode;
  readonly note?: ReactNode;
  readonly mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-muted-foreground">{term}</dt>
      <dd className="flex flex-col gap-0.5">
        <span className={cn('text-sm', mono && 'font-mono')}>{value}</span>
        {note !== undefined && <span className="text-xs text-muted-foreground">{note}</span>}
      </dd>
    </div>
  );
}

const head = 'h-auto px-3 py-2 text-xs font-semibold text-muted-foreground';
const cell = 'px-3 py-2 whitespace-normal';

/** The section lead of the order: where it came from and when (PO1). */
function sourceLine(snapshot: GanttSnapshot, order: GanttOrder): string {
  const origin = order.origin;
  if (order.owner === 'northmes') {
    const by = origin?.createdBy === undefined ? '' : ` by ${origin.createdBy}`;
    const at =
      origin?.createdAtMs === undefined ? '' : `, ${plantTime(snapshot, origin.createdAtMs)}`;
    return `Created in NorthMES${by}${at}.`;
  }
  const imported =
    origin?.importedAtMs === undefined
      ? ''
      : `, imported ${plantTime(snapshot, origin.importedAtMs)}`;
  return `From the ERP, order number ${order.number}${imported}.`;
}

/** The Order section: the facts with the rule or source behind each (PO1). */
function OrderSection({
  snapshot,
  order,
  analysis,
}: {
  readonly snapshot: GanttSnapshot;
  readonly order: GanttOrder;
  readonly analysis: OrderAnalysis | undefined;
}) {
  const imported = order.owner !== 'northmes';
  const erpName = snapshot.erp?.name;
  return (
    <Section id="order-facts" title="Order" lead={sourceLine(snapshot, order)}>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Definition term="Article" value={order.article} />
        <Definition term="Quantity" value={quantityText(order.quantity)} mono />
        <Definition
          term="Status"
          value={
            <span className="flex flex-wrap gap-1.5">
              <StatusBadge tone={order.status === 'released' ? 'success' : 'info'}>
                {statusLabel(order.status)}
              </StatusBadge>
              {analysis?.late && (
                <StatusBadge tone="destructive">
                  Late {formatDuration(-analysis.slackElapsedS)}
                </StatusBadge>
              )}
            </span>
          }
        />
        <Definition
          term="Deadline"
          value={plantTime(snapshot, order.deadlineMs)}
          mono
          note={
            imported
              ? `The ERP sent the date only. The deadline rule of the plant sets the time: ${deadlineRuleText(snapshot.settings).charAt(0).toLowerCase()}${deadlineRuleText(snapshot.settings).slice(1)}.`
              : 'Set by hand.'
          }
        />
        <Definition
          term="Priority"
          value={order.priority === null ? 'None' : String(order.priority)}
          mono
          note="Lower numbers go first among orders with the same deadline."
        />
        <Definition
          term="Planned end"
          value={
            analysis?.plannedEndMs === undefined
              ? 'Not placed'
              : plantTime(snapshot, analysis.plannedEndMs)
          }
          mono
          note={slackText(analysis)}
        />
        <Definition
          term="Earliest start"
          value="Not set"
          mono
          note="No job order of this order starts before it. Set by a planner or sent by the ERP."
        />
        <Definition
          term="Color on the board"
          value={
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block size-3.5 rounded-sm border border-border"
                style={{ background: `var(--${order.color})` }}
              />
              <span className="font-mono">{order.color}</span>
            </span>
          }
        />
        <Definition
          term="Source"
          value={ownerLabel(order)}
          note={
            imported
              ? `${erpName === undefined ? '' : `Through the connection ${erpName}. `}The ERP owns article, quantity, deadline date and priority; later imports change them, planning fields stay.`
              : 'Every field can be changed here.'
          }
        />
      </dl>
    </Section>
  );
}

/** The Demand section: the customer order lines the order supplies (PO1, plan 07). */
function DemandSection({
  snapshot,
  order,
}: {
  readonly snapshot: GanttSnapshot;
  readonly order: GanttOrder;
}) {
  const lines = demandOf(snapshot, order);
  const customers = new Map((snapshot.customers ?? []).map((each) => [each.code, each.name]));
  const supplied = lines.reduce((sum, line) => sum + line.quantity, 0);
  const lead =
    lines.length === 0
      ? 'Stock order: no customer order line is supplied by this order.'
      : lines.length === 1
        ? 'One customer order line is supplied by this order.'
        : `${lines.length} customer order lines for ${order.article} are gathered into this one order.`;
  return (
    <Section
      id="order-demand"
      title="Demand"
      lead={lead}
      action={
        <Button variant="outline" className="h-8 px-3" disabled>
          Edit demand
        </Button>
      }
    >
      {lines.length > 0 && (
        <Table>
          <TableCaption className="sr-only">Customer order lines this order supplies</TableCaption>
          <TableHeader className="bg-muted">
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className={head}>
                Customer
              </TableHead>
              <TableHead scope="col" className={head}>
                Customer order
              </TableHead>
              <TableHead scope="col" className={head}>
                Line
              </TableHead>
              <TableHead scope="col" className={head}>
                Customer's number
              </TableHead>
              <TableHead scope="col" className={cn(head, 'text-end')}>
                Quantity
              </TableHead>
              <TableHead scope="col" className={head}>
                Wanted
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className={cell}>
                  {customers.get(line.customerCode) ?? line.customerCode}{' '}
                  <span className="font-mono text-xs text-muted-foreground">
                    {line.customerCode}
                  </span>
                </TableCell>
                <TableCell className={cn(cell, 'font-mono')}>{line.customerOrder}</TableCell>
                <TableCell className={cn(cell, 'font-mono')}>{line.line}</TableCell>
                <TableCell className={cn(cell, 'font-mono')}>{line.customersReference}</TableCell>
                <TableCell className={cn(cell, 'text-end font-mono')}>
                  {quantityText(line.quantity)}
                </TableCell>
                <TableCell className={cn(cell, 'font-mono')}>
                  {formatPlantDay(line.wantedDate)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted hover:bg-muted">
              <TableCell colSpan={4} className={cn(cell, 'font-medium')}>
                Supplied
              </TableCell>
              <TableCell className={cn(cell, 'text-end font-mono font-semibold')}>
                {quantityText(supplied)} of {quantityText(order.quantity)}
              </TableCell>
              <TableCell className={cn(cell, 'text-xs text-muted-foreground')}>
                {supplied < order.quantity
                  ? `${quantityText(order.quantity - supplied)} to stock`
                  : 'Nothing to stock'}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </Section>
  );
}

/** The Operations section: the routing sequence with allowed machines and the default (PO1). */
function OperationsSection({
  snapshot,
  order,
}: {
  readonly snapshot: GanttSnapshot;
  readonly order: GanttOrder;
}) {
  const machineName = machineNamer(snapshot);
  const version = order.origin?.routingVersion;
  const operations = [...order.operations].sort((a, b) => a.sequence - b.sequence);
  return (
    <Section
      id="order-operations"
      title="Operations"
      lead={`Copied from the routing of ${order.article}${version === undefined ? '' : `, version ${version}`}, when the order was released. Allowed machines come from the routing; the default is the machine autoplan prefers.`}
    >
      <Table>
        <TableCaption className="sr-only">Operations in routing sequence</TableCaption>
        <TableHeader className="bg-muted">
          <TableRow className="hover:bg-transparent">
            {[
              'Operation',
              'Name',
              'Allowed machines',
              'Default machine',
              'Lead time',
              'Send-ahead',
              'Hard lock',
              'Status',
            ].map((label) => (
              <TableHead key={label} scope="col" className={head}>
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {operations.map((operation) => {
            const rows = order.jobOrders.filter((row) => row.operationId === operation.id);
            return (
              <TableRow key={operation.id}>
                <TableCell className={cn(cell, 'font-mono')}>{operation.displayNumber}</TableCell>
                <TableCell className={cell}>{operation.name}</TableCell>
                <TableCell className={cell}>
                  {operation.allowedEquipment.map(machineName).join(', ')}
                </TableCell>
                <TableCell className={cell}>{machineName(operation.allowedEquipment[0])}</TableCell>
                <TableCell className={cn(cell, 'font-mono')}>
                  {operation.leadTimeS === 0 ? 'None' : formatDuration(operation.leadTimeS)}
                </TableCell>
                <TableCell className={cn(cell, 'font-mono')}>
                  {operation.sendAheadQuantity === 0
                    ? 'None'
                    : quantityText(operation.sendAheadQuantity)}
                </TableCell>
                <TableCell className={cell}>
                  {operation.isLocked ? (
                    <StatusBadge tone="neutral" icon={Lock}>
                      Locked
                    </StatusBadge>
                  ) : (
                    <span className="text-muted-foreground">No</span>
                  )}
                </TableCell>
                <TableCell className={cell}>
                  <StatusBadge tone="info">{statusLabel(operationStatus(rows))}</StatusBadge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Section>
  );
}

/** The Job orders section: each job order with its placement, Move disabled and Show on board (PO1). */
function JobOrdersSection({
  snapshot,
  order,
}: {
  readonly snapshot: GanttSnapshot;
  readonly order: GanttOrder;
}) {
  const { plant } = useShell();
  const machineName = machineNamer(snapshot);
  const links = timelineLinks(snapshot, order, plant);
  const placed = order.jobOrders.filter((row) => row.placement !== undefined).length;
  const lead =
    placed === order.jobOrders.length
      ? 'One job order per operation, all placed. Times are plant time.'
      : `${placed} of ${order.jobOrders.length} job orders placed. Times are plant time.`;
  const operationName = (operationId: string) =>
    order.operations.find((operation) => operation.id === operationId)?.name ?? '';
  return (
    <Section id="order-job-orders" title="Job orders" lead={lead}>
      <Table>
        <TableCaption className="sr-only">Job orders and their placements</TableCaption>
        <TableHeader className="bg-muted">
          <TableRow className="hover:bg-transparent">
            {['Job order', 'Machine', 'Setup start', 'Run start', 'End', 'Setup', 'Run'].map(
              (label) => (
                <TableHead key={label} scope="col" className={head}>
                  {label}
                </TableHead>
              ),
            )}
            <TableHead scope="col" className={cn(head, 'text-end')}>
              Quantity
            </TableHead>
            <TableHead scope="col" className={head}>
              Status
            </TableHead>
            <TableHead scope="col" className={head}>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.jobOrders.map((row) => (
            <TableRow key={row.id}>
              <TableCell className={cell}>
                <span className="font-mono font-medium">{row.displayNumber}</span>{' '}
                <span className="text-muted-foreground">{operationName(row.operationId)}</span>
              </TableCell>
              <TableCell className={cell}>{machineName(row.equipment)}</TableCell>
              {(['setupStartMs', 'runStartMs', 'endMs'] as const).map((key) => (
                <TableCell key={key} className={cn(cell, 'font-mono')}>
                  {row.placement === undefined ? '' : plantTime(snapshot, row.placement[key])}
                </TableCell>
              ))}
              <TableCell className={cn(cell, 'font-mono')}>
                {row.plannedSetupS === 0 ? 'None' : formatDuration(row.plannedSetupS)}
              </TableCell>
              <TableCell className={cn(cell, 'font-mono')}>
                {formatDuration(row.plannedRunS, { form: 'hours' })}
              </TableCell>
              <TableCell className={cn(cell, 'text-end font-mono')}>
                {quantityText(row.quantity)}
              </TableCell>
              <TableCell className={cell}>
                <StatusBadge
                  tone={
                    row.status === 'planned'
                      ? 'info'
                      : row.status === 'started'
                        ? 'success'
                        : 'neutral'
                  }
                >
                  {statusLabel(row.status)}
                </StatusBadge>
              </TableCell>
              <TableCell className={cell}>
                <span className="flex items-center justify-end gap-1">
                  <Button variant="outline" className="h-8 px-2.5" disabled>
                    Move
                  </Button>
                  <Link
                    to={links.board}
                    className={cn(buttonVariants({ variant: 'ghost' }), 'h-8 px-2.5')}
                  >
                    Show on board
                  </Link>
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">{phase1Reason}</p>
    </Section>
  );
}

/** The General tab of an order's page (PO1): Order, Demand, Operations and Job orders. */
export function OrderGeneral({
  snapshot,
  order,
}: {
  readonly snapshot: GanttSnapshot;
  readonly order: GanttOrder;
}) {
  const analysis = snapshot.analysis.orders[order.id];
  return (
    <Fragment>
      <OrderSection snapshot={snapshot} order={order} analysis={analysis} />
      <DemandSection snapshot={snapshot} order={order} />
      <OperationsSection snapshot={snapshot} order={order} />
      <JobOrdersSection snapshot={snapshot} order={order} />
    </Fragment>
  );
}
