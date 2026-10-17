// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatSpan } from '@northmes/contracts/format';
import { cn } from 'cn';
import { useGanttView } from './gantt-context.ts';
import { type JobOrderRow, quantityText, statusLabel } from './gantt-rows.ts';

/** The width from which a block shows its first line, its second line, and the setup hatch (D3). */
const density = { compact: 48, full: 120, setup: 66 } as const;

/**
 * The accessible name of a block (plan 07, Block states): the row, the article, the quantity, the
 * machine, the times, the setup and run durations and the status, so a screen reader hears what
 * the block shows and the hover card adds.
 */
export function blockName(row: JobOrderRow, timeZone: string, machineName: string): string {
  const { jobOrder, operation, order } = row;
  const span =
    jobOrder.placement === undefined
      ? 'not placed'
      : formatSpan(jobOrder.placement.setupStartMs, jobOrder.placement.endMs, timeZone);
  return [
    `${operation.displayNumber} ${operation.name}`,
    order.article,
    quantityText(jobOrder.quantity),
    machineName,
    span,
    `setup ${formatDuration(jobOrder.plannedSetupS)}, run ${formatDuration(jobOrder.plannedRunS)}`,
    statusLabel(jobOrder.status).toLowerCase(),
  ].join(', ');
}

/**
 * The one block of a job order row: a target from setup start to end in the order color, with
 * the row's text at the density its width allows (D3) and the 3 px selection bar on top when its
 * order is selected. In phase 1 nothing moves, so the block has no drag; its menu comes with the
 * detail panel.
 */
export function GanttBlock({
  row,
  selected,
  onSelect,
}: {
  readonly row: JobOrderRow;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  const { scale, timeZone, machineName } = useGanttView();
  const { jobOrder, operation, order } = row;
  if (jobOrder.placement === undefined) return null;
  const left = scale.x(jobOrder.placement.setupStartMs);
  const width = Math.max(2, scale.x(jobOrder.placement.endMs) - left);
  const name = blockName(row, timeZone, machineName(jobOrder.equipment));
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={name}
      data-block={jobOrder.id}
      onClick={onSelect}
      className={cn(
        'absolute top-1 h-11 overflow-hidden border border-block-border px-1.5 py-0.5 text-start text-xs leading-4 text-black',
        selected && 'border-t-[3px] border-t-black',
      )}
      style={{ left: `${left}px`, width: `${width}px`, background: `var(--${order.color})` }}
    >
      {width >= density.compact && (
        <span className="block truncate font-mono font-bold">
          {operation.displayNumber} {operation.name}
        </span>
      )}
      {width >= density.full && (
        <span className="block truncate">
          {order.article}, {quantityText(jobOrder.quantity)}
        </span>
      )}
    </button>
  );
}
