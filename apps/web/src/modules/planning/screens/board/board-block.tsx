// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantTime, formatSpan } from '@northmes/contracts/format';
import { cn } from 'cn';
import { Clock, ClockAlert, Lock, type LucideIcon, Pencil, Play, UserPen } from 'lucide-react';
import type { FocusEvent } from 'react';
import type { GanttSnapshot } from '../../gantt-data.ts';
import type { TimeScale } from '../../timeline/time-scale.ts';
import { type JobOrderRow, quantityText } from '../gantt/gantt-rows.ts';
import { type BoardBlockState, boardBlockStates, borderMarkerOf } from './board-block-states.ts';

/** The widths from which a block shows its job number and its second line (D3, BO12). */
export const blockDensity = { compact: 66, full: 120 } as const;

/** The icon of each state at the block's trailing edge (design D3, BO12); a conflict draws a stripe. */
const stateIcons: Partial<Record<BoardBlockState['kind'], LucideIcon>> = {
  locked: Lock,
  held: UserPen,
  draft: Pencil,
  started: Play,
  late: Clock,
  overdue: ClockAlert,
};

/** The border marker's line style (design D3, BO12): solid inside for locked, dashed, double. */
const markerClasses = {
  locked: 'inset-0.5 border-2 border-solid',
  held: 'inset-0 border-2 border-dashed',
  draft: 'inset-0 border-3 border-double',
} as const;

/**
 * One job order on its machine row (plan 07, Grid semantics and focus, Block states; design D3,
 * BO12): a gridcell from setup start to end in the order color, its accessible name built through
 * aria-labelledby from the visible job number and article and a hidden span with the quantity,
 * the machine, the times and the state words, so the article keeps its own language. Each state
 * shows as an icon at the trailing edge, one border marker and, for a conflict, a striped edge, in
 * the block's text color; the fill never carries a state. Under 66 px it draws no text and no
 * icon; the name keeps every word. The block holds no interactive element. The job orders of
 * the selected order carry aria-selected and the 3 px bar on top, apart from the focus ring.
 */
export function BoardBlock({
  row,
  scale,
  snapshot,
  machine,
  focusable,
  selected,
  onFocus,
  onSelect,
}: {
  readonly row: JobOrderRow;
  readonly scale: TimeScale;
  readonly snapshot: GanttSnapshot;
  readonly machine: string;
  /** Whether the block holds the grid's one Tab stop. */
  readonly focusable: boolean;
  /** Whether the block's order is the selected one, which draws the 3 px bar on top. */
  readonly selected: boolean;
  readonly onFocus: (event: FocusEvent<HTMLDivElement>) => void;
  /** A click selects the block's order. */
  readonly onSelect: () => void;
}) {
  const { jobOrder, order } = row;
  const placement = jobOrder.placement;
  if (placement === undefined) return null;
  const timeZone = snapshot.plant.timeZone;
  const left = scale.x(Math.max(placement.setupStartMs, scale.range.fromMs));
  const right = scale.x(Math.min(placement.endMs, scale.range.toMs));
  const width = Math.max(2, right - left);
  const states = boardBlockStates(row, snapshot);
  const marker = borderMarkerOf(states);
  const conflict = states.some((state) => state.kind === 'conflict');
  const icons = states.flatMap((state) => {
    const icon = stateIcons[state.kind];
    return icon === undefined ? [] : [{ kind: state.kind, icon }];
  });
  const id = `board-block-${jobOrder.id}`;
  const facts = [
    quantityText(jobOrder.quantity),
    machine,
    formatSpan(placement.setupStartMs, placement.endMs, timeZone),
    ...states.map((state) => state.text),
  ].join(', ');
  return (
    <div
      role="gridcell"
      tabIndex={focusable ? 0 : -1}
      data-job-order={jobOrder.displayNumber}
      data-board-focus={jobOrder.id}
      data-states={states.map((state) => state.kind).join(' ') || undefined}
      aria-selected={selected}
      aria-labelledby={`${id}-number ${id}-article ${id}-facts`}
      onFocus={onFocus}
      onClick={onSelect}
      className="absolute top-1 h-11 overflow-hidden border border-block-border px-1.5 py-0.5 text-start text-xs leading-4 text-black focus-visible:z-10"
      style={{ left: `${left}px`, width: `${width}px`, background: `var(--${order.color})` }}
    >
      {selected && (
        <span
          aria-hidden
          data-selection-bar
          className="pointer-events-none absolute inset-x-0 top-0 h-0.75 bg-foreground"
        />
      )}
      {marker !== undefined && (
        <span
          aria-hidden
          data-marker={marker}
          className={cn('pointer-events-none absolute border-current', markerClasses[marker])}
        />
      )}
      {conflict && (
        <span
          aria-hidden
          data-conflict-edge
          className="pointer-events-none absolute inset-y-0 right-0 w-1.75"
          style={{
            background:
              'repeating-linear-gradient(135deg, currentColor 0 3px, transparent 3px 6px)',
          }}
        />
      )}
      <span
        className={cn(
          'relative flex items-center gap-1',
          width < blockDensity.compact && 'sr-only',
          conflict && 'pe-2',
        )}
      >
        <span id={`${id}-number`} className="shrink-0 font-mono font-bold">
          {jobOrder.displayNumber}
        </span>
        <span
          id={`${id}-article`}
          className={cn('min-w-0 truncate', width < blockDensity.full && 'sr-only')}
        >
          {order.article}
          <span className="sr-only">,</span>
        </span>
        {icons.length > 0 && (
          <span aria-hidden className="ms-auto flex shrink-0 items-center gap-0.5">
            {icons.map(({ kind, icon: Icon }) => (
              <Icon key={kind} data-state-icon={kind} className="size-3.5" />
            ))}
          </span>
        )}
      </span>
      <span id={`${id}-facts`} className="sr-only">
        {facts}
      </span>
      {width >= blockDensity.compact && (
        <span aria-hidden className={cn('relative block truncate', conflict && 'pe-2')}>
          {width >= blockDensity.full
            ? `${quantityText(jobOrder.quantity)}, ends ${formatPlantTime(placement.endMs, timeZone)}`
            : quantityText(jobOrder.quantity)}
        </span>
      )}
    </div>
  );
}
