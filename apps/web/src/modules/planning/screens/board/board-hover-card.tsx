// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDateTime } from '@northmes/contracts/format';
import type { GanttSnapshot } from '../../gantt-data.ts';
import type { HoverField } from '../gantt/gantt-hover-card.tsx';
import { type JobOrderRow, latenessText, quantityText, statusLabel } from '../gantt/gantt-rows.ts';
import type { BoardBlockState } from './board-block-states.ts';

/** The badge words of a state in the hover card and in Details (design D3, Badge). */
export function stateBadge(state: BoardBlockState): string {
  switch (state.kind) {
    case 'locked':
      return 'Locked';
    case 'held':
      return 'Being edited by another planner';
    case 'draft':
      return 'In my draft, not saved';
    case 'started':
      return 'Started';
    case 'overdue':
      return 'Overdue';
    default:
      return state.text.charAt(0).toUpperCase() + state.text.slice(1);
  }
}

/**
 * The hover fields of a board block, in the order of design D3 (IN1): the operation, the article,
 * the quantity, setup start, run start and end, the planned setup and run, the machine, the
 * order's deadline and late-by, the status and who holds the soft lock. Every field is also in
 * Details (plan 07, Announcements and live updates).
 */
export function boardHoverFields(
  row: JobOrderRow,
  snapshot: GanttSnapshot,
  machine: string,
): HoverField[] {
  const timeZone = snapshot.plant.timeZone;
  const { jobOrder, operation, order } = row;
  const at = (ms: number) => formatPlantDateTime(ms, timeZone);
  const analysis = snapshot.analysis.orders[order.id];
  const fields: HoverField[] = [
    { label: 'Operation', value: `${operation.sequence}, ${operation.name}` },
    { label: 'Article', value: order.article },
    { label: 'Quantity', value: quantityText(jobOrder.quantity) },
  ];
  if (jobOrder.placement !== undefined) {
    fields.push(
      { label: 'Setup start', value: at(jobOrder.placement.setupStartMs) },
      { label: 'Run start', value: at(jobOrder.placement.runStartMs) },
      { label: 'End', value: at(jobOrder.placement.endMs) },
    );
  }
  fields.push(
    {
      label: 'Planned',
      value: `Setup ${formatDuration(jobOrder.plannedSetupS)}, run ${formatDuration(jobOrder.plannedRunS)}`,
    },
    { label: 'Machine', value: machine },
    { label: 'Order deadline', value: at(order.deadlineMs) },
    {
      label: 'Late by',
      value: analysis?.late ? latenessText(analysis).replace(/^late by /, '') : 'Not late',
    },
    { label: 'Status', value: statusLabel(jobOrder.status) },
    { label: 'Soft lock', value: jobOrder.held === true ? 'Another planner' : 'Nobody' },
  );
  return fields;
}

/**
 * The hover card of a board block (design D3, IN1): the job number and article, the state badges
 * and the hover fields. It is drawn for sighted users only; the block's name carries the times and
 * every state, and Details every field.
 */
export function BoardHoverCard({
  row,
  snapshot,
  machine,
  states,
}: {
  readonly row: JobOrderRow;
  readonly snapshot: GanttSnapshot;
  readonly machine: string;
  readonly states: readonly BoardBlockState[];
}) {
  return (
    <div className="grid w-72 gap-1.5 text-data">
      <p className="font-mono text-sm font-semibold">
        {row.jobOrder.displayNumber} {row.order.article}
      </p>
      {states.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {states.map((state) => (
            <li
              key={state.kind + state.text}
              className="rounded-full border border-current px-1.5 text-xs"
            >
              {stateBadge(state)}
            </li>
          ))}
        </ul>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {boardHoverFields(row, snapshot, machine).map((field) => (
          <div key={field.label} className="contents">
            <dt className="opacity-80">{field.label}</dt>
            <dd className="font-mono text-xs">{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
