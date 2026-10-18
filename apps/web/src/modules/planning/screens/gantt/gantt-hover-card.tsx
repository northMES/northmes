// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDateTime } from '@northmes/contracts/format';
import type { GanttSnapshot } from '../../gantt-data.ts';
import { durationsOf } from './gantt-block-states.ts';
import { type JobOrderRow, quantityText, savedSetupOf, statusLabel } from './gantt-rows.ts';

/** One line of the hover card: a label and its value. */
export interface HoverField {
  readonly label: string;
  readonly value: string;
}

/**
 * The fields of a block's hover card (plan 18, What the timeline shows; D5 GA8): the quantity,
 * the machine, the times, both durations with their word, the free float, the release and the
 * status, then the constraint summary. The card opens on hover and on focus, as the board's.
 */
export function hoverFields(
  row: JobOrderRow,
  snapshot: GanttSnapshot,
  machineName: string,
): HoverField[] {
  const timeZone = snapshot.plant.timeZone;
  const { jobOrder, analysis } = row;
  const fields: HoverField[] = [
    { label: 'Quantity', value: quantityText(jobOrder.quantity) },
    { label: 'Machine', value: machineName },
  ];
  if (jobOrder.placement !== undefined) {
    fields.push(
      { label: 'Start', value: formatPlantDateTime(jobOrder.placement.setupStartMs, timeZone) },
      { label: 'End', value: formatPlantDateTime(jobOrder.placement.endMs, timeZone) },
    );
  }
  const durations = durationsOf(row, snapshot);
  if (durations !== undefined) {
    fields.push(
      { label: 'Working', value: durations.working },
      { label: 'Elapsed', value: durations.elapsed },
    );
  }
  const saved = savedSetupOf(snapshot, jobOrder.id);
  fields.push({
    label: 'Setup, run',
    value:
      saved === undefined
        ? `${formatDuration(jobOrder.plannedSetupS)}, ${formatDuration(jobOrder.plannedRunS)}`
        : `${formatDuration(jobOrder.plannedSetupS)}, retool saved by the run (${formatDuration(saved.setupS)}), ${formatDuration(jobOrder.plannedRunS)}`,
  });
  if (analysis?.float !== undefined) {
    const free =
      analysis.float.freeFloatWorkingS === 0
        ? '0'
        : formatDuration(analysis.float.freeFloatWorkingS);
    fields.push({ label: 'Free float', value: free });
  }
  if (analysis?.release !== undefined) {
    fields.push({
      label: 'Released from',
      value: `${analysis.release.fromRow} at ${formatPlantDateTime(analysis.release.atMs, timeZone)}`,
    });
  }
  fields.push({ label: 'Status', value: statusLabel(jobOrder.status) });
  if (analysis !== undefined) {
    const broken = analysis.constraints.filter((line) => !line.holds).length;
    fields.push({
      label: 'Constraints',
      value:
        broken === 0
          ? `${analysis.constraints.length} hold`
          : `${analysis.constraints.length}, ${broken} broken`,
    });
  }
  return fields;
}

/** The hover card's content: the row's title, its order line and the fields. */
export function GanttHoverCard({
  row,
  snapshot,
  machineName,
}: {
  readonly row: JobOrderRow;
  readonly snapshot: GanttSnapshot;
  readonly machineName: string;
}) {
  return (
    <div className="grid w-72 gap-1 text-data">
      <p className="font-mono text-sm font-semibold">
        {row.operation.displayNumber} {row.operation.name}
      </p>
      <p className="text-xs opacity-80">
        {row.order.article}, {quantityText(row.jobOrder.quantity)}, order {row.order.number}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {hoverFields(row, snapshot, machineName).map((field) => (
          <div key={field.label} className="contents">
            <dt className="opacity-80">{field.label}</dt>
            <dd className="text-end font-mono text-xs">{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
