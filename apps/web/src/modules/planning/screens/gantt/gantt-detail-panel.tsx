// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDateTime } from '@northmes/contracts/format';
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { ChevronRight, CircleCheck, Ellipsis, Layers } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { Badge } from '../../../../ui/primitives/badge.tsx';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../../../ui/primitives/collapsible.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../ui/primitives/dropdown-menu.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../../../ui/primitives/sheet.tsx';
import { shownFields } from '../../board-fields.ts';
import { bindingSentence } from '../../gantt-analysis.ts';
import type { ConstraintLine, GanttSnapshot } from '../../gantt-data.ts';
import { orderNumbersText } from '../../gantt-draft.ts';
import type { InventorySnapshot, PlannedMovement } from '../../inventory-data.ts';
import { type MaterialShortage, roundQuantity } from '../../material-projection.ts';
import { phase1Reason, planReason } from '../../mock-reasons.ts';
import { useMoveOf } from '../../move-store.ts';
import { amountText, quantityWithUnit, signedQuantity, whenText } from '../../stock-facts.ts';
import { durationsOf, releaseText } from './gantt-block-states.ts';
import type { ChainView } from './gantt-chain.ts';
import { useGanttView } from './gantt-context.ts';
import {
  brokenFirst,
  type DetailsException,
  exceptionOf,
  linkedJobOrdersOf,
  openSectionsOf,
  otherHoverFields,
} from './gantt-details.ts';
import { moveRefusalOf, refusalMessage, stepMessage } from './gantt-move.ts';
import {
  earlyText,
  type GanttRow,
  type JobOrderRow,
  jobOrderRowsOf,
  machinesText,
  type OperationRow,
  type OrderRow,
  quantityText,
  type RunRow,
  runLatenessText,
  runTitle,
  savedSetupOf,
  statusLabel,
  summarySpan,
} from './gantt-rows.ts';

export { phase1Reason, planReason };

/** A label and its value in the fields grid. */
function Field({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs">{children}</dd>
    </>
  );
}

/** A section of the panel: an h3 and its content. */
function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section aria-label={title} className="grid gap-1.5">
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/**
 * A section that starts closed (#917): a button named by its title and summary, with
 * aria-expanded, over the content; the content leaves the page while the section is closed. A
 * region names the content when it has no region of its own.
 */
function FoldSection({
  title,
  summary,
  defaultOpen = false,
  region,
  children,
}: {
  readonly title: string;
  readonly summary: string;
  readonly defaultOpen?: boolean;
  readonly region?: string;
  readonly children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="grid gap-1.5">
      <h3 className="text-xs font-semibold">
        <CollapsibleTrigger
          data-section-toggle
          aria-label={`${title}, ${summary}`}
          className="group/fold flex min-h-(--nm-target-min) w-full items-center gap-1.5 rounded-md text-start outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/fold:rotate-90 motion-reduce:transition-none"
          />
          <span>
            {title}
            <span className="font-normal text-muted-foreground">, {summary}</span>
          </span>
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent className="ps-5">
        {region === undefined ? (
          children
        ) : (
          <section aria-label={region} className="grid gap-1.5">
            {children}
          </section>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** The constraint list of a row (plan 18, The constraint list of a row), the broken lines first. */
function ConstraintList({ lines }: { readonly lines: readonly ConstraintLine[] }) {
  return (
    <ul className="grid gap-1 text-data">
      {brokenFirst(lines).map((line) => (
        <li
          key={`${line.kind}-${line.text}`}
          data-constraint={line.kind}
          data-holds={line.holds}
          className={cn('flex items-start gap-2', !line.holds && 'text-late-foreground')}
        >
          {line.holds ? (
            <CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success" />
          ) : (
            <span
              aria-hidden
              className="mt-0.5 size-3.5 shrink-0 rounded-full bg-late-foreground"
            />
          )}
          <span>
            {line.text}
            {!line.holds && line.code !== undefined && ` (${line.code})`}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** An action of the actions menu: one that runs, or one drawn disabled with the reason it waits. */
interface DetailsAction {
  readonly label: string;
  readonly onSelect?: () => void;
  /** A page the action opens, drawn as a link. */
  readonly href?: string;
  /** Why the action cannot run; it is drawn disabled and described by the reason. */
  readonly reason?: string;
}

/**
 * The actions menu in the heading (design D3, IN7; #917): the actions that run, and the ones that
 * wait drawn disabled, each described by its reason, which the menu shows under them once.
 */
function ActionsMenu({
  name,
  actions,
}: {
  readonly name: string;
  readonly actions: readonly DetailsAction[];
}) {
  const reasonId = useId();
  const reasons = [
    ...new Set(actions.flatMap((action) => (action.reason === undefined ? [] : [action.reason]))),
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={name} className="shrink-0" />}
      >
        <Ellipsis aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label={name} align="end" className="w-64">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            disabled={action.reason !== undefined}
            {...(action.href !== undefined && { render: <Link to={action.href} /> })}
            aria-describedby={
              action.reason === undefined
                ? undefined
                : `${reasonId}-${reasons.indexOf(action.reason)}`
            }
            onClick={() => {
              if (action.reason === undefined) action.onSelect?.();
            }}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
        {reasons.map((reason, index) => (
          <p
            key={reason}
            id={`${reasonId}-${index}`}
            className="px-1.5 py-1 text-xs text-muted-foreground"
          >
            {reason}
          </p>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The header exception line, styled by its kind: a conflict or lateness, a warning (a material
 * shortage, an early order), or a note (held, locked). Its text starts with a capital.
 */
function ExceptionLine({ exception }: { readonly exception: DetailsException }) {
  const { kind, text } = exception;
  return (
    <p
      data-exception={kind}
      className={cn(
        'rounded-md border px-2 py-1 text-data',
        kind === 'constraint' || kind === 'late'
          ? 'border-late-foreground bg-late text-late-foreground'
          : kind === 'material' || kind === 'early'
            ? 'border-warning bg-warning-subtle text-warning-foreground'
            : 'border-border text-foreground',
      )}
    >
      {text.charAt(0).toUpperCase() + text.slice(1)}
    </p>
  );
}

/**
 * The header every Details drawer shares (#917): the title with the order link and the actions
 * menu, the subline with the status, and at most one exception line.
 */
function DetailsHeader({
  title,
  orderId,
  orderNumber,
  subline,
  badge,
  exception,
  menu,
}: {
  readonly title: string;
  readonly orderId?: string;
  readonly orderNumber?: string;
  readonly subline: string;
  readonly badge?: ReactNode;
  readonly exception?: DetailsException | undefined;
  readonly menu: ReactNode;
}) {
  const { plant } = useShell();
  return (
    <SheetHeader className="gap-1.5 p-0 pe-9">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
          <SheetTitle className="font-mono text-base font-semibold">{title}</SheetTitle>
          {orderId !== undefined && orderNumber !== undefined && (
            <Link
              to={planningLinks.orders.order({ plant, orderId }).href}
              className="inline-flex min-h-(--nm-target-min) items-center text-data text-link underline-offset-2 hover:underline"
            >
              Order {orderNumber}
            </Link>
          )}
        </div>
        {menu}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <SheetDescription className="text-data">{subline}</SheetDescription>
        {badge}
      </div>
      {exception !== undefined && <ExceptionLine exception={exception} />}
    </SheetHeader>
  );
}

/** Open order as a menu action: a link to the order's page, as the job order table's menu has. */
function useOpenOrder(orderId: string): DetailsAction {
  const { plant } = useShell();
  return { label: 'Open order', href: planningLinks.orders.order({ plant, orderId }).href };
}

/**
 * Moving without dragging (plan 07, Moving without dragging; WCAG 2.5.7): Move in the actions menu
 * starts a move of the row as keyboard move mode does, and these controls step the start and the
 * machine, Apply writes the draft and Cancel ends it; the status line carries the step message.
 */
function MoveControls({
  row,
  onApplied,
}: {
  readonly row: JobOrderRow;
  readonly onApplied: (jobOrderId: string) => void;
}) {
  const { timeZone, machineName, move } = useGanttView();
  const moving = useMoveOf(move?.store, (each) => each?.state.jobOrderId === row.id);
  const preview = useMoveOf(move?.store, (each) =>
    each?.state.jobOrderId === row.id ? each.preview : undefined,
  );
  if (move === undefined || !moving) return null;
  const status =
    preview === undefined
      ? 'Computing the move.'
      : stepMessage(preview, machineName(preview.equipment), timeZone);
  return (
    <fieldset
      aria-label={`Move ${row.jobOrder.displayNumber}`}
      className="grid basis-full gap-1.5 rounded-md border border-border p-2"
    >
      {/* Keyboard move mode speaks each step through announce(); this line only shows it. */}
      <p className="text-data">{status}</p>
      <div className="flex flex-wrap gap-1.5">
        <Button variant="outline" className="h-7 px-2.5 text-xs" onClick={() => move.stepTime(-1)}>
          Earlier
        </Button>
        <Button variant="outline" className="h-7 px-2.5 text-xs" onClick={() => move.stepTime(1)}>
          Later
        </Button>
        <Button
          variant="outline"
          className="h-7 px-2.5 text-xs"
          onClick={() => move.stepMachine(-1)}
        >
          Previous machine
        </Button>
        <Button
          variant="outline"
          className="h-7 px-2.5 text-xs"
          onClick={() => move.stepMachine(1)}
        >
          Next machine
        </Button>
        <Button
          className="h-7 px-2.5 text-xs"
          onClick={() => {
            move.commit();
            onApplied(row.id);
          }}
        >
          Apply
        </Button>
        <Button variant="ghost" className="h-7 px-2.5 text-xs" onClick={() => move.cancel()}>
          Cancel
        </Button>
      </div>
    </fieldset>
  );
}

/** A movement before a shortage, in words: "1003.10 consumes 36 m on Wed 4 Nov 08:00". */
function movementText(movement: PlannedMovement, unit: string, timeZone: string): string {
  const when = whenText(movement.atMs, movement.dateOnly, timeZone);
  return movement.kind === 'consumption'
    ? `${movement.reference} consumes ${quantityWithUnit(-movement.quantity, unit)} on ${when}`
    : `${movement.reference}, ${signedQuantity(movement.quantity, unit)}, on ${when}`;
}

/**
 * The Material section of a job order short of material (plan 07; design #729, MW3): the article,
 * what the job order needs, the projected balance before it, the shortfall and the warehouse, the
 * movement that causes it and the one before, the next incoming movement and those not counted,
 * and Show stock.
 */
function MaterialSection({
  row,
  shortage,
  inventory,
}: {
  readonly row: JobOrderRow;
  readonly shortage: MaterialShortage;
  readonly inventory: InventorySnapshot;
}) {
  const { plant } = useShell();
  const { material, movement } = shortage;
  const unit = material.unit;
  const timeZone = inventory.plant.timeZone;
  const plantName = inventory.plant.name;
  const perPiece =
    row.operation.quantity === 0
      ? undefined
      : roundQuantity(shortage.need / row.operation.quantity);
  const when = whenText(movement.atMs, movement.dateOnly, timeZone);
  // Where the consumption is dated (plan 07): the setup start, now for one already past, or the
  // order deadline for an operation not placed.
  const whenPhrase =
    movement.dateFrom === 'Now, overdue'
      ? `now, ${when}: its setup start has passed`
      : movement.dateFrom === 'Order deadline'
        ? `at the order deadline, ${when}: the operation is not placed`
        : `at the setup start, ${when}`;
  // An operation split into several job orders consumes as one, at the first setup start.
  const consumer =
    row.order.jobOrders.filter((each) => each.operationId === row.operation.id).length > 1
      ? `operation ${row.operation.displayNumber}'s`
      : "this job order's";
  const uncounted = inventory.movements.filter(
    (each) => each.article === material.number && !each.counted,
  );
  return (
    <section
      aria-label={`Material: ${material.name}`}
      className="grid gap-1.5 rounded-md border border-warning bg-warning-subtle p-2.5 text-[0.8125rem] leading-[1.125rem]"
    >
      <p>
        <b className="font-semibold">{material.name}</b>{' '}
        <span className="font-mono">{material.number}</span>
        {` is ${quantityWithUnit(shortage.shortfall, unit)} short ${whenPhrase}.`}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt>Needs</dt>
        <dd className="font-mono">
          {quantityWithUnit(shortage.need, unit)}
          {perPiece !== undefined && ` (${amountText(perPiece)} ${unit} per piece)`}
        </dd>
        <dt>Projected then</dt>
        <dd className="font-mono">
          {quantityWithUnit(shortage.before, unit)} in {plantName}
        </dd>
        <dt>Shortfall</dt>
        <dd className="font-mono">{quantityWithUnit(shortage.shortfall, unit)}</dd>
        <dt>From</dt>
        <dd>
          <span className="font-mono">{shortage.warehouse.code}</span> {shortage.warehouse.name}
        </dd>
      </dl>
      <p>
        {`Caused by ${consumer} consumption of ${quantityWithUnit(shortage.need, unit)}, which takes ${plantName}'s projected balance from ${quantityWithUnit(shortage.before, unit)} to ${quantityWithUnit(shortage.after, unit)}.`}
        {shortage.previous !== undefined &&
          ` Before it, ${movementText(shortage.previous, unit, timeZone)}.`}
      </p>
      <p>
        {shortage.nextIncoming === undefined
          ? 'No incoming movement is planned before the end of the projection.'
          : `Next incoming: ${shortage.nextIncoming.reference}, ${signedQuantity(shortage.nextIncoming.quantity, unit)}, ${whenText(shortage.nextIncoming.atMs, shortage.nextIncoming.dateOnly, timeZone)}.`}
        {uncounted.map(
          (each) =>
            ` ${each.reference}, ${signedQuantity(each.quantity, unit)} on ${whenText(each.atMs, each.dateOnly, timeZone)}, is not counted (${plantName} setting).`,
        )}
      </p>
      <p className="text-xs">
        {`Stock from the ERP as of ${formatPlantDateTime(inventory.stockAsOfMs, timeZone)}. A move in your draft recomputes the warning before Save.`}
      </p>
      <Link
        to={planningLinks.stock.article({ plant, articleId: material.number }).href}
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'h-7.5 justify-self-start px-2.5 text-[0.8125rem]',
        )}
      >
        Show stock of {material.name}
      </Link>
    </section>
  );
}

function JobOrderDetails({
  row,
  chain,
  onToggleChain,
  onMoveApplied,
}: {
  readonly row: JobOrderRow;
  readonly chain: ChainView | undefined;
  readonly onToggleChain: () => void;
  readonly onMoveApplied: (jobOrderId: string) => void;
}) {
  const { snapshot, timeZone, machineName, boardFields, materialShortages, inventory, move } =
    useGanttView();
  const { jobOrder, operation, order, analysis } = row;
  const shortages =
    inventory === undefined ? [] : (materialShortages?.get(operation.displayNumber) ?? []);
  const exception = exceptionOf(row, shortages, snapshot.analysis.orders[order.id]);
  const opens = openSectionsOf(exception);
  const durations = durationsOf(row, snapshot);
  const float = analysis?.float;
  const release = releaseText(row, timeZone, snapshot.settings.retoolOverlapsLeadTime);
  const customer = shownFields(['customer'], row, snapshot, machineName)[0];
  const freeFloat = shownFields(['freeFloat'], row, snapshot, machineName)[0];
  // Every hover field shows in Details too (plan 07, Board accessibility; #762): those with no
  // place above join At a glance, in the plant's order.
  const others = otherHoverFields(boardFields.hover, row, snapshot, machineName);
  const linked = linkedJobOrdersOf(row, machineName, timeZone);
  const saved = savedSetupOf(snapshot, jobOrder.id);
  const setupAndRun = shownFields(['setupAndRun'], row, snapshot, machineName)[0]?.value ?? '';
  const refused = moveRefusalOf(snapshot, row.id);
  const moving = useMoveOf(move?.store, (each) => each?.state.jobOrderId === row.id);
  const placed = jobOrder.placement !== undefined && jobOrder.equipment !== undefined;
  // Why Move cannot start: a move of the row already runs, the row has no place, or the plan
  // refuses it (locked, started, held).
  const moveReason = moving
    ? `${jobOrder.displayNumber} is moving: use the controls in Details.`
    : !placed
      ? `Cannot move ${jobOrder.displayNumber}: not placed.`
      : refused === undefined
        ? undefined
        : refusalMessage(jobOrder.displayNumber, refused);
  const openOrder = useOpenOrder(order.id);
  const predecessorSendAhead =
    order.operations.find((each) => each.displayNumber === analysis?.release?.fromRow)
      ?.sendAheadQuantity ?? 0;
  const holding = analysis?.constraints.filter((line) => line.holds).length ?? 0;
  const actions: DetailsAction[] = [
    ...(move === undefined
      ? []
      : [
          {
            label: 'Move',
            onSelect: () => move.begin(row.id, 'keyboard'),
            ...(moveReason !== undefined && { reason: moveReason }),
          },
        ]),
    openOrder,
    {
      label:
        chain !== undefined && chain.order.id === order.id ? 'Hide chain' : 'Show critical chain',
      onSelect: onToggleChain,
    },
    { label: 'Lock', reason: phase1Reason },
    { label: 'Split', reason: phase1Reason },
  ];
  return (
    <>
      <DetailsHeader
        title={`${operation.displayNumber} ${operation.name}`}
        orderId={order.id}
        orderNumber={order.number}
        subline={`${order.article}, ${quantityText(jobOrder.quantity)}`}
        badge={<Badge variant="outline">{statusLabel(jobOrder.status)}</Badge>}
        exception={exception}
        menu={<ActionsMenu name={`Actions for ${jobOrder.displayNumber}`} actions={actions} />}
      />
      <MoveControls row={row} onApplied={onMoveApplied} />
      <section aria-label="At a glance">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.8125rem]">
          <dt className="text-muted-foreground">
            <label htmlFor="gantt-detail-machine">Machine</label>
          </dt>
          <dd>
            <select
              id="gantt-detail-machine"
              disabled
              aria-describedby="gantt-detail-reason"
              value={jobOrder.equipment ?? ''}
              onChange={() => {}}
              className="h-7 w-full rounded-md border border-input bg-background px-1.5 font-mono text-xs"
            >
              {jobOrder.equipment === undefined && <option value="">Not placed</option>}
              {operation.allowedEquipment.map((code) => (
                <option key={code} value={code}>
                  {machineName(code)}
                </option>
              ))}
            </select>
          </dd>
          <Field label="Time">
            {jobOrder.placement === undefined ? (
              'Not placed'
            ) : (
              <>
                {formatPlantDateTime(jobOrder.placement.setupStartMs, timeZone)} to{' '}
                {formatPlantDateTime(jobOrder.placement.endMs, timeZone)}
                {durations !== undefined && (
                  <span className="block text-muted-foreground">
                    <span>{durations.working}</span>, <span>{durations.elapsed}</span>
                  </span>
                )}
              </>
            )}
          </Field>
          <Field label="Deadline">
            {formatPlantDateTime(order.deadlineMs, timeZone)}
            {freeFloat !== undefined && `, free float ${freeFloat.value}`}
          </Field>
          {customer !== undefined && <Field label="Customer">{customer.value}</Field>}
          {others.map((field) => (
            <Field key={field.id} label={field.label}>
              {field.value}
            </Field>
          ))}
          {linked.map((each) => (
            <Field key={each.label} label={each.label}>
              {each.text}
            </Field>
          ))}
        </dl>
      </section>
      <p id="gantt-detail-reason" className="sr-only">
        {phase1Reason}
      </p>
      <div className="grid gap-1">
        {analysis !== undefined && (
          <FoldSection
            title="Constraints"
            summary={`${holding} of ${analysis.constraints.length} hold`}
            region={`Constraints, ${holding} of ${analysis.constraints.length} hold`}
            defaultOpen={opens.constraints}
          >
            <ConstraintList lines={analysis.constraints} />
          </FoldSection>
        )}
        <FoldSection
          title="Float and timing"
          summary={
            float === undefined
              ? 'float unknown'
              : `total float ${formatDuration(float.totalFloatWorkingS)}`
          }
          region="Float and timing"
        >
          <ul className="grid gap-1 text-data">
            {float === undefined ? (
              <li>Float unknown.</li>
            ) : (
              <>
                <li>{`Wait ${float.waitWorkingS === 0 ? '0 min' : formatDuration(float.waitWorkingS)}.`}</li>
                <li>
                  {`${bindingSentence(
                    float,
                    analysis?.release,
                    operation.leadTimeS,
                    predecessorSendAhead,
                    {
                      timeZone,
                      machineName,
                      calendarName: snapshot.calendar.name,
                    },
                  )}.`}
                </li>
                <li>
                  {`Earliest start ${formatPlantDateTime(float.earliestStartMs, timeZone)}. Latest start ${formatPlantDateTime(float.latestStartMs, timeZone)}, latest end ${formatPlantDateTime(float.latestEndMs, timeZone)}.`}
                </li>
              </>
            )}
            {release !== undefined && (
              <li>{release.charAt(0).toUpperCase() + release.slice(1)}.</li>
            )}
          </ul>
        </FoldSection>
        {inventory !== undefined && shortages.length > 0 && (
          <FoldSection
            title="Material"
            summary={`${shortages.length} short`}
            defaultOpen={opens.material}
          >
            <div className="grid gap-1.5">
              {shortages.map((shortage) => (
                <MaterialSection
                  key={shortage.material.number}
                  row={row}
                  shortage={shortage}
                  inventory={inventory}
                />
              ))}
            </div>
          </FoldSection>
        )}
        <FoldSection title="Setup and run" summary={setupAndRun} region="Setup and run">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.8125rem]">
            <Field label="Setup">{formatDuration(jobOrder.plannedSetupS)}</Field>
            <Field label="Run">{formatDuration(jobOrder.plannedRunS)}</Field>
            {jobOrder.placement !== undefined && (
              <Field label="Run start">
                {formatPlantDateTime(jobOrder.placement.runStartMs, timeZone)}
              </Field>
            )}
          </dl>
          {saved !== undefined && (
            <p className="text-data">
              {`${saved.displayNumber} follows ${saved.afterDisplayNumber} on ${machineName(saved.equipment)}, so the run saves ${formatDuration(saved.setupS)} of retool.`}
            </p>
          )}
        </FoldSection>
      </div>
    </>
  );
}

/** The cause of a late order: the root of its critical chain, with its machine. */
function lateCause(
  snapshot: GanttSnapshot,
  orderId: string,
  machineName: (code: string | undefined) => string,
): string {
  const chain = snapshot.analysis.orders[orderId]?.chain;
  // A chain cut at its row limit has not reached its start, so it names none.
  const root =
    chain === undefined || chain.continues
      ? undefined
      : (chain.rows.find((each) => each.root) ?? chain.rows[chain.rows.length - 1]);
  const rootRow =
    root === undefined
      ? undefined
      : snapshot.productionOrders
          .flatMap((each) => each.jobOrders)
          .find((each) => each.id === root.jobOrderId);
  const pointer = 'Show critical chain names the rows that bind it.';
  return root === undefined
    ? pointer
    : `The critical chain starts at ${root.row} on ${machineName(rootRow?.equipment)}. ${pointer}`;
}

function OrderDetails({
  row,
  chain,
  onToggleChain,
  onFocusRow,
}: {
  readonly row: OrderRow;
  readonly chain: ChainView | undefined;
  readonly onToggleChain: () => void;
  readonly onFocusRow: (jobOrderId: string) => void;
}) {
  const { snapshot, timeZone, machineName, runActions } = useGanttView();
  const { order, analysis } = row;
  const span = summarySpan(jobOrderRowsOf(row));
  const shown = chain !== undefined && chain.order.id === order.id;
  const combine = runActions?.canCombine(order.id);
  const openOrder = useOpenOrder(order.id);
  const operations = order.operations
    .map((operation) => {
      const machine = order.jobOrders.find(
        (jobOrder) => jobOrder.operationId === operation.id,
      )?.equipment;
      return `${operation.name} on ${machineName(machine)}`;
    })
    .join(', ');
  const exception: DetailsException | undefined = analysis?.late
    ? { kind: 'late', text: `Late by ${formatDuration(-analysis.slackElapsedS)} elapsed` }
    : row.early === undefined
      ? undefined
      : { kind: 'early', text: earlyText(row.early) };
  const actions: DetailsAction[] = [
    ...(runActions !== undefined && combine !== undefined
      ? [
          {
            label: 'Combine into a run',
            onSelect: () => runActions.combine(order.id),
            ...(!combine.ok && { reason: combine.reason }),
          },
        ]
      : []),
    { label: shown ? 'Hide chain' : 'Show critical chain', onSelect: onToggleChain },
    openOrder,
    { label: 'Plan this order', reason: planReason },
    { label: 'Move all later by', reason: planReason },
    { label: 'Zoom to order', reason: planReason },
  ];
  return (
    <>
      <DetailsHeader
        title={`Order ${order.number}`}
        subline={`${order.article}, ${quantityText(order.quantity)}${order.priority === null ? '' : `, priority ${order.priority}`}`}
        badge={<Badge variant="outline">{statusLabel(order.status)}</Badge>}
        exception={exception}
        menu={<ActionsMenu name={`Actions for order ${order.number}`} actions={actions} />}
      />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.8125rem]">
        <Field label="Deadline">
          {formatPlantDateTime(order.deadlineMs, timeZone)},{' '}
          {snapshot.settings.deadlineRule === 'endOfShift' ? 'end of shift' : 'start of day'}
        </Field>
        {span !== undefined && (
          <>
            <Field label="Planned start">{formatPlantDateTime(span.fromMs, timeZone)}</Field>
            <Field label="Planned end">{formatPlantDateTime(span.toMs, timeZone)}</Field>
          </>
        )}
        {analysis !== undefined &&
          (analysis.late ? (
            analysis.lateByWorking !== undefined && (
              <Field label="Late by, working">
                {formatDuration(analysis.lateByWorking.seconds)} on{' '}
                {machineName(analysis.lateByWorking.equipment)}
              </Field>
            )
          ) : (
            <Field label="Slack">{formatDuration(analysis.slackElapsedS)}</Field>
          ))}
        <Field label="Operations">
          {order.operations.length}: {operations}
        </Field>
      </dl>
      {shown ? (
        <Section title={chain.title}>
          <ul className="grid gap-1 text-[0.8125rem] leading-[1.125rem]" data-chain-explanation>
            {chain.sentences.map((sentence) => (
              <li
                key={`${sentence.row ?? ''}${sentence.text}`}
                className={cn(sentence.lead && 'font-semibold')}
              >
                {sentence.row !== undefined && sentence.jobOrderId !== undefined && (
                  <>
                    <button
                      type="button"
                      className="font-mono text-xs text-link underline-offset-2 hover:underline"
                      onClick={() => onFocusRow(sentence.jobOrderId as string)}
                    >
                      {sentence.row}
                    </button>{' '}
                  </>
                )}
                {sentence.text}
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        analysis?.late && (
          <Section title="Why late">
            <p className="text-data">{lateCause(snapshot, order.id, machineName)}</p>
          </Section>
        )
      )}
    </>
  );
}

/** The Details of a run row (plan 18, Runs): its orders, deadline, span, saved setups and Split run. */
function RunDetails({ row }: { readonly row: RunRow }) {
  const { snapshot, timeZone, machineName, runActions } = useGanttView();
  const { run, analysis } = row;
  const quantity = row.orders.reduce((sum, order) => sum + order.quantity, 0);
  const actions: DetailsAction[] = [
    ...(runActions === undefined
      ? []
      : [{ label: 'Split run', onSelect: () => runActions.split(run.id) }]),
    { label: 'Zoom to run', reason: planReason },
  ];
  return (
    <>
      <DetailsHeader
        title={runTitle(run)}
        subline={`${quantityText(quantity)}, orders ${orderNumbersText(run.orderNumbers)}`}
        badge={
          <Badge variant="outline">
            <Layers aria-hidden />
            Run
          </Badge>
        }
        exception={analysis.late ? { kind: 'late', text: runLatenessText(analysis) } : undefined}
        menu={<ActionsMenu name={`Actions for ${runTitle(run)}`} actions={actions} />}
      />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.8125rem]">
        <Field label="Deadline">
          {formatPlantDateTime(run.deadlineMs, timeZone)},{' '}
          {snapshot.settings.deadlineRule === 'endOfShift' ? 'end of shift' : 'start of day'}
        </Field>
        {analysis.plannedStartMs !== undefined && analysis.plannedEndMs !== undefined && (
          <>
            <Field label="Planned start">
              {formatPlantDateTime(analysis.plannedStartMs, timeZone)}
            </Field>
            <Field label="Planned end">
              {formatPlantDateTime(analysis.plannedEndMs, timeZone)}
            </Field>
          </>
        )}
      </dl>
      <Section title="Orders">
        <ul className="grid gap-1 text-[0.8125rem] leading-[1.125rem]">
          {row.subRows.map((order) => (
            <li key={order.id}>
              {`${order.order.number}, ${quantityText(order.order.quantity)}, due ${formatPlantDateTime(order.order.deadlineMs, timeZone)}`}
              {order.early !== undefined && `, ${earlyText(order.early)}`}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Saved retools">
        {run.savedSetups.length === 0 ? (
          <p className="text-[0.8125rem] text-muted-foreground">No retool saved.</p>
        ) : (
          <ul className="grid gap-1 text-[0.8125rem] leading-[1.125rem]">
            {run.savedSetups.map((saved) => (
              <li key={saved.jobOrderId}>
                {`${saved.displayNumber} follows ${saved.afterDisplayNumber} on ${machineName(saved.equipment)}, saves ${formatDuration(saved.setupS)} of retool`}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function OperationDetails({ row }: { readonly row: OperationRow }) {
  const { machineName } = useGanttView();
  const { operation, order } = row;
  const openOrder = useOpenOrder(order.id);
  return (
    <>
      <DetailsHeader
        title={`${operation.displayNumber} ${operation.name}`}
        orderId={order.id}
        orderNumber={order.number}
        subline={`${order.article}, ${quantityText(operation.quantity)}`}
        menu={
          <ActionsMenu
            name={`Actions for ${operation.displayNumber}`}
            actions={[openOrder, { label: 'Lock', reason: phase1Reason }]}
          />
        }
      />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.8125rem]">
        <Field label="Machines">{machinesText(operation, machineName)}</Field>
        <Field label="Lead time">{formatDuration(operation.leadTimeS)}</Field>
        <Field label="Send ahead">
          {operation.sendAheadQuantity === 0 ? 'none' : quantityText(operation.sendAheadQuantity)}
        </Field>
        <Field label="Hard lock">{operation.isLocked ? 'yes' : 'no'}</Field>
        {row.notPlaced > 0 && <Field label="Not placed">{row.notPlaced}</Field>}
      </dl>
    </>
  );
}

export interface GanttDetailDrawerProps {
  /** The row the drawer shows; none keeps it closed. */
  readonly row: GanttRow | undefined;
  readonly chain: ChainView | undefined;
  /** Runs when the close button or Escape closes the drawer. */
  readonly onClose: () => void;
  readonly onToggleChain: (orderId: string) => void;
  /** Runs when a chain row's link is followed: the drawer closes and that row takes focus. */
  readonly onFocusRow: (jobOrderId: string) => void;
  /** Runs when a move applied from the drawer: the drawer closes and the block takes focus. */
  readonly onMoveApplied: (jobOrderId: string) => void;
  /** The element that takes focus once the drawer has closed: the row it opened from. */
  readonly finalFocus: () => HTMLElement | null;
}

/**
 * The Details drawer (plan 18, Details; Krister, 2026-10-17): a Sheet from the right that opens
 * from a row or a block, on the Gantt and on the board. Each kind of row has the same header with
 * its actions menu (#917); a job order leads with At a glance and folds its Constraints, Float and
 * timing, Material and Setup and run sections, and an order shows its critical chain explanation
 * with a link per row. Its close button and Escape close it, and focus returns to the row. In
 * phase 1 the machine select and the actions that wait for the plan server are disabled and
 * described by the reason.
 */
export function GanttDetailDrawer({
  row,
  chain,
  onClose,
  onToggleChain,
  onFocusRow,
  onMoveApplied,
  finalFocus,
}: GanttDetailDrawerProps) {
  return (
    <Sheet
      open={row !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        data-details-drawer
        finalFocus={() => finalFocus() ?? undefined}
        className="w-80 gap-3 overflow-y-auto p-4 text-sm sm:max-w-sm"
      >
        <div className="grid content-start gap-3" data-detail-panel>
          {row?.kind === 'jobOrder' && (
            <JobOrderDetails
              key={row.id}
              row={row}
              chain={chain}
              onToggleChain={() => onToggleChain(row.order.id)}
              onMoveApplied={onMoveApplied}
            />
          )}
          {row?.kind === 'order' && (
            <OrderDetails
              row={row}
              chain={chain}
              onToggleChain={() => onToggleChain(row.order.id)}
              onFocusRow={onFocusRow}
            />
          )}
          {row?.kind === 'operation' && <OperationDetails row={row} />}
          {row?.kind === 'run' && <RunDetails row={row} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
