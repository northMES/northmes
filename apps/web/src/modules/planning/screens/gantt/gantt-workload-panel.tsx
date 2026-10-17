// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { type DurationOptions, formatDuration, formatPlantDay } from '@northmes/contracts/format';

/** Workload is working time, so its sums print in hours: "41 h 15 min", never in days. */
const hours: DurationOptions = { form: 'hours' };

import { cn } from 'cn';
import { useEffect, useId, useRef, useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { Button } from '../../../../ui/primitives/button.tsx';
import type { GanttSnapshot, WorkloadBucket } from '../../gantt-data.ts';
import { visibleItems } from '../../timeline/culling.ts';
import type { TimeScale } from '../../timeline/time-scale.ts';
import { laneHeightRem } from './gantt-rows.ts';

/** A bucket placed on the axis: its production day as a span, and its bar. */
interface PlacedBucket {
  readonly bucket: WorkloadBucket;
  readonly fromMs: number;
  readonly toMs: number;
}

/** The span of a production day in the plant zone, from the day start to the next (ADR 0025). */
function productionDaySpan(
  day: string,
  timeZone: string,
  productionDayStart: string,
): { readonly fromMs: number; readonly toMs: number } {
  const [hour = 0, minute = 0] = productionDayStart.split(':').map(Number);
  const start = Temporal.PlainDate.from(day).toZonedDateTime({
    timeZone,
    plainTime: { hour, minute },
  });
  return { fromMs: start.epochMilliseconds, toMs: start.add({ days: 1 }).epochMilliseconds };
}

/** The buckets of a machine inside the visible range, sorted by day. */
export function laneBuckets(
  snapshot: GanttSnapshot,
  equipment: string,
  scale: TimeScale,
): PlacedBucket[] {
  const placed = snapshot.analysis.workload
    .filter((bucket) => bucket.equipment === equipment)
    .map((bucket) => ({
      bucket,
      ...productionDaySpan(
        bucket.productionDay,
        snapshot.plant.timeZone,
        snapshot.plant.productionDayStart,
      ),
    }))
    .sort((a, b) => a.fromMs - b.fromMs);
  return visibleItems(placed, scale.range);
}

/** The machines the visible orders use, by equipment group then code (plan 18, The workload lane). */
export function laneMachines(
  snapshot: GanttSnapshot,
): readonly { readonly code: string; readonly name: string }[] {
  const used = new Set(
    snapshot.productionOrders.flatMap((order) =>
      order.jobOrders.flatMap((row) => (row.equipment === undefined ? [] : [row.equipment])),
    ),
  );
  const groupOrder = new Map(snapshot.equipmentGroups.map((group, index) => [group.code, index]));
  return snapshot.equipment
    .filter((machine) => used.has(machine.code))
    .sort(
      (a, b) =>
        (groupOrder.get(a.group) ?? 0) - (groupOrder.get(b.group) ?? 0) ||
        a.code.localeCompare(b.code),
    )
    .map(({ code, name }) => ({ code, name }));
}

/** "42 %" from a permille, "closed" for a bucket without availability. */
export function utilizationText(bucket: WorkloadBucket): string {
  return bucket.availableS === 0 ? 'closed' : `${Math.round(bucket.utilizationPermille / 10)} %`;
}

/** One row of the lane's text table: the bucket's values as durations. */
export function bucketRow(bucket: WorkloadBucket): readonly string[] {
  const free = Math.max(0, bucket.availableS - bucket.loadedS);
  return [
    formatPlantDay(bucket.productionDay),
    formatDuration(bucket.availableS, hours),
    formatDuration(bucket.loadedS, hours),
    formatDuration(bucket.setupS, hours),
    formatDuration(bucket.runS, hours),
    formatDuration(free, hours),
    utilizationText(bucket),
    formatDuration(bucket.overloadS, hours),
  ];
}

/** The totals row over the visible buckets. */
function totalsRow(buckets: readonly WorkloadBucket[]): readonly string[] {
  const sum = (key: 'availableS' | 'loadedS' | 'setupS' | 'runS' | 'overloadS') =>
    buckets.reduce((total, bucket) => total + bucket[key], 0);
  const available = sum('availableS');
  const loaded = sum('loadedS');
  return [
    'Visible range',
    formatDuration(available, hours),
    formatDuration(loaded, hours),
    formatDuration(sum('setupS'), hours),
    formatDuration(sum('runS'), hours),
    formatDuration(Math.max(0, available - loaded), hours),
    available === 0 ? 'closed' : `${Math.round((loaded * 100) / available)} %`,
    formatDuration(sum('overloadS'), hours),
  ];
}

const tableHeaders = [
  'Production day',
  'Available',
  'Loaded',
  'Setup',
  'Run',
  'Free',
  'Utilization',
  'Overload',
];

/**
 * One machine's lane (plan 18, The workload lane): a bar per bucket whose height is the
 * utilization, full at 100 percent, the setup part hatched, the overload above the lane's top edge
 * in the late token. The lane is aria-hidden; its header button opens the text table with every
 * value, the accessible form, which the panel draws under the lanes.
 */
function WorkloadLane({
  machine,
  buckets,
  scale,
  treeWidth,
  timeWidth,
  open,
  buttonId,
  dialogId,
  onOpenChange,
}: {
  readonly machine: { readonly code: string; readonly name: string };
  readonly buckets: readonly PlacedBucket[];
  readonly scale: TimeScale;
  readonly treeWidth: number;
  readonly timeWidth: number;
  readonly open: boolean;
  readonly buttonId: string;
  readonly dialogId: string;
  readonly onOpenChange: (open: boolean) => void;
}) {
  return (
    <div className="relative flex border-b border-border" style={{ height: `${laneHeightRem}rem` }}>
      <div
        className="sticky start-0 z-10 flex shrink-0 items-center border-e border-border bg-card px-2"
        style={{ width: `${treeWidth}px` }}
      >
        <Button
          id={buttonId}
          variant="ghost"
          className={cn('h-7 px-2 text-[0.8125rem] font-medium', open && 'bg-accent')}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? dialogId : undefined}
          onClick={() => onOpenChange(!open)}
        >
          Workload on {machine.name}
        </Button>
      </div>
      <div
        aria-hidden
        data-lane={machine.code}
        className="relative shrink-0 overflow-hidden"
        style={{ width: `${timeWidth}px` }}
      >
        {buckets.map(({ bucket, fromMs, toMs }) => {
          const left = scale.x(Math.max(fromMs, scale.range.fromMs));
          const width = Math.max(1, scale.x(Math.min(toMs, scale.range.toMs)) - left);
          if (bucket.availableS === 0) {
            return (
              <span
                key={bucket.productionDay}
                data-bucket={bucket.productionDay}
                data-closed
                className="absolute inset-y-0 bg-off-time"
                style={{ left: `${left}px`, width: `${width}px` }}
              />
            );
          }
          const utilization = Math.min(1, bucket.loadedS / bucket.availableS);
          const setupShare = bucket.loadedS === 0 ? 0 : bucket.setupS / bucket.loadedS;
          const overloadShare = bucket.overloadS / bucket.availableS;
          return (
            <span
              key={bucket.productionDay}
              data-bucket={bucket.productionDay}
              data-full={utilization >= 1 || undefined}
              className={cn(
                'absolute bottom-0 border-s border-card bg-foreground',
                utilization >= 1 ? 'opacity-100' : 'opacity-75',
              )}
              style={{ left: `${left}px`, width: `${width}px`, height: `${utilization * 100}%` }}
            >
              {setupShare > 0 && (
                <span
                  data-setup
                  className="absolute inset-x-0 bottom-0"
                  style={{
                    height: `${setupShare * 100}%`,
                    background:
                      'repeating-linear-gradient(135deg, var(--card) 0 2px, transparent 2px 5px)',
                  }}
                />
              )}
              {overloadShare > 0 && (
                <span
                  data-overload
                  className="absolute inset-x-0 bottom-full"
                  style={{
                    height: `${overloadShare * laneHeightRem}rem`,
                    background:
                      'repeating-linear-gradient(135deg, var(--late-foreground) 0 3px, var(--late) 3px 6px)',
                  }}
                />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** A cell of the lane's table: the row header for the first column, a cell otherwise. */
function TableCells({ cells }: { readonly cells: readonly string[] }) {
  return (
    <>
      {cells.map((cell, index) =>
        index === 0 ? (
          <th key={cell} scope="row" className="px-2 py-1 text-start font-medium">
            {cell}
          </th>
        ) : (
          <td
            key={`${tableHeaders[index]}-${cell}`}
            className="px-2 py-1 font-mono whitespace-nowrap"
          >
            {cell}
          </td>
        ),
      )}
    </>
  );
}

/**
 * The text table of a lane (plan 18, The workload lane): one row per bucket with available,
 * loaded, setup, run, free, utilization and overload, and a totals row over the visible range. A
 * dialog under the lanes that Escape closes, with focus back on the lane's button.
 */
function WorkloadTable({
  name,
  buckets,
  dialogId,
  buttonId,
  onClose,
}: {
  readonly name: string;
  readonly buckets: readonly PlacedBucket[];
  readonly dialogId: string;
  readonly buttonId: string;
  readonly onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialog.current?.focus();
  }, []);
  return (
    <div
      ref={dialog}
      id={dialogId}
      role="dialog"
      aria-label={name}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
          document.getElementById(buttonId)?.focus();
        }
      }}
      className="overflow-auto border-t border-border bg-popover p-2 text-popover-foreground outline-none"
    >
      <table className="text-xs" aria-label={name}>
        <caption className="sr-only">
          {name}, one row per production day in the visible range, with a totals row
        </caption>
        <thead>
          <tr>
            {tableHeaders.map((header) => (
              <th
                key={header}
                scope="col"
                className="bg-muted px-2 py-1 text-start font-medium text-muted-foreground"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {buckets.map(({ bucket }) => (
            <tr key={bucket.productionDay} className="border-t border-border">
              <TableCells cells={bucketRow(bucket)} />
            </tr>
          ))}
          <tr className="border-t border-border bg-muted font-semibold">
            <TableCells cells={totalsRow(buckets.map(({ bucket }) => bucket))} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * The workload panel docked at the bottom of the time area (plan 18, The workload lane): one lane
 * per machine the visible orders use, by production day at Week zoom, capped at 40 percent of the
 * view height and scrolling inside, with the open lane's table under the lanes.
 */
export function GanttWorkloadPanel({
  snapshot,
  scale,
  treeWidth,
  timeWidth,
}: {
  readonly snapshot: GanttSnapshot;
  readonly scale: TimeScale;
  readonly treeWidth: number;
  readonly timeWidth: number;
}) {
  const [openLane, setOpenLane] = useState<string | undefined>(undefined);
  const idBase = useId();
  const machines = laneMachines(snapshot);
  const open = machines.find((machine) => machine.code === openLane);
  return (
    <section
      aria-label="Workload"
      className="flex max-h-[40vh] flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <h2 className="border-b border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
        Workload by production day, committed plan
      </h2>
      <div className="min-h-0 overflow-auto">
        {machines.map((machine) => (
          <WorkloadLane
            key={machine.code}
            machine={machine}
            buckets={laneBuckets(snapshot, machine.code, scale)}
            scale={scale}
            treeWidth={treeWidth}
            timeWidth={timeWidth}
            open={openLane === machine.code}
            buttonId={`${idBase}-${machine.code}-button`}
            dialogId={`${idBase}-${machine.code}-table`}
            onOpenChange={(opened) => setOpenLane(opened ? machine.code : undefined)}
          />
        ))}
      </div>
      {open !== undefined && (
        <WorkloadTable
          name={`Workload on ${open.name}`}
          buckets={laneBuckets(snapshot, open.code, scale)}
          dialogId={`${idBase}-${open.code}-table`}
          buttonId={`${idBase}-${open.code}-button`}
          onClose={() => setOpenLane(undefined)}
        />
      )}
    </section>
  );
}
