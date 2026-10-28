// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cn } from 'cn';
import { Clock, Lock, Pencil } from 'lucide-react';
import { type KeyboardEvent, type PointerEvent, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../ui/primitives/tooltip.tsx';
import { blockName, blockStates } from './gantt-block-states.ts';
import { useGanttView } from './gantt-context.ts';
import { GanttHoverCard } from './gantt-hover-card.tsx';
import { tooltipText } from './gantt-move.ts';
import { type JobOrderRow, quantityText } from './gantt-rows.ts';

/** The width from which a block shows its first line, its second line, and the setup hatch (D3). */
const density = { compact: 48, full: 120, setup: 66 } as const;

/** Below this width a hollow segment is not drawn at Week and 4 weeks zoom (plan 18). */
const hollowMinPx = 2;

/** The pointer travel from which a press is a drag, not a click. */
const dragThresholdPx = 3;

/**
 * The one block of a job order row (plan 18, Blocks across closed time; plan 07, Block states):
 * one target from setup start to end in the order color, the setup part hatched from 66 px of
 * width, the closed segments inside it hollow, the state cues in shape and in the name, the 3 px
 * selection bar on top when its order is selected, and the hover card on hover and on focus. A
 * pointer drag moves it in time (plan 18, Moves on the order Gantt): the preview outline follows
 * the snapped drop, with the drag tooltip and the ghost spans of the rows the cascade would move;
 * M enters keyboard move mode on the focused block.
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
  const { scale, snapshot, machineName, timeZone, draftRowIds, move } = useGanttView();
  const { jobOrder, operation, order } = row;
  // The press in progress: where it started, and whether it has become a drag.
  const press = useRef<{ clientX: number; setupStartMs: number; dragging: boolean } | undefined>(
    undefined,
  );
  // The click the browser fires after a drop is not a selection.
  const dropped = useRef(false);
  if (jobOrder.placement === undefined) return null;
  const { placement } = jobOrder;
  const left = scale.x(placement.setupStartMs);
  const width = Math.max(2, scale.x(placement.endMs) - left);
  const machine = machineName(jobOrder.equipment);
  const inDraft = draftRowIds?.has(jobOrder.id) === true;
  const name = blockName(row, snapshot, machine, { onChain, inDraft });
  const states = blockStates(row, snapshot, { onChain, inDraft });
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
  const moving = move?.state?.jobOrderId === jobOrder.id;
  const inMoveMode = moving && move?.state?.source === 'keyboard';
  const preview = moving ? move?.preview : undefined;
  const ghost = move?.preview?.ghosts.get(jobOrder.id);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || move === undefined) return;
    press.current = {
      clientX: event.clientX,
      setupStartMs: placement.setupStartMs,
      dragging: false,
    };
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = press.current;
    if (current === undefined || move === undefined) return;
    const dx = event.clientX - current.clientX;
    if (!current.dragging) {
      if (Math.abs(dx) < dragThresholdPx) return;
      if (!move.begin(jobOrder.id, 'pointer')) {
        press.current = undefined;
        return;
      }
      current.dragging = true;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // A test browser without pointer capture still delivers the events to the block.
      }
    }
    // The drop snaps first to the preset's step, then forward to working time in the preview.
    move.previewAt(scale.snap(scale.instant(scale.x(current.setupStartMs) + dx)));
  };
  const endPress = (commit: boolean) => {
    const current = press.current;
    press.current = undefined;
    if (current?.dragging !== true || move === undefined) return;
    dropped.current = true;
    if (commit) move.commit();
    else move.cancel();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (move === undefined) return;
    if (moving) {
      let handled = true;
      switch (event.key) {
        case 'ArrowLeft':
          move.stepTime(-1);
          break;
        case 'ArrowRight':
          move.stepTime(1);
          break;
        case 'ArrowUp':
          move.stepMachine(-1);
          break;
        case 'ArrowDown':
          move.stepMachine(1);
          break;
        case 'Enter':
          move.commit();
          break;
        case 'Escape':
          move.cancel();
          break;
        default:
          handled = false;
      }
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (event.key === 'm' || event.key === 'M') {
      event.preventDefault();
      event.stopPropagation();
      move.begin(jobOrder.id, 'keyboard');
    }
  };
  return (
    <>
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
              data-selected={selected || undefined}
              data-move-mode={inMoveMode ? 'true' : undefined}
              onClick={(event) => {
                // The click after a drop reaches neither the block nor the row under it.
                if (dropped.current) {
                  dropped.current = false;
                  event.stopPropagation();
                  return;
                }
                onSelect();
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => endPress(true)}
              onPointerCancel={() => endPress(false)}
              onKeyDown={onKeyDown}
              className={cn(
                'absolute top-1 h-11 touch-none overflow-hidden border border-block-border px-1.5 py-0.5 text-start text-xs leading-4 text-palette-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                selected && 'border-t-3 border-t-black',
                inDraft && 'border-3 border-double border-black',
                moving && 'opacity-60',
              )}
              style={{
                left: `${left}px`,
                width: `${width}px`,
                background: `var(--${order.color})`,
              }}
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
              {inDraft && <Pencil aria-hidden className="size-3.5 shrink-0" />}
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
        <TooltipContent
          role="tooltip"
          side="bottom"
          align="start"
          className="max-w-none px-3 py-2.5"
        >
          <GanttHoverCard row={row} snapshot={snapshot} machineName={machine} />
        </TooltipContent>
      </Tooltip>
      {/* The move preview: the snapped span as an outline in the draft style, with the tooltip
          that names the landing span, the release snap and the cascade count. Decorative: the
          step message and the block's name carry the words. */}
      {preview !== undefined && (
        <>
          <span
            aria-hidden
            data-move-preview={jobOrder.id}
            data-from-ms={preview.span.setupStartMs}
            data-to-ms={preview.span.endMs}
            className="pointer-events-none absolute top-1 z-[3] h-11 border-3 border-double border-foreground bg-foreground/10"
            style={{
              left: `${scale.x(preview.span.setupStartMs)}px`,
              width: `${Math.max(2, scale.x(preview.span.endMs) - scale.x(preview.span.setupStartMs))}px`,
            }}
          />
          <span
            aria-hidden
            data-drag-tooltip
            className="pointer-events-none absolute bottom-0 z-[4] rounded-sm bg-popover px-1.5 py-0.5 font-mono text-tick whitespace-nowrap text-popover-foreground shadow-sm"
            style={{ left: `${scale.x(preview.span.setupStartMs)}px` }}
          >
            {tooltipText(preview, timeZone)}
          </span>
        </>
      )}
      {/* A ghost span: where the cascade would put this row, in the draft style at reduced opacity. */}
      {ghost !== undefined && (
        <span
          aria-hidden
          data-ghost={jobOrder.id}
          data-from-ms={ghost.setupStartMs}
          data-to-ms={ghost.endMs}
          className="pointer-events-none absolute top-1 z-[3] h-11 border-3 border-double border-foreground opacity-45"
          style={{
            left: `${scale.x(ghost.setupStartMs)}px`,
            width: `${Math.max(2, scale.x(ghost.endMs) - scale.x(ghost.setupStartMs))}px`,
            background: `var(--${order.color})`,
          }}
        />
      )}
    </>
  );
}
