// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantTime, formatSpan } from '@northmes/contracts/format';
import { cn } from 'cn';
import type { FocusEvent } from 'react';
import type { TimeScale } from '../../timeline/time-scale.ts';
import { type JobOrderRow, quantityText } from '../gantt/gantt-rows.ts';

/** The widths from which a block shows its job number and its second line (D3, BO12). */
export const blockDensity = { compact: 66, full: 120 } as const;

/**
 * One job order on its machine row (plan 07, Grid semantics and focus; design D3, BO12): a
 * gridcell from setup start to end in the order color, its accessible name built through
 * aria-labelledby from the visible job number and article and a hidden span with the quantity,
 * the machine and the times, so the article can carry its own language once the data names it. Under 66 px it draws no text;
 * the name keeps every word. The block holds no interactive element.
 */
export function BoardBlock({
  row,
  scale,
  machine,
  timeZone,
  focusable,
  onFocus,
}: {
  readonly row: JobOrderRow;
  readonly scale: TimeScale;
  readonly machine: string;
  readonly timeZone: string;
  /** Whether the block holds the grid's one Tab stop. */
  readonly focusable: boolean;
  readonly onFocus: (event: FocusEvent<HTMLDivElement>) => void;
}) {
  const { jobOrder, order } = row;
  const placement = jobOrder.placement;
  if (placement === undefined) return null;
  const left = scale.x(Math.max(placement.setupStartMs, scale.range.fromMs));
  const right = scale.x(Math.min(placement.endMs, scale.range.toMs));
  const width = Math.max(2, right - left);
  const id = `board-block-${jobOrder.id}`;
  const facts = [
    quantityText(jobOrder.quantity),
    machine,
    formatSpan(placement.setupStartMs, placement.endMs, timeZone),
  ].join(', ');
  return (
    <div
      role="gridcell"
      tabIndex={focusable ? 0 : -1}
      data-job-order={jobOrder.displayNumber}
      data-board-focus={jobOrder.id}
      aria-labelledby={`${id}-number ${id}-article ${id}-facts`}
      onFocus={onFocus}
      className="absolute top-1 h-11 overflow-hidden border border-block-border px-1.5 py-0.5 text-start text-xs leading-4 text-palette-foreground focus-visible:z-10"
      style={{
        left: `${left}px`,
        width: `${width}px`,
        background: `var(--${order.color})`,
      }}
    >
      <span
        className={cn(
          'flex items-center gap-1 truncate',
          width < blockDensity.compact && 'sr-only',
        )}
      >
        <span id={`${id}-number`} className="font-mono font-bold">
          {jobOrder.displayNumber}
        </span>
        <span
          id={`${id}-article`}
          className={cn('truncate', width < blockDensity.full && 'sr-only')}
        >
          {order.article}
          <span className="sr-only">,</span>
        </span>
      </span>
      <span id={`${id}-facts`} className="sr-only">
        {facts}
      </span>
      {width >= blockDensity.compact && (
        <span aria-hidden className="block truncate">
          {width >= blockDensity.full
            ? `${quantityText(jobOrder.quantity)}, ends ${formatPlantTime(placement.endMs, timeZone)}`
            : quantityText(jobOrder.quantity)}
        </span>
      )}
    </div>
  );
}
