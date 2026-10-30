// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Button } from '../../../../ui/primitives/button.tsx';
import { rowHeightRem } from './gantt-rows.ts';

const text = {
  idle: (loaded: number, total: string) =>
    `${loaded} of ${total} orders loaded. Scroll down for more.`,
  loading: (loaded: number, total: string) => `Loading more orders: ${loaded} of ${total} loaded.`,
  failed: (loaded: number, total: string) =>
    `Orders could not be loaded: ${loaded} of ${total} loaded.`,
} as const;

/**
 * The row under the loaded rows while the row list has more pages (ADR 0089, Loading by time
 * chunk): how many orders are loaded, the next page loading, or a failed page with Try again;
 * the Gantt says a page loading or failing as a polite status message.
 */
export function GanttMoreRows({
  rowIndex,
  state,
  loaded,
  total,
  gridTemplateColumns,
  onRetry,
}: {
  readonly rowIndex: number;
  readonly state: 'idle' | 'loading' | 'failed';
  readonly loaded: number;
  readonly total: number | undefined;
  readonly gridTemplateColumns: string;
  readonly onRetry: () => void;
}) {
  const totalText = total === undefined ? 'all' : String(total);
  return (
    <div
      role="row"
      aria-rowindex={rowIndex}
      data-more-rows={state}
      className="grid w-max min-w-full border-b border-border"
      style={{ gridTemplateColumns, height: `${rowHeightRem.order}rem` }}
    >
      <div
        role="gridcell"
        className="sticky start-0 flex items-center gap-2 px-2 text-xs text-muted-foreground"
        style={{ gridColumn: '1 / -1' }}
      >
        <span>{text[state](loaded, totalText)}</span>
        {state === 'failed' && (
          <Button variant="outline" aria-label="Try again: orders" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
