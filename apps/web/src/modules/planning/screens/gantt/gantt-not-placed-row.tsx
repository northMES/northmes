// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Badge } from '../../../../ui/primitives/badge.tsx';
import type { JobOrderRow } from './gantt-rows.ts';

/**
 * The pinned Not placed row under the time header (plan 18, Rows and the tree): every job order
 * without a machine or a setup start, as on the board, or the line that none is missing a place.
 */
export function GanttNotPlacedRow({
  rows,
  gridTemplateColumns,
  columnCount,
  stickyTree,
}: {
  readonly rows: readonly JobOrderRow[];
  readonly gridTemplateColumns: string;
  /** How many tree columns the row takes before its list. */
  readonly columnCount: number;
  /**
   * Whether every tree cell sticks (see GanttRowView). When only the Name column sticks, the row
   * header spans the Name track alone and the other tree tracks scroll away, so the list comes into
   * view on a narrow grid.
   */
  readonly stickyTree: boolean;
}) {
  const headerSpan = stickyTree ? columnCount : 1;
  return (
    <div
      role="row"
      aria-rowindex={2}
      // As wide as its tracks, as GanttRowView's rows are (#890). Above the data rows' sticky tree
      // cells (z-10), which scroll up under it, and below the time header (z-20) (#911).
      className="sticky top-12 z-15 grid h-8 w-max min-w-full border-b border-border bg-lane-alt"
      style={{ gridTemplateColumns }}
    >
      <div
        role="rowheader"
        className="sticky start-0 z-10 flex items-center border-e border-border bg-lane-alt px-2 text-xs font-medium"
        style={{ gridColumn: `span ${headerSpan}` }}
      >
        Not placed
      </div>
      {headerSpan < columnCount && (
        <div
          aria-hidden
          className="border-e border-border"
          style={{ gridColumn: `span ${columnCount - headerSpan}` }}
        />
      )}
      <div
        role="gridcell"
        className="flex items-center gap-1.5 overflow-hidden px-2 text-xs text-muted-foreground"
      >
        {rows.length === 0
          ? 'No job orders without a place'
          : rows.map((row) => (
              <Badge key={row.id} variant="outline" className="font-mono">
                {row.jobOrder.displayNumber}
              </Badge>
            ))}
      </div>
    </div>
  );
}
