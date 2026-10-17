// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import {
  formatDuration,
  formatPlantDateTime,
  formatPlantTime,
  formatSpan,
} from '@northmes/contracts/format';
import { cn } from 'cn';
import { Flag } from 'lucide-react';
import type { GanttSnapshot, OrderAnalysis } from '../../gantt-data.ts';
import { type MarkerDescriptor, placeMarkers } from '../../timeline/markers.ts';
import type { TimeScale } from '../../timeline/time-scale.ts';
import type { GanttRow } from './gantt-rows.ts';

/**
 * The markers of a row (plan 18, Deadlines on the timeline; Float and the critical chain): on an
 * order row the deadline marker and, when late, the late band from the deadline to the planned
 * end; on a job order row, while its chain is highlighted, a tick at its latest start and one at
 * its latest end, and the wait and free float lines at Hours and Day zoom.
 */
export function rowMarkers(
  row: GanttRow,
  snapshot: GanttSnapshot,
  scale: TimeScale,
  options: { readonly onChain: boolean },
): MarkerDescriptor[] {
  const timeZone = snapshot.plant.timeZone;
  const fine = scale.zoom === 'hours' || scale.zoom === 'day';
  const markers: MarkerDescriptor[] = [];
  if (row.kind === 'order') {
    const { order } = row;
    const analysis: OrderAnalysis | undefined = row.analysis;
    markers.push({
      kind: 'deadline',
      atMs: order.deadlineMs,
      rowId: row.id,
      ...(fine && { label: formatPlantTime(order.deadlineMs, timeZone) }),
      accessibleText: `deadline ${formatPlantDateTime(order.deadlineMs, timeZone)}`,
    });
    if (
      analysis?.late &&
      analysis.plannedEndMs !== undefined &&
      analysis.plannedEndMs > order.deadlineMs
    ) {
      markers.push({
        kind: 'lateBand',
        fromMs: order.deadlineMs,
        toMs: analysis.plannedEndMs,
        rowId: row.id,
        accessibleText: `late by ${formatDuration(-analysis.slackElapsedS)}, ${formatSpan(order.deadlineMs, analysis.plannedEndMs, timeZone)}`,
      });
    }
  } else if (row.kind === 'jobOrder') {
    const float = row.analysis?.float;
    const placement = row.jobOrder.placement;
    if (float !== undefined && options.onChain) {
      markers.push(
        {
          kind: 'latestStart',
          atMs: float.latestStartMs,
          rowId: row.id,
          accessibleText: `latest start ${formatPlantDateTime(float.latestStartMs, timeZone)}`,
        },
        {
          kind: 'latestEnd',
          atMs: float.latestEndMs,
          rowId: row.id,
          accessibleText: `latest end ${formatPlantDateTime(float.latestEndMs, timeZone)}`,
        },
      );
    }
    if (float !== undefined && placement !== undefined && fine) {
      if (
        float.waitWorkingS > 0 &&
        (float.binding.kind === 'machine' || float.binding.kind === 'free') &&
        float.earliestStartMs < placement.setupStartMs
      ) {
        markers.push({
          kind: 'wait',
          fromMs: float.earliestStartMs,
          toMs: placement.setupStartMs,
          rowId: row.id,
          accessibleText: `waits ${formatDuration(float.waitWorkingS)}`,
        });
      }
      if (float.freeFloatWorkingS > 0) {
        markers.push({
          kind: 'freeFloat',
          fromMs: placement.endMs,
          toMs: placement.endMs + float.freeFloatWorkingS * 1000,
          rowId: row.id,
          accessibleText: `free float ${formatDuration(float.freeFloatWorkingS)}`,
        });
      }
    }
  }
  return markers;
}

/** The markers over every row: the now line and the frozen window band (plan 18, GT8). */
export function overlayMarkers(snapshot: GanttSnapshot): MarkerDescriptor[] {
  const timeZone = snapshot.plant.timeZone;
  return [
    {
      kind: 'frozen',
      fromMs: snapshot.nowMs,
      toMs: snapshot.fenceMs,
      rowId: 'all',
      accessibleText: `frozen window, ${formatSpan(snapshot.nowMs, snapshot.fenceMs, timeZone)}`,
    },
    {
      kind: 'now',
      atMs: snapshot.nowMs,
      rowId: 'all',
      accessibleText: `now, ${formatPlantDateTime(snapshot.nowMs, timeZone)}`,
    },
  ];
}

/**
 * The marker layer of one row or of the whole time area (plan 18, Additions the core needs):
 * draws each placed marker by kind, nothing outside the visible range. Decorative: every marker's
 * words live in the row's name, the Float column or the detail panel.
 */
export function GanttMarkerLayer({
  markers,
  scale,
}: {
  readonly markers: readonly MarkerDescriptor[];
  readonly scale: TimeScale;
}) {
  return (
    <>
      {placeMarkers(markers, scale).map((marker) => {
        const key = `${marker.kind}-${marker.rowId}-${marker.x}`;
        const common = {
          'aria-hidden': true as const,
          'data-marker': marker.kind,
          'data-accessible-text': marker.accessibleText,
        };
        switch (marker.kind) {
          case 'deadline':
            return (
              <span
                key={key}
                {...common}
                className="absolute inset-y-0 z-[3]"
                style={{ left: `${marker.x}px` }}
              >
                <span className="absolute inset-y-0 left-0 w-0.5 bg-foreground" />
                <Flag className="absolute top-px left-[3px] size-3 fill-current text-foreground" />
                {marker.label !== undefined && (
                  <span className="absolute top-px left-4 font-mono text-[0.6875rem] leading-[0.875rem] whitespace-nowrap text-foreground">
                    {marker.label}
                  </span>
                )}
              </span>
            );
          case 'lateBand':
            return (
              <span
                key={key}
                {...common}
                className="gantt-late-band absolute inset-y-0"
                style={{ left: `${marker.x}px`, width: `${marker.widthPx ?? 0}px` }}
              />
            );
          case 'frozen':
            return (
              <span
                key={key}
                {...common}
                className="absolute inset-y-0 border-s-2 border-dashed border-muted-foreground bg-off-time opacity-50"
                style={{ left: `${marker.x}px`, width: `${marker.widthPx ?? 0}px` }}
              />
            );
          case 'now':
            return (
              <span
                key={key}
                {...common}
                className="absolute inset-y-0 w-0.5 bg-now"
                style={{ left: `${marker.x}px` }}
              />
            );
          case 'latestStart':
          case 'latestEnd':
            return (
              <span
                key={key}
                {...common}
                className={cn(
                  'absolute top-0 h-[9px] w-0.5',
                  marker.kind === 'latestStart' ? 'bg-foreground' : 'bg-late-foreground',
                )}
                style={{ left: `${marker.x}px` }}
              />
            );
          case 'wait':
          case 'freeFloat':
            return (
              <span
                key={key}
                {...common}
                className={cn(
                  'absolute top-[25px] border-t border-foreground',
                  marker.kind === 'wait' ? 'border-dotted opacity-70' : 'opacity-45',
                )}
                style={{ left: `${marker.x}px`, width: `${marker.widthPx ?? 0}px` }}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
