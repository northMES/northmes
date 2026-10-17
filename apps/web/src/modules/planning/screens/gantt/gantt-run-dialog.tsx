// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDateTime, formatSpan } from '@northmes/contracts/format';
import type { ReactNode } from 'react';
import { Button } from '../../../../ui/primitives/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/primitives/dialog.tsx';
import type { GanttOrder, RunResult } from '../../gantt-data.ts';
import { conflictWords, orderNumbersText } from '../../gantt-draft.ts';

export interface GanttRunDialogProps {
  readonly open: boolean;
  /** The run as the domain computed it for the selection; none while the dialog is closed. */
  readonly result: RunResult | undefined;
  readonly orders: readonly GanttOrder[];
  readonly timeZone: string;
  readonly machineName: (code: string | undefined) => string;
  readonly onCombine: () => void;
  readonly onCancel: () => void;
}

/** Why the orders cannot be combined, in the planner's words (ADR 0083). */
export function refusalText(result: RunResult): string | undefined {
  switch (result.refused) {
    case 'ONE_ORDER':
      return 'A run needs two or more orders.';
    case 'DIFFERENT_ARTICLES':
      return 'The selected orders are of different articles.';
    case 'UNPLACED':
      return `Order ${result.refusedBy ?? ''} has a job order that is not placed; place it first.`;
    case 'FIXED':
      return `${result.refusedBy ?? 'A row'} is started, locked or held by another planner; its order joins no run.`;
    default:
      return undefined;
  }
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section aria-label={title} className="grid gap-1">
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/**
 * The review step of a run (plan 18, The review step; frame PR1): the orders in the run's order,
 * the saved setups, the run's deadline with the early warnings, the run's span and whether it is
 * late, and every break the combine creates. Combine writes the run into the draft; Cancel writes
 * nothing. A refusal shows its reason and Cancel alone.
 */
export function GanttRunDialog({
  open,
  result,
  orders,
  timeZone,
  machineName,
  onCombine,
  onCancel,
}: GanttRunDialogProps) {
  const run = result?.run;
  const refusal = result === undefined ? undefined : refusalText(result);
  const at = (ms: number) => formatPlantDateTime(ms, timeZone);
  const orderOf = (id: string) => orders.find((order) => order.id === id);
  const dueOrders =
    run === undefined
      ? []
      : run.orderIds
          .map(orderOf)
          .filter((order) => order !== undefined && order.deadlineMs === run.deadlineMs)
          .map((order) => order?.number ?? '');
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent
        data-run-dialog
        className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Combine into a run</DialogTitle>
          <DialogDescription>
            {refusal ??
              (run === undefined
                ? 'Computing the run.'
                : `Run of ${run.article}: the orders below are planned together. Nothing is written until Combine.`)}
          </DialogDescription>
        </DialogHeader>
        {result !== undefined && run !== undefined && refusal === undefined && (
          <div className="grid gap-3 text-[0.8125rem] leading-[1.125rem]">
            <Section title="Orders">
              <ul aria-label="Orders" className="grid gap-0.5">
                {run.orderIds.map((id) => {
                  const order = orderOf(id);
                  if (order === undefined) return null;
                  return (
                    <li key={id} className="font-mono text-xs">
                      {`${order.number}, ${order.quantity} pcs, due ${at(order.deadlineMs)}, ${order.owner === 'northmes' ? 'NorthMES' : 'from the ERP'}`}
                    </li>
                  );
                })}
              </ul>
            </Section>
            <Section title="Saved setups">
              {run.savedSetups.length === 0 ? (
                <p className="text-muted-foreground">No setup to save.</p>
              ) : (
                <ul aria-label="Saved setups" className="grid gap-0.5">
                  {run.savedSetups.map((saved) => (
                    <li key={saved.jobOrderId} className="font-mono text-xs">
                      {`${saved.displayNumber} follows ${saved.afterDisplayNumber} on ${machineName(saved.equipment)}, saves ${formatDuration(saved.setupS)}`}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="Deadline">
              <p>{`The run is due ${at(run.deadlineMs)}, the deadline of ${orderNumbersText(dueOrders)}.`}</p>
              {run.early.map((early) => (
                <p key={early.orderId} data-early className="text-warning-foreground">
                  {`${early.number} is due ${at(early.deadlineMs)}; the run is due ${formatDuration(early.earlyByS)} earlier.`}
                </p>
              ))}
            </Section>
            <Section title="Span">
              <p>
                {result.startMs !== undefined && result.endMs !== undefined
                  ? `${formatSpan(result.startMs, result.endMs, timeZone)}, ${result.late ? `late by ${formatDuration(result.lateByS)}` : 'on time'}`
                  : 'Not placed.'}
              </p>
            </Section>
            <Section title="Breaks">
              {result.conflicts.length === 0 && result.stops.length === 0 ? (
                <p className="text-muted-foreground">No break.</p>
              ) : (
                <ul aria-label="Breaks" className="grid gap-0.5 text-late-foreground">
                  {result.conflicts.map((conflict) => (
                    <li key={`${conflict.kind}-${conflict.rows.join('-')}`}>
                      {`${conflictWords(timeZone, conflict)} (${conflict.kind})`}
                    </li>
                  ))}
                  {result.stops.map((stop) => (
                    <li
                      key={stop.jobOrderId}
                    >{`${stop.row} could not be placed: ${stop.reason}`}</li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {refusal === undefined && run !== undefined && (
            <Button onClick={onCombine}>Combine</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
