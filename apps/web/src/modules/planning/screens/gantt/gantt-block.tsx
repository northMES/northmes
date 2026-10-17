// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cn } from 'cn';
import { Clock, Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../ui/primitives/tooltip.tsx';
import { blockName, blockStates } from './gantt-block-states.ts';
import { useGanttView } from './gantt-context.ts';
import { GanttHoverCard } from './gantt-hover-card.tsx';
import { type JobOrderRow, quantityText } from './gantt-rows.ts';

/** The width from which a block shows its first line, its second line, and the setup hatch (D3). */
const density = { compact: 48, full: 120, setup: 66 } as const;

/** Below this width a hollow segment is not drawn at Week and 4 weeks zoom (plan 18). */
const hollowMinPx = 2;

/**
 * The one block of a job order row (plan 18, Blocks across closed time; plan 07, Block states):
 * one target from setup start to end in the order color, the setup part hatched from 66 px of
 * width, the closed segments inside it hollow, the state cues in shape and in the name, the 3 px
 * selection bar on top when its order is selected, and the hover card on hover and on focus. In
 * phase 1 nothing moves, so the block has no drag.
 */
export function GanttBlock({
  row,
  selected,
  onChain,
  onSelect,
}: {
  readonly row: JobOrderRow;
  readonly selected: boolean;
  /** The row is on the highlighted critical chain. */
  readonly onChain: boolean;
  readonly onSelect: () => void;
}) {
  const { scale, snapshot, machineName } = useGanttView();
  const { jobOrder, operation, order } = row;
  if (jobOrder.placement === undefined) return null;
  const { placement } = jobOrder;
  const left = scale.x(placement.setupStartMs);
  const width = Math.max(2, scale.x(placement.endMs) - left);
  const machine = machineName(jobOrder.equipment);
  const name = blockName(row, snapshot, machine, { onChain });
  const states = blockStates(row, snapshot, { onChain });
  const locked = states.some((state) => state.kind === 'locked');
  const conflict = states.some((state) => state.kind === 'conflict');
  const late = states.some((state) => state.kind === 'late');
  const setupWidth =
    jobOrder.plannedSetupS > 0 && width >= density.setup
      ? Math.max(0, scale.x(placement.runStartMs) - left)
      : 0;
  const coarse = scale.zoom === 'week' || scale.zoom === '4weeks';
  const hollows = placement.segments
    .slice(1)
    .map((segment, index) => {
      const before = placement.segments[index];
      const fromMs = before?.toMs ?? segment.fromMs;
      const x = scale.x(fromMs) - left;
      const w = scale.x(segment.fromMs) - left - x;
      return { fromMs, toMs: segment.fromMs, x, w };
    })
    .filter((hollow) => hollow.w > 0 && !(coarse && hollow.w < hollowMinPx));
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            tabIndex={-1}
            aria-label={name}
            data-block={jobOrder.id}
            data-cell-focus
            data-states={states.map((state) => state.kind).join(' ') || undefined}
            onClick={onSelect}
            className={cn(
              'absolute top-1 h-11 overflow-hidden border border-block-border px-1.5 py-0.5 text-start text-xs leading-4 text-black outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              selected && 'border-t-3 border-t-black',
            )}
            style={{ left: `${left}px`, width: `${width}px`, background: `var(--${order.color})` }}
          />
        }
      >
        {setupWidth > 0 && (
          <span
            aria-hidden
            data-setup-hatch
            className="gantt-setup-hatch absolute inset-y-0 left-0"
            style={{ width: `${setupWidth}px` }}
          />
        )}
        {hollows.map((hollow) => (
          <span
            key={hollow.fromMs}
            aria-hidden
            data-hollow
            data-from-ms={hollow.fromMs}
            data-to-ms={hollow.toMs}
            className="absolute inset-y-0 z-[1] bg-lane"
            style={{ left: `${hollow.x}px`, width: `${hollow.w}px` }}
          />
        ))}
        {locked && (
          <span
            aria-hidden
            data-locked-outline
            className="pointer-events-none absolute inset-0.5 z-[2] border-2 border-current"
          />
        )}
        {/* The chain outline differs in shape from the locked one, dashed and further in, so the
            two read apart below compact density and a locked row on the chain keeps both. */}
        {onChain && (
          <span
            aria-hidden
            data-chain-outline
            className="pointer-events-none absolute inset-1.5 z-[2] border-2 border-dashed border-late-foreground"
          />
        )}
        {conflict && (
          <span
            aria-hidden
            data-conflict-edge
            className="pointer-events-none absolute inset-y-0 right-0 z-[2] w-1.75"
            style={{
              background:
                'repeating-linear-gradient(135deg, var(--late-foreground) 0 3px, transparent 3px 6px)',
            }}
          />
        )}
        {width >= density.compact && (
          <span className="relative z-[2] flex items-center gap-1 truncate font-mono font-bold">
            {locked && <Lock aria-hidden className="size-3.5 shrink-0" />}
            {late && <Clock aria-hidden className="size-3.5 shrink-0" />}
            <span className="truncate">
              {operation.displayNumber} {operation.name}
            </span>
          </span>
        )}
        {width >= density.full && (
          <span className="relative z-[2] block truncate">
            {order.article}, {quantityText(jobOrder.quantity)}
          </span>
        )}
      </TooltipTrigger>
      {/* Base UI's popup has no role; the board's hover card is a tooltip (design IN1). */}
      <TooltipContent role="tooltip" side="bottom" align="start" className="max-w-none px-3 py-2.5">
        <GanttHoverCard row={row} snapshot={snapshot} machineName={machine} />
      </TooltipContent>
    </Tooltip>
  );
}
