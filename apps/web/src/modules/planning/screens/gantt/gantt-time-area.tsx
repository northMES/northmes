// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantTime } from '@northmes/contracts/format';
import { cn } from 'cn';
import type { ClosedWindow, TimeScale } from '../../timeline/time-scale.ts';
import { useGanttView } from './gantt-context.ts';

/** The height of the time header's two tiers, 48 px, in rem. */
export const timeHeaderHeightRem = 3;

/**
 * The time header (plan 18, Shared pieces): the top tier with the coarser cells of the zoom level,
 * the bottom tier with its finer cells (ADR 0089, Zoom levels), and the now label on the bottom
 * tier when now is in range.
 * Each cell starts at its first open segment and holds the longest label that fits it (ADR 0089,
 * Header tiers); the gaps are drawn first, so no gap covers a label. Each cell reads as its full
 * date to a screen reader, whichever label it shows (#902). The now label is the clock
 * alone, since the top tier names the day and the now marker's accessible text carries the date
 * and the time (#885).
 */
export function GanttTimeHeader({
  scale,
  nowMs,
}: {
  readonly scale: TimeScale;
  readonly nowMs: number;
}) {
  const { timeZone } = useGanttView();
  const nowVisible = nowMs >= scale.range.fromMs && nowMs < scale.range.toMs;
  return (
    <div
      role="columnheader"
      aria-label="Time"
      className="relative overflow-hidden"
      style={{ height: `${timeHeaderHeightRem}rem` }}
    >
      {scale.gaps.map((gap) => (
        <div
          key={gap.fromMs}
          aria-hidden
          data-header-gap
          className="absolute top-0 bottom-0 bg-off-time"
          style={{ left: `${gap.x}px`, width: `${gap.widthPx}px` }}
        />
      ))}
      {scale.ticks().map((tick) => (
        <div
          key={`${tick.tier}-${tick.ms}`}
          data-tier={tick.tier}
          // A plain join: the class merge of cn reads text-tick as a text color and would drop it
          // for text-muted-foreground, and the time scale fits each label at the tick size.
          className={`absolute border-s border-border whitespace-nowrap ${
            tick.tier === 'top'
              ? 'top-0 h-6 px-1.5 py-0.5 text-xs font-medium'
              : 'top-6 h-6 px-1 py-1 font-mono text-tick text-muted-foreground'
          }`}
          style={{ left: `${tick.x}px` }}
        >
          {/* The label that fits is for sight; a screen reader reads the full date (#902). */}
          <span aria-hidden data-tick-label>
            {tick.label}
          </span>
          <span className="sr-only">{tick.name}</span>
        </div>
      ))}
      {nowVisible && (
        <div
          aria-hidden
          className="absolute top-6.5 -translate-x-1/2 rounded-full bg-now px-1.5 font-mono text-tick whitespace-nowrap text-now-foreground"
          style={{ left: `${scale.x(nowMs)}px` }}
        >
          {formatPlantTime(nowMs, timeZone)}
        </div>
      )}
    </div>
  );
}

/**
 * The closed time of a row's calendar in the off-time token (plan 18, Shading and the shift
 * strip), each compressed window as a hatched gap when closed time is hidden. Decorative: the
 * row's name and the hover card carry the words.
 */
export function TimeCellShading({
  windows,
  scale,
}: {
  readonly windows: readonly ClosedWindow[];
  readonly scale: TimeScale;
}) {
  return (
    <>
      {windows.map((window) => {
        const fromMs = Math.max(window.fromMs, scale.range.fromMs);
        const toMs = Math.min(window.toMs, scale.range.toMs);
        const left = scale.x(fromMs);
        const right = scale.x(toMs);
        // A window under a pixel at the level, a break at Quarter, is not drawn (ADR 0089).
        if (right - left < 1) return null;
        // The gaps are clipped to the range, so the window is compared as the range cuts it.
        const gap = scale.gaps.some((each) => each.fromMs <= fromMs && each.toMs >= toMs);
        return (
          <div
            key={window.fromMs}
            aria-hidden
            data-shading={gap ? 'gap' : 'closed'}
            data-from-ms={window.fromMs}
            data-to-ms={window.toMs}
            className={cn('absolute top-0 bottom-0', gap ? 'gantt-gap' : 'bg-off-time')}
            style={{ left: `${left}px`, width: `${right - left}px` }}
          />
        );
      })}
    </>
  );
}

/**
 * A summary bar (plan 18, Additions the core needs): one bar from the earliest start to the latest
 * end of a row's children, in the order color at reduced opacity with the 1 px block border, no
 * text, never a move target. The cell that holds it carries its name.
 */
export function SummaryBar({
  span,
  scale,
  color,
  run = false,
}: {
  readonly span: { readonly fromMs: number; readonly toMs: number };
  readonly scale: TimeScale;
  readonly color: string;
  /** The run cue (plan 18, Runs): a doubled left edge, so a run reads apart from an order in forced colors too. */
  readonly run?: boolean;
}) {
  const left = scale.x(span.fromMs);
  const width = Math.max(2, scale.x(span.toMs) - left);
  return (
    <div
      aria-hidden
      data-summary-bar
      data-run={run || undefined}
      className={cn(
        'absolute top-2.5 h-4 border border-block-border opacity-55',
        run && 'border-s-4',
      )}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        background: `var(--${color})`,
        // Tailwind has no side variant of the border style, so the run cue's double edge is inline.
        ...(run && { borderInlineStartStyle: 'double' }),
      }}
    />
  );
}
