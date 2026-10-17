// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDateTime } from '@northmes/contracts/format';
import { cn } from 'cn';
import { CircleCheck, Clock, Link2, Lock, PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from '../../../../ui/components/icon-button/index.ts';
import { Badge } from '../../../../ui/primitives/badge.tsx';
import { Button } from '../../../../ui/primitives/button.tsx';
import type { ConstraintLine } from '../../gantt-data.ts';
import { durationsOf, releaseText } from './gantt-block-states.ts';
import type { ChainView } from './gantt-chain.ts';
import { useGanttView } from './gantt-context.ts';
import {
  type GanttRow,
  type JobOrderRow,
  jobOrderRowsOf,
  machinesText,
  type OperationRow,
  type OrderRow,
  quantityText,
  statusLabel,
  summarySpan,
} from './gantt-rows.ts';

/** Why the fields and the actions of phase 1 are drawn but disabled (plan 18, phase 1). */
export const phase1Reason =
  'Moves and changes come with the live data; this view reads the fixture G1.';

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

/** The disabled actions of phase 1 with the one reason under them. */
function Actions({
  actions,
  children,
}: {
  readonly actions: readonly string[];
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
      <p className="text-xs text-muted-foreground">{phase1Reason}</p>
    </Section>
  );
}

function JobOrderDetails({
  row,
  chain,
  onToggleChain,
}: {
  readonly row: JobOrderRow;
  readonly chain: ChainView | undefined;
  readonly onToggleChain: () => void;
}) {
  const { snapshot, timeZone, machineName, chainRowIds } = useGanttView();
  const { jobOrder, operation, order, analysis } = row;
  const durations = durationsOf(row, snapshot);
  const float = analysis?.float;
  const release = releaseText(row, timeZone, snapshot.settings.retoolOverlapsLeadTime);
  const onChain = chainRowIds.has(row.id);
  const floatLines =
    float === undefined
      ? ['Float unknown.']
      : [
          `Wait ${float.waitWorkingS === 0 ? '0 min' : formatDuration(float.waitWorkingS)}. Free float ${float.freeFloatWorkingS === 0 ? '0' : formatDuration(float.freeFloatWorkingS)}. Total float ${formatDuration(float.totalFloatWorkingS)}.`,
          float.binding.detail !== undefined
            ? `${float.binding.detail.charAt(0).toUpperCase()}${float.binding.detail.slice(1)}.`
            : `Binding constraint: ${float.binding.kind}.`,
          `Earliest start ${formatPlantDateTime(float.earliestStartMs, timeZone)}. Latest start ${formatPlantDateTime(float.latestStartMs, timeZone)}, latest end ${formatPlantDateTime(float.latestEndMs, timeZone)}.`,
        ];
  return (
    <>
      <h2 className="font-mono text-base font-semibold">
        {operation.displayNumber} {operation.name}
      </h2>
      <p className="text-[0.8125rem] text-muted-foreground">
        {order.article}, {quantityText(jobOrder.quantity)}, order {order.number}, deadline{' '}
        {formatPlantDateTime(order.deadlineMs, timeZone)}
      </p>
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
      {analysis !== undefined && <ConstraintList lines={analysis.constraints} />}
      <Section title="Float">
        <ul className="grid gap-1 text-[0.8125rem] leading-[1.125rem]">
          {floatLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {release !== undefined && <li>{release.charAt(0).toUpperCase() + release.slice(1)}.</li>}
        </ul>
      </Section>
      <Actions actions={['Move', 'Lock', 'Split', 'Open order']}>
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
  const { snapshot, timeZone, machineName } = useGanttView();
  const { order, analysis } = row;
  const span = summarySpan(jobOrderRowsOf(row));
  const shown = chain !== undefined && chain.order.id === order.id;
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
      <h2 className="font-mono text-base font-semibold">Order {order.number}</h2>
      <p className="text-[0.8125rem] text-muted-foreground">
        {order.article}, {quantityText(order.quantity)}
        {order.priority !== null && `, priority ${order.priority}`}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{statusLabel(order.status)}</Badge>
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
      <Actions actions={['Plan this order', 'Move all later by', 'Zoom to order', 'Open order']}>
        <Button variant="outline" className="h-7.5 px-2.5 text-[0.8125rem]" onClick={onToggleChain}>
          {shown ? 'Hide chain' : 'Show critical chain'}
        </Button>
      </Actions>
    </>
  );
}

function OperationDetails({ row }: { readonly row: OperationRow }) {
  const { machineName } = useGanttView();
  const { operation, order } = row;
  return (
    <>
      <h2 className="font-mono text-base font-semibold">
        {operation.displayNumber} {operation.name}
      </h2>
      <p className="text-[0.8125rem] text-muted-foreground">
        {order.article}, {quantityText(operation.quantity)}, order {order.number}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.8125rem]">
        <Field label="Machines">{machinesText(operation, machineName)}</Field>
        <Field label="Lead time">{formatDuration(operation.leadTimeS)}</Field>
        <Field label="Send ahead">
          {operation.sendAheadQuantity === 0 ? 'none' : quantityText(operation.sendAheadQuantity)}
        </Field>
        <Field label="Hard lock">{operation.isLocked ? 'yes' : 'no'}</Field>
        {row.notPlaced > 0 && <Field label="Not placed">{row.notPlaced}</Field>}
      </dl>
      <Actions actions={['Lock', 'Open order']} />
    </>
  );
}

export interface GanttDetailPanelProps {
  /** The row the panel shows, none until a row is opened. */
  readonly row: GanttRow | undefined;
  readonly chain: ChainView | undefined;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onToggleChain: (orderId: string) => void;
  readonly onFocusRow: (jobOrderId: string) => void;
}

/**
 * The docked panel beside the grid (D3 option A, D5): Details of the opened row with the board's
 * fields, the Constraints and Float sections of plan 18 and, for an order, the critical chain
 * explanation with a link per row. Collapsed, it is the 48 px strip with Expand panel. In phase 1
 * the fields and the actions are drawn but disabled, with the reason under them.
 */
export function GanttDetailPanel({
  row,
  chain,
  open,
  onOpenChange,
  onToggleChain,
  onFocusRow,
}: GanttDetailPanelProps) {
  if (!open) {
    return (
      <div
        role="group"
        aria-label="Board panel, collapsed"
        className="flex w-12 shrink-0 flex-col items-center gap-1 rounded-lg border border-border bg-card py-2"
      >
        <IconButton
          label="Expand panel"
          variant="ghost"
          size="icon-sm"
          onClick={() => onOpenChange(true)}
        >
          <PanelRightOpen />
        </IconButton>
      </div>
    );
  }
  return (
    <aside
      aria-label="Board panel"
      className="flex w-80 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="flex items-center gap-1 border-b border-border bg-muted px-2 py-1.5">
        <span className="px-1 text-sm font-semibold">Details</span>
        <span className="grow" />
        <IconButton
          label="Collapse panel"
          variant="ghost"
          size="icon-sm"
          onClick={() => onOpenChange(false)}
        >
          <PanelRightClose />
        </IconButton>
      </div>
      <div className="grid content-start gap-3 overflow-y-auto p-3 text-sm" data-detail-panel>
        {row === undefined && (
          <p className="text-[0.8125rem] text-muted-foreground">Select a row to see its details.</p>
        )}
        {row?.kind === 'jobOrder' && (
          <JobOrderDetails
            row={row}
            chain={chain}
            onToggleChain={() => onToggleChain(row.order.id)}
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
      </div>
    </aside>
  );
}
