// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cn } from 'cn';
import { useEffect } from 'react';
import { announce } from '../../../../ui/lib/announce.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import { chunkName } from '../../timeline/time-chunks.ts';
import type { TimeRange, TimeScale } from '../../timeline/time-scale.ts';
import type { ChunkEntry } from '../../timeline/use-time-chunks.ts';

/** The chunks of a time buffer that are not loaded: loading, failed or refused. */
export function unloadedChunks(
  chunks: readonly ChunkEntry[],
  buffer: TimeRange | undefined,
): ChunkEntry[] {
  if (buffer === undefined) return [];
  return chunks.filter(
    (chunk) =>
      chunk.status !== 'loaded' && chunk.fromMs < buffer.toMs && chunk.toMs > buffer.fromMs,
  );
}

const bandText = {
  loading: 'Loading job orders',
  failed: 'Job orders not loaded',
  refused: 'Too many job orders: narrow the filter or zoom in',
} as const;

/**
 * The tone and pattern of each band, translucent so a focus ring or a block's end under it still
 * shows: stripes while loading, which stop under reduced motion like every pulse here.
 */
const bandClass = {
  loading: 'gantt-gap opacity-70 motion-safe:animate-pulse',
  failed: 'bg-destructive-subtle/70',
  refused: 'bg-warning-subtle/70 border-dashed',
} as const;

/**
 * The bands over the rows' time cells of the chunks that are not loaded (ADR 0089, Loading by time
 * chunk): loading, failed, or refused as too large, so a chunk without its job orders never looks
 * like empty rows. Drawn for sight; ChunkStatus says the same in words. The label sticks under the
 * rows that stick at the grid's top, `labelTop` from it.
 */
export function ChunkBands({
  chunks,
  scale,
  labelTop,
}: {
  readonly chunks: readonly ChunkEntry[];
  readonly scale: TimeScale;
  readonly labelTop: string;
}) {
  return (
    <>
      {chunks.map((chunk) => {
        if (chunk.status === 'loaded') return null;
        const left = scale.x(Math.max(chunk.fromMs, scale.range.fromMs));
        const right = scale.x(Math.min(chunk.toMs, scale.range.toMs));
        return (
          <div
            key={chunk.key}
            data-chunk-band={chunk.status}
            data-chunk={chunk.key}
            className={cn(
              'absolute top-0 bottom-0 border-x border-border',
              bandClass[chunk.status],
            )}
            style={{ left: `${left}px`, width: `${Math.max(0, right - left)}px` }}
          >
            <span
              className="sticky block px-2 py-1 text-xs font-medium text-foreground"
              style={{ top: labelTop }}
            >
              {bandText[chunk.status]}
            </span>
          </div>
        );
      })}
    </>
  );
}

/** "W45, Mon 2 Nov to Sun 8 Nov and W46, Mon 9 Nov to Sun 15 Nov": the chunks a sentence names. */
function namesOf(chunks: readonly ChunkEntry[], timeZone: string): string {
  const names = chunks.map((chunk) => chunkName(chunk, timeZone));
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * What the bands show, in words, said as a polite status message when it changes (ADR 0089): the
 * chunks still loading, those that failed, with Try again, and those refused as too large.
 */
export function ChunkStatus({
  chunks,
  timeZone,
  onRetry,
}: {
  readonly chunks: readonly ChunkEntry[];
  readonly timeZone: string;
  readonly onRetry: (keys: readonly string[]) => void;
}) {
  const of = (status: ChunkEntry['status']) => chunks.filter((chunk) => chunk.status === status);
  const loading = of('loading');
  const failed = of('failed');
  const refused = of('refused');
  const text = [
    ...(loading.length > 0 ? [`Loading the job orders of ${namesOf(loading, timeZone)}.`] : []),
    ...(failed.length > 0
      ? [`The job orders of ${namesOf(failed, timeZone)} could not be loaded.`]
      : []),
    ...(refused.length > 0
      ? [
          `${namesOf(refused, timeZone)} ${refused.length === 1 ? 'holds' : 'hold'} more job orders than the view shows at once: narrow the filter or zoom in.`,
        ]
      : []),
  ].join(' ');
  useEffect(() => {
    if (text !== '') announce(text);
  }, [text]);
  return (
    <div className="flex min-h-6 flex-wrap items-center gap-2">
      <p data-chunk-status className="text-xs text-muted-foreground">
        {text}
      </p>
      {failed.length > 0 && (
        <Button
          variant="outline"
          aria-label="Try again: job orders"
          onClick={() => onRetry(failed.map((chunk) => chunk.key))}
        >
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * A page of the row list that failed beside the rows shown, said as a polite status message, with
 * Try again (ADR 0089): on the board, which loads every page.
 */
export function RowsStatus({
  loaded,
  total,
  onRetry,
}: {
  readonly loaded: number;
  readonly total: number | undefined;
  readonly onRetry: () => void;
}) {
  const text = `Orders could not be loaded: ${loaded} of ${total ?? 'all'} loaded.`;
  useEffect(() => {
    announce(text);
  }, [text]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p data-rows-status className="text-xs text-muted-foreground">
        {text}
      </p>
      <Button variant="outline" aria-label="Try again: orders" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
