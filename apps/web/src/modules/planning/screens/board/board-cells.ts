// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { TimeScale } from '../../timeline/time-scale.ts';
import type { JobOrderRow } from '../gantt/gantt-rows.ts';

/** The least width of a target on the board, in px (plan 07, Targets and density; WCAG 2.5.8). */
export const minTargetPx = 24;

/** A cell of a machine row: one job order, or a cluster of job orders too narrow to tell apart. */
export type BoardCellItem =
  | {
      readonly kind: 'block';
      readonly row: JobOrderRow;
      readonly left: number;
      readonly width: number;
    }
  | {
      readonly kind: 'cluster';
      /** The cluster's key, from its first job order. */
      readonly key: string;
      readonly rows: readonly JobOrderRow[];
      readonly left: number;
      readonly width: number;
      readonly fromMs: number;
      readonly toMs: number;
    };

/**
 * The cells of a machine row at a scale (plan 07, Targets and density; design D3, BO12): a job
 * order under 24 px wide starts a target 24 px wide, and every job order that starts inside it
 * joins it, so the cluster's name can carry their counts; a narrow job order alone keeps its own
 * cell at 24 px. The cells keep time order, so the arrow keys and a screen reader meet them left
 * to right.
 */
export function cellsOf(blocks: readonly JobOrderRow[], scale: TimeScale): BoardCellItem[] {
  const cells: BoardCellItem[] = [];
  let open:
    | { rows: JobOrderRow[]; left: number; right: number; fromMs: number; toMs: number }
    | undefined;
  const close = () => {
    if (open === undefined) return;
    const [first] = open.rows;
    if (open.rows.length === 1 && first !== undefined) {
      cells.push({ kind: 'block', row: first, left: open.left, width: open.right - open.left });
    } else if (first !== undefined) {
      cells.push({
        kind: 'cluster',
        key: `cluster:${first.jobOrder.id}`,
        rows: open.rows,
        left: open.left,
        width: open.right - open.left,
        fromMs: open.fromMs,
        toMs: open.toMs,
      });
    }
    open = undefined;
  };
  for (const row of blocks) {
    const placement = row.jobOrder.placement;
    if (placement === undefined) continue;
    const left = scale.x(Math.max(placement.setupStartMs, scale.range.fromMs));
    const right = scale.x(Math.min(placement.endMs, scale.range.toMs));
    if (open !== undefined && left < open.right) {
      open.rows.push(row);
      open.right = Math.max(open.right, right);
      open.toMs = Math.max(open.toMs, placement.endMs);
      continue;
    }
    close();
    if (right - left < minTargetPx) {
      open = {
        rows: [row],
        left,
        right: Math.max(right, left + minTargetPx),
        fromMs: placement.setupStartMs,
        toMs: placement.endMs,
      };
    } else {
      cells.push({ kind: 'block', row, left, width: Math.max(2, right - left) });
    }
  }
  close();
  return cells;
}
