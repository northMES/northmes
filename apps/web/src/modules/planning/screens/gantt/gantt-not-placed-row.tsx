// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Badge } from '../../../../ui/primitives/badge.tsx';
import type { JobOrderRow } from './gantt-rows.ts';
import { timeHeaderHeightRem } from './gantt-time-area.tsx';

/** The height of the Not placed row, which the grid's scroll padding keeps focus clear of. */
export const notPlacedHeightRem = 2;

/**
 * The pinned Not placed row under the time header (plan 18, Rows and the tree): every job order
 * without a machine or a setup start, as on the board, or the line that none is missing a place.
 */
export function GanttNotPlacedRow({
  rows,
  gridTemplateColumns,
}: {
  readonly rows: readonly JobOrderRow[];
  /** The tree pane's track and the time track, as every row of the grid has them. */
  readonly gridTemplateColumns: string;
}) {
  return (
    <div
      role="row"
      aria-rowindex={2}
      // As wide as its tracks, as GanttRowView's rows are (#890). Above the data rows' tree panes
      // (z-10), which scroll up under it, and below the time header (z-20) (#911).
      className="sticky z-15 grid w-max min-w-full border-b border-border bg-lane-alt"
      style={{
        gridTemplateColumns,
        top: `${timeHeaderHeightRem}rem`,
        height: `${notPlacedHeightRem}rem`,
      }}
    >
      {/* The row header takes the tree pane's track and sticks with it (#943). */}
      <div
        role="rowheader"
        className="sticky start-0 z-10 flex items-center border-e border-border bg-lane-alt px-2 text-xs font-medium"
      >
        Not placed
      </div>
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
