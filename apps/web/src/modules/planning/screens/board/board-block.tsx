// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantTime, formatSpan } from '@northmes/contracts/format';
import { cn } from 'cn';
import { Clock, ClockAlert, Lock, type LucideIcon, Pencil, Play, UserPen } from 'lucide-react';
import { type FocusEvent, type KeyboardEvent, type PointerEvent, useRef } from 'react';
import { announce } from '../../../../ui/lib/announce.ts';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../ui/primitives/tooltip.tsx';
import type { GanttSnapshot } from '../../gantt-data.ts';
import { useGanttView } from '../gantt/gantt-context.ts';
import { type JobOrderRow, quantityText } from '../gantt/gantt-rows.ts';
import { type BoardBlockState, boardBlockStates, borderMarkerOf } from './board-block-states.ts';
import { BoardHoverCard } from './board-hover-card.tsx';

/** The pointer travel from which a press is a drag, not a click. */
const dragThresholdPx = 3;

/** The machine of the board row under a point of the viewport, by its row's data-machine. */
function machineAt(clientX: number, clientY: number): string | undefined {
  if (typeof document.elementsFromPoint !== 'function') return undefined;
  for (const element of document.elementsFromPoint(clientX, clientY)) {
    const code = element.closest<HTMLElement>('[data-machine]')?.dataset.machine;
    if (code !== undefined) return code;
  }
  return undefined;
}

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
 * the machine, the times and the state words, so the article can carry its own language once the data names it. Each state
 * shows as an icon at the trailing edge, one border marker and, for a conflict, a striped edge, in
 * the block's text color; the fill never carries a state. Under 66 px it draws no text and no
 * icon; the name keeps every word. The block holds no interactive element. The job orders of
 * the selected order carry aria-selected and the 3 px bar on top, apart from the focus ring.
 */
export function BoardBlock({
  row,
  left,
  width,
  snapshot,
  machine,
  focusable,
  selected,
  onFocus,
  onSelect,
  onMenu,
}: {
  readonly row: JobOrderRow;
  /** Where the block starts on the time axis and how wide it is, in px, from its cell. */
  readonly left: number;
  readonly width: number;
  readonly snapshot: GanttSnapshot;
  readonly machine: string;
  /** Whether the block holds the grid's one Tab stop. */
  readonly focusable: boolean;
  /** Whether the block's order is the selected one, which draws the 3 px bar on top. */
  readonly selected: boolean;
  readonly onFocus: (event: FocusEvent<HTMLDivElement>) => void;
  /** A click, Enter or Space selects the block's order; M enters keyboard move mode. */
  readonly onSelect: () => void;
  /** Shift+F10, the context menu key or a right click opens the block menu at the block. */
  readonly onMenu: (anchor: HTMLElement) => void;
}) {
  const { draftRowIds, move, scale, machineName: machineNameOf } = useGanttView();
  // The press in progress: where it started, whether it has become a drag, and the machine under
  // the pointer that the operation may not use, which refuses the drop.
  const press = useRef<
    { clientX: number; setupStartMs: number; dragging: boolean; refusedOn?: string } | undefined
  >(undefined);
  // The click the browser fires after a drop is not a selection.
  const dropped = useRef(false);
  const { jobOrder, order } = row;
  const placement = jobOrder.placement;
  if (placement === undefined) return null;
  const timeZone = snapshot.plant.timeZone;
  const states = boardBlockStates(row, snapshot, { inDraft: draftRowIds?.has(jobOrder.id) });
  const moving = move?.state?.jobOrderId === jobOrder.id;
  const inMoveMode = moving && move?.state?.source === 'keyboard';
  // Keyboard move mode (plan 07, Moving without dragging): M on the focused block enters it; Left
  // and Right step one snap, Up and Down the allowed machines, Enter commits to the draft and
  // Escape cancels. The keys stay with the block while it moves, so the grid's arrows wait.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (move !== undefined && moving) {
      const step = {
        ArrowLeft: () => move.stepTime(-1),
        ArrowRight: () => move.stepTime(1),
        ArrowUp: () => move.stepMachine(-1),
        ArrowDown: () => move.stepMachine(1),
        Enter: () => move.commit(),
        Escape: () => {
          press.current = undefined;
          move.cancel();
        },
        // The keys that would move focus off the moving block wait until the move ends.
        Home: () => {},
        End: () => {},
        PageUp: () => {},
        PageDown: () => {},
        ' ': () => {},
      }[event.key];
      if (step === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      step();
      return;
    }
    if (move !== undefined && (event.key === 'm' || event.key === 'M')) {
      event.preventDefault();
      event.stopPropagation();
      move.begin(jobOrder.id, 'keyboard');
      return;
    }
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault();
      event.stopPropagation();
      onMenu(event.currentTarget);
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect();
  };
  const marker = borderMarkerOf(states);
  const conflict = states.some((state) => state.kind === 'conflict');
  const icons = states.flatMap((state) => {
    const icon = stateIcons[state.kind];
    return icon === undefined ? [] : [{ kind: state.kind, icon }];
  });
  // A pointer drag (plan 07, Moving without dragging; design D3, IN4): past 3 px the press becomes
  // a move, the preview follows the snapped drop on the machine under the pointer, and pointer up
  // commits it; over a machine the operation may not use the preview stays where it was and the
  // drop is refused.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || move === undefined) return;
    press.current = {
      clientX: event.clientX,
      setupStartMs: placement.setupStartMs,
      dragging: false,
    };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
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
    const target = machineAt(event.clientX, event.clientY);
    const allowed = target === undefined || row.operation.allowedEquipment.includes(target);
    current.refusedOn = allowed ? undefined : target;
    move.previewAt(
      scale.snap(scale.instant(scale.x(current.setupStartMs) + dx)),
      allowed ? target : undefined,
    );
  };
  const endPress = (commit: boolean) => {
    const current = press.current;
    press.current = undefined;
    if (current?.dragging !== true || move === undefined) return;
    dropped.current = true;
    if (!commit) {
      move.cancel();
    } else if (current.refusedOn !== undefined) {
      move.cancel();
      announce(
        `Cannot move ${jobOrder.displayNumber}: not allowed on ${machineNameOf(current.refusedOn)}.`,
      );
    } else {
      move.commit();
    }
  };
  const id = `board-block-${jobOrder.id}`;
  const facts = [
    quantityText(jobOrder.quantity),
    machine,
    formatSpan(placement.setupStartMs, placement.endMs, timeZone),
    ...states.map((state) => state.text),
  ].join(', ');
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            role="gridcell"
            tabIndex={focusable ? 0 : -1}
            data-job-order={jobOrder.displayNumber}
            data-board-focus={jobOrder.id}
            data-states={states.map((state) => state.kind).join(' ') || undefined}
            data-move-mode={inMoveMode ? 'true' : undefined}
            aria-selected={selected}
            aria-labelledby={`${id}-number ${id}-article ${id}-facts`}
            onFocus={onFocus}
            onClick={(event) => {
              // The click after a drop is not a selection.
              if (dropped.current) {
                dropped.current = false;
                event.stopPropagation();
                return;
              }
              onSelect();
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              onMenu(event.currentTarget);
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => endPress(true)}
            onPointerCancel={() => endPress(false)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              // Focus that leaves a block in keyboard move mode ends the move without a change.
              if (inMoveMode) move?.cancel({ refocus: false });
            }}
            className={cn(
              'absolute top-1 h-11 touch-none overflow-hidden border border-block-border px-1.5 py-0.5 text-start text-xs leading-4 text-black focus-visible:z-10',
              moving && 'opacity-60',
            )}
            style={{ left: `${left}px`, width: `${width}px`, background: `var(--${order.color})` }}
          />
        }
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
            className="pointer-events-none absolute inset-y-0 end-0 w-1.75"
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
          <span id={`${id}-number`} className="min-w-0 truncate font-mono font-bold">
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
      </TooltipTrigger>
      {/* Base UI's popup has no role; the board's hover card is a tooltip, as the Gantt's. */}
      <TooltipContent role="tooltip" side="bottom" align="start" className="max-w-none px-3 py-2.5">
        <BoardHoverCard row={row} snapshot={snapshot} machine={machine} states={states} />
      </TooltipContent>
    </Tooltip>
  );
}
