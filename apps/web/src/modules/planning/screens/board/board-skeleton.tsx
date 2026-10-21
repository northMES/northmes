// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Skeleton } from '../../../../ui/primitives/skeleton.tsx';
import { timeHeaderHeightRem } from '../gantt/gantt-time-area.tsx';
import { boardRowRem } from './board-grid.tsx';

/** The rows the skeleton draws: a group band, then its machines, as the populated grid lays them. */
const skeletonRows = [
  'group',
  'machine',
  'machine',
  'machine',
  'group',
  'machine',
  'machine',
] as const;

/**
 * The board while it loads (design D3, DR17): the grid named after the plant and the range and
 * marked busy, with the time header, the Not placed row and skeleton rows in the populated layout.
 * The skeletons are hidden from assistive technology, and the grid has no Tab stop until it holds
 * cells.
 */
export function BoardSkeleton({
  name,
  machineWidth,
}: {
  readonly name: string;
  readonly machineWidth: number;
}) {
  const columns = `${machineWidth}px 1fr`;
  return (
    <div
      role="grid"
      aria-label={name}
      aria-busy="true"
      className="overflow-hidden rounded-lg border border-border bg-card text-sm"
    >
      <div
        aria-hidden
        className="grid border-b border-border bg-muted"
        style={{ gridTemplateColumns: columns, height: `${timeHeaderHeightRem}rem` }}
      >
        <div className="flex flex-col justify-center border-e border-border px-3">
          <span className="text-xs font-medium">Machines</span>
        </div>
        <div />
      </div>
      <div
        aria-hidden
        className="grid border-b border-border bg-lane-alt"
        style={{ gridTemplateColumns: columns, height: `${boardRowRem.notPlaced}rem` }}
      >
        <div className="flex items-center border-e border-border px-3">Not placed</div>
        <div className="flex items-center gap-2 px-2">
          <Skeleton data-skeleton className="h-7 w-24" />
          <Skeleton data-skeleton className="h-7 w-24" />
        </div>
      </div>
      {skeletonRows.map((kind, index) => (
        <div
          // The skeleton rows are a fixed list that never reorders.
          key={`${kind}-${index}`}
          aria-hidden
          className="grid border-b border-border"
          style={{ gridTemplateColumns: columns, height: `${boardRowRem[kind]}rem` }}
        >
          <div className="flex items-center px-3">
            <Skeleton data-skeleton className={kind === 'group' ? 'h-3 w-28' : 'h-3 w-20'} />
          </div>
          {kind === 'machine' && (
            <div className="flex items-center gap-6 px-6">
              <Skeleton data-skeleton className="h-9 w-40" />
              <Skeleton data-skeleton className="h-9 w-40" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
