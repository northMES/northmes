// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic

import type { JobOrderSpan } from '@northmes/planning-domain';
import { cn } from 'cn';
import { Clock, Lock, Pencil, TriangleAlert } from 'lucide-react';
import { type KeyboardEvent, type PointerEvent, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../ui/primitives/tooltip.tsx';
import { blockLines } from '../../board-fields.ts';
import { useMoveOf } from '../../move-store.ts';
import type { TimeScale } from '../../timeline/time-scale.ts';
import { blockName, blockStates } from './gantt-block-states.ts';
import { useGanttView } from './gantt-context.ts';
import { GanttHoverCard } from './gantt-hover-card.tsx';
import { tooltipText } from './gantt-move.ts';
import type { JobOrderRow } from './gantt-rows.ts';

/** The width from which a block shows its first line, its second line, and the setup hatch (D3). */
const density = { compact: 48, full: 120, setup: 66, cue: 16 } as const;

/** Below this width a hollow segment is not drawn at Week and 4 weeks zoom (plan 18). */
const hollowMinPx = 2;

/** The pointer travel from which a press is a drag, not a click. */
const dragThresholdPx = 3;

/**
 * Where a span draws on the time axis, at least 2 px wide: the one layout of a committed block,
 * the move preview and a ghost span, so the preview shows the block the drop draws (#898).
 */
export function blockBox(
  scale: TimeScale,
  span: Pick<JobOrderSpan, 'setupStartMs' | 'endMs'>,
): { readonly left: number; readonly width: number } {
  const left = scale.x(span.setupStartMs);
  return { left, width: Math.max(2, scale.x(span.endMs) - left) };
}

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
  const { scale, snapshot, machineName, draftRowIds, move, boardFields, materialShortages } =
    useGanttView();
  const { jobOrder, operation, order } = row;
  // The press in progress: where it started, and whether it has become a drag.
  const press = useRef<{ clientX: number; setupStartMs: number; dragging: boolean } | undefined>(
    undefined,
  );
  // The click the browser fires after a drop is not a selection.
  const dropped = useRef(false);
  // Only whether this row moves: the position of a move draws in its preview layer (#898).
  const moving = useMoveOf(move?.store, (each) => each?.state.jobOrderId === jobOrder.id);
  const inMoveMode = useMoveOf(
    move?.store,
    (each) => each?.state.jobOrderId === jobOrder.id && each.state.source === 'keyboard',
  );
  if (jobOrder.placement === undefined) return null;
  const { placement } = jobOrder;
  const { left, width } = blockBox(scale, placement);
  const machine = machineName(jobOrder.equipment);
  const inDraft = draftRowIds?.has(jobOrder.id) === true;
  const material = materialShortages?.get(operation.displayNumber);
  const lines = blockLines(boardFields.block, row, snapshot, machineName);
  const name = blockName(row, snapshot, machine, {
    onChain,
    inDraft,
    material,
    extraNames: lines.extraNames,
  });
  const states = blockStates(row, snapshot, { onChain, inDraft, material });
  const short = material !== undefined && material.length > 0;
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
  // The text lines sit on the order color: a hollow segment shows the lane color, which is dark
  // in the dark theme while the text is pure black, so text over a hollow could not be read (#882).
  // The setup hatch, the outlines and the conflict edge sit above the text at z-[3].
  const color = `var(--${order.color})`;

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
                background: color,
              }}
            />
          }
        >
          {setupWidth > 0 && (
            <span
              aria-hidden
              data-setup-hatch
              className="gantt-setup-hatch absolute inset-y-0 left-0 z-[3]"
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
              className="pointer-events-none absolute inset-0.5 z-[3] border-2 border-current"
            />
          )}
          {/* The chain outline differs in shape from the locked one, dashed and further in, so the
              two read apart below compact density and a locked row on the chain keeps both. */}
          {onChain && (
            <span
              aria-hidden
              data-chain-outline
              className="pointer-events-none absolute inset-1.5 z-[3] border-2 border-dashed border-late-foreground"
            />
          )}
          {conflict && (
            <span
              aria-hidden
              data-conflict-edge
              className="pointer-events-none absolute inset-y-0 right-0 z-[3] w-1.75"
              style={{
                background:
                  'repeating-linear-gradient(135deg, var(--late-foreground) 0 3px, transparent 3px 6px)',
              }}
            />
          )}
          {short && width >= density.cue && (
            // The material warning at the block's trailing edge (D3 block states), on a block wide
            // enough to hold it; the name, the tree badge and the hover card carry it on any block.
            <TriangleAlert
              aria-hidden
              data-material-cue
              className="absolute end-0.5 top-0.5 z-[3] size-3.5 rounded-sm bg-warning-subtle text-warning"
            />
          )}
          {width >= density.compact && (
            <span
              data-block-text
              className={cn(
                'relative z-[2] flex w-fit max-w-full items-center gap-1 truncate font-mono font-bold',
                short && width >= density.cue && 'pe-4',
              )}
              style={{ background: color }}
            >
              {locked && <Lock aria-hidden className="size-3.5 shrink-0" />}
              {inDraft && <Pencil aria-hidden className="size-3.5 shrink-0" />}
              {late && <Clock aria-hidden className="size-3.5 shrink-0" />}
              <span data-block-line="1" className="truncate">
                {lines.first === undefined
                  ? operation.displayNumber
                  : `${operation.displayNumber} ${lines.first}`}
              </span>
            </span>
          )}
          {/* The block fields after the first (plan 07, Board settings; #762): the second line at
              full density, with the module fields at its trailing edge (D3 IN29). */}
          {width >= density.full && (lines.second !== '' || lines.trailing.length > 0) && (
            <span className="relative z-[2] flex items-center justify-between gap-1.5">
              <span
                data-block-line="2"
                data-block-text
                className="min-w-0 truncate"
                style={{ background: color }}
              >
                {lines.second}
              </span>
              {lines.trailing.length > 0 && (
                <span
                  data-block-text
                  className="flex shrink-0 gap-1.5"
                  style={{ background: color }}
                >
                  {lines.trailing.map((field) => (
                    <span key={field.id} data-block-trailing className="font-semibold">
                      {field.text}
                    </span>
                  ))}
                </span>
              )}
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
          <GanttHoverCard
            row={row}
            snapshot={snapshot}
            machineName={machineName}
            hoverIds={boardFields.hover}
            material={material ?? []}
          />
        </TooltipContent>
      </Tooltip>
      <GanttMovePreview jobOrderId={jobOrder.id} color={color} />
    </>
  );
}

/**
 * The preview layer of a block during a move, the one part of the row that renders again on a
 * pointer move (#898): on the moving row the snapped span as an outline in the draft style, with
 * the tooltip that names the landing span, the release snap and the cascade count; on a row the
 * cascade would carry, its ghost span. Decorative: the step message and the block's name carry
 * the words.
 */
function GanttMovePreview({
  jobOrderId,
  color,
}: {
  readonly jobOrderId: string;
  readonly color: string;
}) {
  const { scale, timeZone, move } = useGanttView();
  const preview = useMoveOf(move?.store, (each) =>
    each?.state.jobOrderId === jobOrderId ? each.preview : undefined,
  );
  const ghost = useMoveOf(move?.store, (each) => each?.preview?.ghosts.get(jobOrderId));
  if (preview !== undefined) {
    const box = blockBox(scale, preview.span);
    return (
      <>
        <span
          aria-hidden
          data-move-preview={jobOrderId}
          data-from-ms={preview.span.setupStartMs}
          data-to-ms={preview.span.endMs}
          className="pointer-events-none absolute top-1 z-[3] h-11 border-3 border-double border-foreground bg-foreground/10"
          style={{ left: `${box.left}px`, width: `${box.width}px` }}
        />
        <span
          aria-hidden
          data-drag-tooltip
          className="pointer-events-none absolute bottom-0 z-[4] rounded-sm bg-popover px-1.5 py-0.5 font-mono text-tick whitespace-nowrap text-popover-foreground shadow-sm"
          style={{ left: `${box.left}px` }}
        >
          {tooltipText(preview, timeZone)}
        </span>
      </>
    );
  }
  if (ghost === undefined) return null;
  // A ghost span: where the cascade would put this row, in the draft style at reduced opacity.
  const box = blockBox(scale, ghost);
  return (
    <span
      aria-hidden
      data-ghost={jobOrderId}
      data-from-ms={ghost.setupStartMs}
      data-to-ms={ghost.endMs}
      className="pointer-events-none absolute top-1 z-[3] h-11 border-3 border-double border-foreground opacity-45"
      style={{ left: `${box.left}px`, width: `${box.width}px`, background: color }}
    />
  );
}
