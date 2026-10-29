// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDate, formatPlantDay, formatPlantTime } from '@northmes/contracts/format';
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useParams, useSearch } from '@tanstack/react-router';
import { cn } from 'cn';
import { Clock, Lock, TriangleAlert } from 'lucide-react';
import { OwnerTag } from '../../../../ui/components/owner-tag/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { PageSection } from '../../../../ui/components/page-section/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { buttonVariants } from '../../../../ui/primitives/button.tsx';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/primitives/table.tsx';
import {
  type InventoryArticle,
  InventoryForbidden,
  type InventorySnapshot,
  type PlannedMovement,
} from '../../inventory-data.ts';
import { useInventory } from '../../inventory-source-context.ts';
import {
  balancesOf,
  compareCodes,
  isAtPlant,
  type Projection,
  type ProjectionStep,
  roundQuantity,
  type StockRow,
  stockRowOf,
} from '../../material-projection.ts';
import {
  jobOrderHref,
  kindLabel,
  quantityWithUnit,
  signedQuantity,
  stockTime,
  whenText,
} from '../../stock-facts.ts';
import { stockArticleSearch } from '../../stock-search.ts';
import { StockArticleChart } from './stock-article-chart.tsx';

const head = 'h-auto px-3 py-2 text-xs font-semibold text-muted-foreground';
const cell = 'px-3 py-2 whitespace-normal';
const link = 'text-link underline underline-offset-2 hover:no-underline';

/** What a movement consumes or brings, as the caption names it: "1004.10 consumes 102 m". */
function causeText(movement: PlannedMovement, unit: string): string {
  const amount = quantityWithUnit(Math.abs(movement.quantity), unit);
  if (movement.kind === 'consumption') return `${movement.reference} consumes ${amount}`;
  if (movement.kind === 'customerDemand')
    return `${movement.reference.toLowerCase()} takes ${amount}`;
  return `${movement.reference} takes ${amount}`;
}

/**
 * The projection in words, the chart's caption (SA1, SA3): when the balance falls below zero and
 * what takes it there, its lowest value when that is lower, what brings it back, each later dip,
 * or the level it stays at; then each movement not counted.
 */
export function projectionCaption(
  snapshot: InventorySnapshot,
  article: InventoryArticle,
  projection: Projection,
): string {
  const timeZone = snapshot.plant.timeZone;
  const unit = article.unit;
  const when = (movement: PlannedMovement) => whenText(movement.atMs, movement.dateOnly, timeZone);
  // The spans below zero: the step that starts each (none when the stock starts there) and the
  // step that ends it, if any.
  const dips: { start: ProjectionStep | undefined; back: ProjectionStep | undefined }[] = [];
  let below = projection.start < 0;
  if (below) dips.push({ start: undefined, back: undefined });
  for (const step of projection.steps) {
    if (step.balance === undefined) continue;
    if (!below && step.balance < 0) {
      dips.push({ start: step, back: undefined });
      below = true;
    } else if (below && step.balance >= 0) {
      const dip = dips.at(-1);
      if (dip !== undefined) dip.back = step;
      below = false;
    }
  }
  const sentences = dips.map((dip, index) => {
    const opening =
      dip.start === undefined
        ? `Starts below zero at ${quantityWithUnit(projection.start, unit)}`
        : `${index === 0 ? 'Falls' : 'Falls again'} below zero on ${when(dip.start.movement)} at ${quantityWithUnit(dip.start.balance ?? 0, unit)}, when ${causeText(dip.start.movement, unit)}`;
    const lowest =
      index === 0 && projection.lowest.balance < (dip.start?.balance ?? projection.start)
        ? `, is lowest at ${quantityWithUnit(projection.lowest.balance, unit)} on ${whenText(projection.lowest.atMs, projection.lowest.dateOnly, timeZone)}`
        : '';
    const closing =
      dip.back?.balance === undefined
        ? ', and stays below zero to the end of the projection.'
        : `, and is back at ${quantityWithUnit(dip.back.balance, unit)} on ${when(dip.back.movement)} with ${dip.back.movement.reference}.`;
    return `${opening}${lowest}${closing}`;
  });
  if (dips.length === 0) {
    sentences.push(
      `The balance stays at ${quantityWithUnit(projection.lowest.balance, unit)} or more.`,
    );
  }
  for (const step of projection.steps) {
    if (step.balance !== undefined) continue;
    sentences.push(
      `${step.movement.reference} (dashed ring, ${when(step.movement)}) is not counted.`,
    );
  }
  return sentences.join(' ');
}

/** The reference of a movement, with the link to its job order, order or customer order. */
function Reference({
  movement,
  timeZone,
}: {
  readonly movement: PlannedMovement;
  readonly timeZone: string;
}) {
  const { plant } = useShell();
  if (movement.jobOrder !== undefined) {
    const job = movement.jobOrder;
    return (
      <span>
        <Link to={jobOrderHref(movement, plant, timeZone)} className={cn('font-mono', link)}>
          {job.displayNumber}
        </Link>
        {` ${job.operationName}, ${job.article}`}
      </span>
    );
  }
  if (movement.productionOrder !== undefined) {
    return (
      <span>
        {'Production order '}
        <Link
          to={planningLinks.orders.order({ plant, orderId: movement.productionOrder.id }).href}
          className={cn('font-mono', link)}
        >
          {movement.productionOrder.number}
        </Link>
      </span>
    );
  }
  if (movement.customerOrderLine !== undefined) {
    const line = movement.customerOrderLine;
    return (
      <span>
        {'Customer order '}
        <Link
          to={
            planningLinks.customerOrders.customerOrder({
              plant,
              customerOrderId: line.customerOrder,
            }).href
          }
          className={cn('font-mono', link)}
        >
          {line.customerOrder}
        </Link>
        {` line ${line.line}, ${line.customerName}`}
      </span>
    );
  }
  return <span>{movement.reference}</span>;
}

/** The Balance per warehouse section: the counted warehouses and their sum (SA1). */
function BalanceSection({
  snapshot,
  article,
}: {
  readonly snapshot: InventorySnapshot;
  readonly article: InventoryArticle;
}) {
  const names = new Map(snapshot.warehouses.map((each) => [each.code, each.name]));
  const rows = balancesOf(snapshot, article.number).sort((a, b) =>
    compareCodes(a.warehouse, b.warehouse),
  );
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);
  const plantName = snapshot.plant.name;
  return (
    <PageSection title="Balance per warehouse">
      <Table>
        <TableCaption className="sr-only">Balance per warehouse</TableCaption>
        <TableHeader className="bg-muted">
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className={head}>
              Warehouse
            </TableHead>
            <TableHead scope="col" className={head}>
              Name
            </TableHead>
            <TableHead scope="col" className={cn(head, 'text-end')}>
              Balance
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.warehouse}>
              <TableCell className={cn(cell, 'font-mono')}>{row.warehouse}</TableCell>
              <TableCell className={cell}>{names.get(row.warehouse) ?? row.warehouse}</TableCell>
              <TableCell className={cn(cell, 'text-end font-mono')}>
                {quantityWithUnit(row.quantity, article.unit)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2} className={cn(cell, 'font-medium')}>
              {plantName}, counted
            </TableCell>
            <TableCell className={cn(cell, 'text-end font-mono font-semibold')}>
              {quantityWithUnit(roundQuantity(total), article.unit)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      <p className="text-xs text-muted-foreground">
        Every warehouse mapped to {plantName} counts. Warehouses of other plants are not shown.
      </p>
    </PageSection>
  );
}

/** The Planned movements section: every movement with its date source and the balance (SA1). */
function MovementsSection({
  snapshot,
  row,
}: {
  readonly snapshot: InventorySnapshot;
  readonly row: StockRow;
}) {
  const { article, projection } = row;
  const timeZone = snapshot.plant.timeZone;
  const warehouses = balancesOf(snapshot, article.number).length;
  return (
    <PageSection
      title="Planned movements"
      lead="Sorted by date, incoming before outgoing at the same time. A consumption is dated at the setup start of its job order, an output at the end of the order's last operation, an unplaced order's movement at its ERP date, and an overdue movement at now."
    >
      <Table>
        <TableCaption className="sr-only">
          Planned movements of {article.name} with the projected balance
        </TableCaption>
        <TableHeader className="bg-muted">
          <TableRow className="hover:bg-transparent">
            {['Date', 'Date from', 'Kind', 'Reference', 'Warehouse'].map((label) => (
              <TableHead key={label} scope="col" className={head}>
                {label}
              </TableHead>
            ))}
            <TableHead scope="col" className={cn(head, 'text-end')}>
              Quantity
            </TableHead>
            <TableHead scope="col" className={cn(head, 'text-end')}>
              Projected balance
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="bg-muted/50">
            <TableCell className={cn(cell, 'font-mono')}>
              {stockTime(snapshot, snapshot.stockAsOfMs)}
            </TableCell>
            <TableCell className={cell}>ERP balance</TableCell>
            <TableCell className={cell}>In stock</TableCell>
            <TableCell className={cell}>
              Sum of {warehouses === 1 ? '1 warehouse' : `${warehouses} warehouses`}
            </TableCell>
            <TableCell className={cell} />
            <TableCell className={cell} />
            <TableCell className={cn(cell, 'text-end font-mono')}>
              {quantityWithUnit(projection.start, article.unit)}
            </TableCell>
          </TableRow>
          {projection.steps.map(({ movement, balance }) => (
            <TableRow
              key={movement.id}
              className={cn(
                balance !== undefined && balance < 0 && 'bg-destructive-subtle',
                balance === undefined && 'text-muted-foreground',
              )}
            >
              <TableCell className={cn(cell, 'font-mono')}>
                {whenText(movement.atMs, movement.dateOnly, timeZone)}
              </TableCell>
              <TableCell className={cell}>
                <span className="flex flex-col">
                  <span>{movement.dateFrom}</span>
                  {movement.overdueSince !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      ERP date {formatPlantDay(movement.overdueSince)}
                    </span>
                  )}
                </span>
              </TableCell>
              <TableCell className={cell}>{kindLabel(movement.kind)}</TableCell>
              <TableCell className={cell}>
                <Reference movement={movement} timeZone={timeZone} />
              </TableCell>
              <TableCell className={cn(cell, 'font-mono')}>{movement.warehouse}</TableCell>
              <TableCell className={cn(cell, 'text-end font-mono')}>
                {signedQuantity(movement.quantity, article.unit)}
              </TableCell>
              <TableCell className={cn(cell, 'text-end')}>
                {balance === undefined ? (
                  <StatusBadge tone="neutral">Not counted</StatusBadge>
                ) : (
                  <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                    <span className={cn('font-mono', balance < 0 && 'font-semibold')}>
                      {quantityWithUnit(balance, article.unit)}
                    </span>
                    {balance < 0 && <StatusBadge tone="destructive">Below zero</StatusBadge>}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </PageSection>
  );
}

/** The state beside the h1: Material short for its job orders, or Late order (SA1). */
function ShortBadge({ row }: { readonly row: StockRow }) {
  const short = row.short;
  if (short?.kind === 'material') {
    return (
      <StatusBadge tone="warning" icon={TriangleAlert}>
        Material short for {short.shortages.map((each) => each.jobOrder.displayNumber).join(', ')}
      </StatusBadge>
    );
  }
  if (short?.kind === 'lateOrder') {
    return (
      <StatusBadge tone="destructive" icon={Clock}>
        Late order {short.order.number}
      </StatusBadge>
    );
  }
  if (short?.kind === 'belowZero') return <StatusBadge tone="destructive">Below zero</StatusBadge>;
  return null;
}

/**
 * The stock of one article at the plant under Planning (plan 07, Material warnings; design #729,
 * SA1 to SA3): its name in the h1 with its number and its state, the balance per counted
 * warehouse with their sum, the projected balance as a step chart with its caption in words, and
 * every planned movement with where its date comes from and the running balance. Read-only. An
 * article without stock or movements at the plant shows the not-found state.
 */
export function StockArticleScreen() {
  const { plant } = useShell();
  const { articleId = '' } = useParams({ strict: false });
  const search = stockArticleSearch(useSearch({ strict: false }));
  const { snapshot, error, retry } = useInventory(search.preview);
  const article = snapshot?.articles.find((each) => each.number === articleId);
  const known =
    snapshot !== undefined && article !== undefined && isAtPlant(snapshot, article.number);
  const row =
    snapshot !== undefined && article !== undefined && known
      ? stockRowOf(snapshot, article)
      : undefined;
  const stockHref = planningLinks.stock({ plant }).href;

  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && error instanceof InventoryForbidden) {
    state = {
      status: 'empty',
      icon: Lock,
      title: 'You need the permission to read stock at this plant',
      description: 'Ask your plant admin for a role that can read stock.',
    };
  } else if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load the stock', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (row === undefined) {
    state = {
      status: 'empty',
      title: 'This article has no stock at this plant or does not exist',
      description: 'The link may be out of date, or no warehouse of this plant holds the article.',
      action: (
        <Link to={stockHref} className={buttonVariants({ variant: 'outline' })}>
          Back to Stock
        </Link>
      ),
    };
  }
  const timeZone = snapshot?.plant.timeZone ?? 'UTC';
  return (
    <PageFrame
      title={row?.article.name ?? 'Stock of an article'}
      crumbs={[{ label: 'Stock', href: stockHref }]}
      state={state}
      meta={
        row === undefined ? undefined : (
          <span className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-mono">{row.article.number}</span>
            <ShortBadge row={row} />
            <OwnerTag>From the ERP</OwnerTag>
          </span>
        )
      }
    >
      {snapshot !== undefined && row !== undefined && (
        <>
          <p className="text-sm text-muted-foreground">
            {`Stock unit ${row.article.unit}. Stock and planned movements are read-only in NorthMES. ERP data as of ${stockTime(snapshot, snapshot.stockAsOfMs)}${
              snapshot.nextImportMs === undefined
                ? '.'
                : `; the next stock import is due at ${formatPlantTime(snapshot.nextImportMs, timeZone)}.`
            }`}
            {snapshot.fixture !== undefined && ` Showing fixture ${snapshot.fixture}.`}
          </p>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <BalanceSection snapshot={snapshot} article={row.article} />
            <PageSection
              title="Projected balance"
              lead={`${formatPlantDate(snapshot.stockAsOfMs, timeZone)} to ${formatPlantDate(snapshot.projectedToMs - 1, timeZone)}, plant time. Purchase requisitions ${snapshot.countPurchaseRequisitions ? 'counted' : 'not counted'} (${snapshot.plant.name} setting).`}
            >
              <StockArticleChart
                snapshot={snapshot}
                projection={row.projection}
                caption={projectionCaption(snapshot, row.article, row.projection)}
              />
            </PageSection>
          </div>
          <MovementsSection snapshot={snapshot} row={row} />
        </>
      )}
    </PageFrame>
  );
}
