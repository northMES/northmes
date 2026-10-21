// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDateTime } from '@northmes/contracts/format';
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { CalendarClock, CircleCheck, Clock, Layers, Link2, Lock } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { Badge } from '../../../../ui/primitives/badge.tsx';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../../../ui/primitives/sheet.tsx';
import { shownFields } from '../../board-fields.ts';
import { useBoardFieldSettings } from '../../board-fields-store.ts';
import { bindingSentence } from '../../gantt-analysis.ts';
import type { ConstraintLine } from '../../gantt-data.ts';
import { orderNumbersText } from '../../gantt-draft.ts';
import { phase1Reason, planReason } from '../../mock-reasons.ts';
import { durationsOf, releaseText } from './gantt-block-states.ts';
import type { ChainView } from './gantt-chain.ts';
import { useGanttView } from './gantt-context.ts';
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

/** The constraint list of a row (plan 18, The constraint list of a row). */
function ConstraintList({ lines }: { readonly lines: readonly ConstraintLine[] }) {
  const holding = lines.filter((line) => line.holds).length;
  return (
    <Section title={`Constraints, ${holding} of ${lines.length} hold`}>
      <ul className="grid gap-1 text-[0.8125rem] leading-[1.125rem]">
        {lines.map((line) => (
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
    </Section>
  );
}

/** Open order: the link to the order's page, among a row's actions. */
function OpenOrder({ orderId }: { readonly orderId: string }) {
  const { plant } = useShell();
  return (
    <Link
      to={planningLinks.orders.order({ plant, orderId }).href}
      className={cn(buttonVariants({ variant: 'outline' }), 'h-7.5 px-2.5 text-[0.8125rem]')}
    >
      Open order
    </Link>
  );
}

/** The disabled actions with the one reason under them. */
function Actions({
  actions,
  reason = phase1Reason,
  children,
}: {
  readonly actions: readonly string[];
  readonly reason?: string;
  readonly children?: ReactNode;
}) {
  return (
    <Section title="Actions">
      <div className="flex flex-wrap gap-1.5">
        {children}
        {actions.map((label) => (
          <Button key={label} variant="outline" className="h-7.5 px-2.5 text-[0.8125rem]" disabled>
            {label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{reason}</p>
    </Section>
  );
}

/**
 * Moving without dragging (plan 07, Moving without dragging; WCAG 2.5.7): Move starts a move of
 * the row as keyboard move mode does, and the controls step the start and the machine, Apply
 * writes the draft and Cancel ends it; the status line carries the step message.
 */
function MoveControls({
  row,
  onApplied,
}: {
  readonly row: JobOrderRow;
  readonly onApplied: (jobOrderId: string) => void;
}) {
  const { snapshot, timeZone, machineName, move } = useGanttView();
  const reasonId = useId();
  const refused = moveRefusalOf(snapshot, row.id);
  const moving = move?.state?.jobOrderId === row.id;
  if (move === undefined) return null;
  if (!moving) {
    return (
      <>
        <Button
          variant="outline"
          className="h-7.5 px-2.5 text-[0.8125rem]"
          aria-disabled={refused !== undefined || undefined}
          aria-describedby={refused === undefined ? undefined : reasonId}
          onClick={() => {
            if (refused === undefined) move.begin(row.id, 'keyboard');
          }}
        >
          Move
        </Button>
        {refused !== undefined && (
          <p id={reasonId} className="basis-full text-xs text-muted-foreground">
            {refusalMessage(row.jobOrder.displayNumber, refused)}
          </p>
        )}
      </>
    );
  }
  const preview = move.preview;
  const status =
    preview === undefined
      ? 'Computing the move.'
      : stepMessage(preview, machineName(preview.equipment), timeZone);
  return (
    <fieldset
      aria-label={`Move ${row.jobOrder.displayNumber}`}
      className="grid basis-full gap-1.5 rounded-md border border-border p-2"
    >
      <p className="text-[0.8125rem]" aria-live="polite">
        {status}
      </p>
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
  const { snapshot, timeZone, machineName, chainRowIds, boardFields } = useGanttView();
  const company = useBoardFieldSettings().company;
  const { jobOrder, operation, order, analysis } = row;
  // Every hover field shows here too, in the plant's order (plan 07, Board accessibility; #762).
  const hoverFields = shownFields((boardFields ?? company).hover, row, snapshot, machineName);
  const durations = durationsOf(row, snapshot);
  const float = analysis?.float;
  const release = releaseText(row, timeZone, snapshot.settings.retoolOverlapsLeadTime);
  const onChain = chainRowIds.has(row.id);
  const predecessorSendAhead =
    order.operations.find((each) => each.displayNumber === analysis?.release?.fromRow)
      ?.sendAheadQuantity ?? 0;
  const floatLines =
    float === undefined
      ? ['Float unknown.']
      : [
          `Wait ${float.waitWorkingS === 0 ? '0 min' : formatDuration(float.waitWorkingS)}. Free float ${float.freeFloatWorkingS === 0 ? '0' : formatDuration(float.freeFloatWorkingS)}. Total float ${formatDuration(float.totalFloatWorkingS)}.`,
          `${bindingSentence(float, analysis?.release, operation.leadTimeS, predecessorSendAhead, {
            timeZone,
            machineName,
            calendarName: snapshot.calendar.name,
          })}.`,
          `Earliest start ${formatPlantDateTime(float.earliestStartMs, timeZone)}. Latest start ${formatPlantDateTime(float.latestStartMs, timeZone)}, latest end ${formatPlantDateTime(float.latestEndMs, timeZone)}.`,
        ];
  return (
    <>
      <SheetHeader className="p-0">
        <SheetTitle className="font-mono text-base font-semibold">
          {operation.displayNumber} {operation.name}
        </SheetTitle>
        <SheetDescription className="text-data">
          {order.article}, {quantityText(jobOrder.quantity)}, order {order.number}, deadline{' '}
          {formatPlantDateTime(order.deadlineMs, timeZone)}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{statusLabel(jobOrder.status)}</Badge>
        {operation.isLocked && (
          <Badge variant="outline">
            <Lock aria-hidden />
            Locked
          </Badge>
        )}
        {analysis?.release !== undefined && (
          <Badge variant="outline">Released from {analysis.release.fromRow}</Badge>
        )}
        {onChain && (
          <Badge variant="outline" className="border-late-foreground text-late-foreground">
            <Link2 aria-hidden />
            On the critical chain
          </Badge>
        )}
      </div>
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
            {operation.allowedEquipment.map((code) => (
              <option key={code} value={code}>
                {machineName(code)}
              </option>
            ))}
          </select>
        </dd>
        {jobOrder.placement !== undefined && (
          <>
            <Field label="Start">
              {formatPlantDateTime(jobOrder.placement.setupStartMs, timeZone)}
            </Field>
            <Field label="End">{formatPlantDateTime(jobOrder.placement.endMs, timeZone)}</Field>
          </>
        )}
        {durations !== undefined && (
          <>
            <Field label="Working time">{durations.working}</Field>
            <Field label="Elapsed time">{durations.elapsed}</Field>
          </>
        )}
        <Field label="Setup, run">
          {formatDuration(jobOrder.plannedSetupS)}, {formatDuration(jobOrder.plannedRunS)}
        </Field>
        <Field label="Quantity">{quantityText(jobOrder.quantity)}</Field>
      </dl>
      <p id="gantt-detail-reason" className="sr-only">
        {phase1Reason}
      </p>
      {hoverFields.length > 0 && (
        <Section title="Hover fields">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.8125rem]">
            {hoverFields.map((field) => (
              <Field key={field.id} label={field.label}>
                {field.value}
              </Field>
            ))}
          </dl>
        </Section>
      )}
      {analysis !== undefined && <ConstraintList lines={analysis.constraints} />}
      <Section title="Float">
        <ul className="grid gap-1 text-[0.8125rem] leading-[1.125rem]">
          {floatLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {release !== undefined && <li>{release.charAt(0).toUpperCase() + release.slice(1)}.</li>}
        </ul>
      </Section>
      <Actions actions={['Lock', 'Split']}>
        <MoveControls row={row} onApplied={onMoveApplied} />
        <OpenOrder orderId={order.id} />
        <Button variant="outline" className="h-7.5 px-2.5 text-[0.8125rem]" onClick={onToggleChain}>
          {chain !== undefined && chain.order.id === order.id
            ? 'Hide chain'
            : 'Show critical chain'}
        </Button>
      </Actions>
    </>
  );
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
  const combineReasonId = useId();
  const { order, analysis } = row;
  const span = summarySpan(jobOrderRowsOf(row));
  const shown = chain !== undefined && chain.order.id === order.id;
  const combine = runActions?.canCombine(order.id);
  const operations = order.operations
    .map((operation) => {
      const machine = order.jobOrders.find(
        (jobOrder) => jobOrder.operationId === operation.id,
      )?.equipment;
      return `${operation.name} on ${machineName(machine)}`;
    })
    .join(', ');
  return (
    <>
      <SheetHeader className="p-0">
        <SheetTitle className="font-mono text-base font-semibold">Order {order.number}</SheetTitle>
        <SheetDescription className="text-data">
          {order.article}, {quantityText(order.quantity)}
          {order.priority !== null && `, priority ${order.priority}`}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{statusLabel(order.status)}</Badge>
        {row.early !== undefined && (
          <Badge
            variant="outline"
            className="border-warning bg-warning-subtle text-warning-foreground"
          >
            <CalendarClock aria-hidden />
            {earlyText(row.early)}
          </Badge>
        )}
        {analysis?.late && (
          <Badge variant="outline" className="border-late-foreground bg-late text-late-foreground">
            <Clock aria-hidden />
            Late by {formatDuration(-analysis.slackElapsedS)}
          </Badge>
        )}
      </div>
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
            <>
              <Field label="Late by">{formatDuration(-analysis.slackElapsedS)} elapsed</Field>
              {analysis.lateByWorking !== undefined && (
                <Field label="Late by, working">
                  {formatDuration(analysis.lateByWorking.seconds)} on{' '}
                  {machineName(analysis.lateByWorking.equipment)}
                </Field>
              )}
            </>
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
        <Section title={analysis?.late ? 'Why late' : 'On time'}>
          <p className="text-[0.8125rem] leading-[1.125rem]">
            {analysis?.late
              ? `${order.number} ends ${span === undefined ? '' : formatPlantDateTime(span.toMs, timeZone)} against the deadline ${formatPlantDateTime(order.deadlineMs, timeZone)}. Show critical chain names the rows that bind it.`
              : `On time, slack ${formatDuration(analysis?.slackElapsedS ?? 0)}.`}
          </p>
        </Section>
      )}
      <Actions
        actions={['Plan this order', 'Move all later by', 'Zoom to order']}
        reason={planReason}
      >
        {runActions !== undefined && combine !== undefined && (
          <>
            <Button
              variant="outline"
              className="h-7.5 px-2.5 text-[0.8125rem]"
              aria-disabled={combine.ok ? undefined : true}
              aria-describedby={combine.ok ? undefined : combineReasonId}
              onClick={() => {
                if (combine.ok) runActions.combine(order.id);
              }}
            >
              Combine into a run
            </Button>
            {!combine.ok && (
              <p id={combineReasonId} className="basis-full text-xs text-muted-foreground">
                {combine.reason}
              </p>
            )}
          </>
        )}
        <Button variant="outline" className="h-7.5 px-2.5 text-[0.8125rem]" onClick={onToggleChain}>
          {shown ? 'Hide chain' : 'Show critical chain'}
        </Button>
        <OpenOrder orderId={order.id} />
      </Actions>
    </>
  );
}

/** The Details of a run row (plan 18, Runs): its orders, deadline, span, saved setups and Split run. */
function RunDetails({ row }: { readonly row: RunRow }) {
  const { snapshot, timeZone, machineName, runActions } = useGanttView();
  const { run, analysis } = row;
  const quantity = row.orders.reduce((sum, order) => sum + order.quantity, 0);
  return (
    <>
      <SheetHeader className="p-0">
        <SheetTitle className="font-mono text-base font-semibold">{runTitle(run)}</SheetTitle>
        <SheetDescription className="text-data">
          {quantityText(quantity)}, orders {orderNumbersText(run.orderNumbers)}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">
          <Layers aria-hidden />
          Run
        </Badge>
        {analysis.late && (
          <Badge variant="outline" className="border-late-foreground bg-late text-late-foreground">
            <Clock aria-hidden />
            {runLatenessText(analysis)}
          </Badge>
        )}
      </div>
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
        {analysis.late && <Field label="Late by">{formatDuration(analysis.lateByS)} elapsed</Field>}
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
      <Actions actions={['Zoom to run']} reason={planReason}>
        {runActions !== undefined && (
          <Button
            variant="outline"
            className="h-7.5 px-2.5 text-[0.8125rem]"
            onClick={() => runActions.split(run.id)}
          >
            Split run
          </Button>
        )}
      </Actions>
    </>
  );
}

function OperationDetails({ row }: { readonly row: OperationRow }) {
  const { machineName } = useGanttView();
  const { operation, order } = row;
  return (
    <>
      <SheetHeader className="p-0">
        <SheetTitle className="font-mono text-base font-semibold">
          {operation.displayNumber} {operation.name}
        </SheetTitle>
        <SheetDescription className="text-data">
          {order.article}, {quantityText(operation.quantity)}, order {order.number}
        </SheetDescription>
      </SheetHeader>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.8125rem]">
        <Field label="Machines">{machinesText(operation, machineName)}</Field>
        <Field label="Lead time">{formatDuration(operation.leadTimeS)}</Field>
        <Field label="Send ahead">
          {operation.sendAheadQuantity === 0 ? 'none' : quantityText(operation.sendAheadQuantity)}
        </Field>
        <Field label="Hard lock">{operation.isLocked ? 'yes' : 'no'}</Field>
        {row.notPlaced > 0 && <Field label="Not placed">{row.notPlaced}</Field>}
      </dl>
      <Actions actions={['Lock']}>
        <OpenOrder orderId={order.id} />
      </Actions>
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
 * The Details drawer (plan 18, phase 1 findings; Krister, 2026-10-17): a Sheet from the right
 * that opens from a row or a block with the board's fields, the Constraints and Float sections of
 * plan 18 and, for an order, the critical chain explanation with a link per row. Its close
 * button and Escape close it, and focus returns to the row. The grid keeps the full width. In
 * phase 1 the fields and the actions are drawn but disabled, with the reason under them.
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
