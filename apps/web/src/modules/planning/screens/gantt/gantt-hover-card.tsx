// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDateTime } from '@northmes/contracts/format';
import { shownFields } from '../../board-fields.ts';
import type { GanttSnapshot } from '../../gantt-data.ts';
import type { MaterialShortage } from '../../material-projection.ts';
import { durationsOf, materialShortText } from './gantt-block-states.ts';
import { type JobOrderRow, quantityText, savedSetupOf } from './gantt-rows.ts';

/** One line of the hover card: its field id or analysis line, a label and its value. */
export interface HoverField {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  /** A warning line, drawn on the warning surface: the material warning (design #729, MW1). */
  readonly warning?: boolean;
}

/**
 * The fields of a block's hover card (plan 07, Board settings; #762): the hover fields the plant
 * chose, in their order, then the Gantt's own analysis lines (plan 18, What the timeline shows; D5
 * GA8), which the card always keeps: both durations with their word, setup and run, the free float,
 * the release and the constraint summary. A chosen field that is also an analysis line shows once,
 * where the plant put it. The card opens on hover and on focus, as the board's.
 */
export function hoverFields(
  row: JobOrderRow,
  snapshot: GanttSnapshot,
  machineName: (code: string | undefined) => string,
  hoverIds: readonly string[],
  material: readonly MaterialShortage[] = [],
): HoverField[] {
  const timeZone = snapshot.plant.timeZone;
  const { jobOrder, analysis } = row;
  const fields: HoverField[] = shownFields(hoverIds, row, snapshot, machineName).map((field) => ({
    id: field.id,
    label: field.label,
    value: field.value,
  }));
  const durations = durationsOf(row, snapshot);
  if (durations !== undefined) {
    fields.push(
      { id: 'analysis:working', label: 'Working', value: durations.working },
      { id: 'analysis:elapsed', label: 'Elapsed', value: durations.elapsed },
    );
  }
  if (!hoverIds.includes('setupAndRun')) {
    const saved = savedSetupOf(snapshot, jobOrder.id);
    fields.push({
      id: 'analysis:setupAndRun',
      label: 'Setup, run',
      value:
        saved === undefined
          ? `${formatDuration(jobOrder.plannedSetupS)}, ${formatDuration(jobOrder.plannedRunS)}`
          : `${formatDuration(jobOrder.plannedSetupS)}, retool saved by the run (${formatDuration(saved.setupS)}), ${formatDuration(jobOrder.plannedRunS)}`,
    });
  }
  if (analysis?.float !== undefined && !hoverIds.includes('freeFloat')) {
    const free =
      analysis.float.freeFloatWorkingS === 0
        ? '0'
        : formatDuration(analysis.float.freeFloatWorkingS);
    fields.push({ id: 'analysis:freeFloat', label: 'Free float', value: free });
  }
  if (analysis?.release !== undefined) {
    fields.push({
      id: 'analysis:release',
      label: 'Released from',
      value: `${analysis.release.fromRow} at ${formatPlantDateTime(analysis.release.atMs, timeZone)}`,
    });
  }
  for (const shortage of material) {
    fields.push({
      id: `material:${shortage.material.number}`,
      label: 'Material short',
      value: materialShortText(shortage, ' '),
      warning: true,
    });
  }
  if (analysis !== undefined) {
    const broken = analysis.constraints.filter((line) => !line.holds).length;
    fields.push({
      id: 'analysis:constraints',
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
  hoverIds,
  material,
}: {
  readonly row: JobOrderRow;
  readonly snapshot: GanttSnapshot;
  readonly machineName: (code: string | undefined) => string;
  readonly hoverIds: readonly string[];
  readonly material?: readonly MaterialShortage[];
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
        {hoverFields(row, snapshot, machineName, hoverIds, material).map((field) =>
          field.warning ? (
            <div
              key={field.id}
              className="col-span-2 grid grid-cols-subgrid rounded-sm bg-warning-subtle px-1 text-foreground"
            >
              <dt>{field.label}</dt>
              <dd className="text-end font-mono text-xs">{field.value}</dd>
            </div>
          ) : (
            <div key={field.id} className="contents">
              <dt className="opacity-80">{field.label}</dt>
              <dd className="text-end font-mono text-xs">{field.value}</dd>
            </div>
          ),
        )}
      </dl>
    </div>
  );
}
