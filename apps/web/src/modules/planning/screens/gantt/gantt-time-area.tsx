// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDateTime } from '@northmes/contracts/format';
import { cn } from 'cn';
import type { ClosedWindow, TimeScale } from '../../timeline/time-scale.ts';
import { useGanttView } from './gantt-context.ts';

/** The height of the time header's two tiers, 48 px, in rem. */
export const timeHeaderHeightRem = 3;

/**
 * The time header (plan 18, Shared pieces): the top tier with a tick per day or week, the bottom
 * tier with the preset's finer ticks, and the now label on the top tier when now is in range.
 */
export function GanttTimeHeader({
  scale,
  nowMs,
}: {
  readonly scale: TimeScale;
  readonly nowMs: number;
}) {
  const { timeZone } = useGanttView();
  const ticks = scale.ticks();
  const nowVisible = nowMs >= scale.range.fromMs && nowMs < scale.range.toMs;
  // Hour labels keep their minutes while the ticks are at least 48 px apart; closer, they show the
  // hour alone, as the Week preset of D3 does.
  const bottom = ticks.filter((tick) => tick.tier === 'bottom');
  const spacing =
    bottom.length > 1 ? (bottom[1]?.x ?? 0) - (bottom[0]?.x ?? 0) : Number.POSITIVE_INFINITY;
  const label = (tick: (typeof ticks)[number]) =>
    tick.tier === 'bottom' && spacing < 48 && /^\d{2}:00$/.test(tick.label)
      ? tick.label.slice(0, 2)
      : tick.label;
  return (
    <div
      role="columnheader"
      aria-label="Time"
      className="relative overflow-hidden"
      style={{ height: `${timeHeaderHeightRem}rem` }}
    >
      {ticks.map((tick) => (
        <div
          key={`${tick.tier}-${tick.ms}`}
          aria-hidden
          className={cn(
            'absolute border-s border-border whitespace-nowrap',
            tick.tier === 'top'
              ? 'top-0 h-6 px-1.5 py-0.5 text-xs font-medium'
              : 'top-6 h-6 px-1 py-1 font-mono text-tick text-muted-foreground',
          )}
          style={{ left: `${tick.x}px` }}
        >
          {label(tick)}
        </div>
      ))}
      {scale.gaps.map((gap) => (
        <div
          key={gap.fromMs}
          aria-hidden
          className="absolute top-0 bottom-0 bg-off-time"
          style={{ left: `${gap.x}px`, width: `${gap.widthPx}px` }}
        />
      ))}
      {nowVisible && (
        <div
          aria-hidden
          className="absolute top-6.5 -translate-x-1/2 rounded-full bg-now px-1.5 font-mono text-tick whitespace-nowrap text-now-foreground"
          style={{ left: `${scale.x(nowMs)}px` }}
        >
          {formatPlantDateTime(nowMs, timeZone)}
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
        const left = scale.x(Math.max(window.fromMs, scale.range.fromMs));
        const right = scale.x(Math.min(window.toMs, scale.range.toMs));
        if (right <= left) return null;
        const gap = scale.gaps.some(
          (each) => each.fromMs <= window.fromMs && each.toMs >= window.toMs,
        );
        return (
          <div
            key={window.fromMs}
            aria-hidden
            data-shading={gap ? 'gap' : 'closed'}
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
