// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDateTime } from '@northmes/contracts/format';
import type { ReactNode } from 'react';
import type { GanttSnapshot, OrderAnalysis } from '../../gantt-data.ts';

/** A label and its value in the facts grid. */
function Fact({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs">{children}</dd>
    </>
  );
}

/** The deadline rule in words: "End of shift, 15:00 on the deadline date". */
export function deadlineRuleText(settings: GanttSnapshot['settings']): string {
  return settings.deadlineRule === 'endOfShift'
    ? `End of shift, ${settings.shiftEndForDeadline} on the deadline date`
    : 'Start of day, the production day start on the deadline date';
}

/**
 * The late-order facts of a row (plan 07, the late-order facts the job order table view returns;
 * D3 TA1): the deadline rule in use, the deadline, the planned end, the delay as elapsed and
 * working time, the instant the plan was analysed at, and the row of the critical chain that waits
 * on another order, where the chain names one. The forward fallback of plan() is not in the
 * fixture's analysis, so the facts leave it out.
 */
export function JobOrderLateFacts({
  snapshot,
  orderNumber,
  deadlineMs,
  analysis,
}: {
  readonly snapshot: GanttSnapshot;
  readonly orderNumber: string;
  readonly deadlineMs: number;
  readonly analysis: OrderAnalysis;
}) {
  const { timeZone } = snapshot.plant;
  const machineName = (code: string) =>
    snapshot.equipment.find((machine) => machine.code === code)?.name ?? code;
  const waiting = analysis.chain?.rows.find(
    (row) => row.binding.kind === 'machine' && row.waitWorkingS > 0,
  );
  return (
    <div className="grid gap-1.5 text-[0.8125rem] leading-[1.125rem]">
      <p className="font-semibold">
        Order {orderNumber} is late by {formatDuration(-analysis.slackElapsedS)}
      </p>
      <dl className="grid max-w-3xl grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
        <Fact label="Deadline rule">{deadlineRuleText(snapshot.settings)}</Fact>
        <Fact label="Deadline">{formatPlantDateTime(deadlineMs, timeZone)}</Fact>
        {analysis.plannedEndMs !== undefined && (
          <Fact label="Planned end">{formatPlantDateTime(analysis.plannedEndMs, timeZone)}</Fact>
        )}
        <Fact label="Delay">
          {formatDuration(-analysis.slackElapsedS)} elapsed
          {analysis.lateByWorking !== undefined &&
            `, ${formatDuration(analysis.lateByWorking.seconds)} of working time on ${machineName(analysis.lateByWorking.equipment)}`}
        </Fact>
        <Fact label="As of">{formatPlantDateTime(snapshot.nowMs, timeZone)}, committed plan</Fact>
        {waiting !== undefined && (
          <Fact label="Waits for">
            {waiting.row} waits {formatDuration(waiting.waitWorkingS)} for{' '}
            {waiting.binding.boundBy ?? '?'}
            {waiting.binding.equipment !== undefined &&
              ` on ${machineName(waiting.binding.equipment)}`}
          </Fact>
        )}
      </dl>
    </div>
  );
}
