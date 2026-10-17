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
}: {
  readonly rows: readonly JobOrderRow[];
  readonly gridTemplateColumns: string;
  /** How many tree columns the row header spans. */
  readonly columnCount: number;
}) {
  return (
    <div
      role="row"
      aria-rowindex={2}
      className="grid h-8 border-b border-border bg-lane-alt"
      style={{ gridTemplateColumns }}
    >
      <div
        role="rowheader"
        className="flex items-center border-e border-border px-2 text-xs font-medium"
        style={{ gridColumn: `span ${columnCount}` }}
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
