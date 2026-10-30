// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Loading by time chunk (ADR 0089): the board and the Gantt load the job orders of the chunks their
// time buffer touches, the chunks in view first and one ahead on each side, keep what they loaded
// while the buffer moves over it, and drop a chunk more than two buffer widths away unless it holds
// a job order the view keeps.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GanttChunk, GanttJobOrder, ZoomLevel } from '../gantt-data.ts';
import { isPlanningRefusal } from '../planning-preview.ts';
import {
  type ChunkUnit,
  chunkUnitOf,
  isFarChunk,
  type TimeChunk,
  wantedChunks,
} from './time-chunks.ts';
import type { TimeRange } from './time-scale.ts';

/** Reads the job orders of a chunk, [from, to) as ISO 8601 instants. */
export type LoadChunk = (from: string, to: string) => Promise<GanttChunk>;

/**
 * Where a chunk stands: loading, loaded, failed (Try again loads it again), or refused because it
 * holds more job orders than the board shows at once (`planning.board.range_too_large`).
 */
export type ChunkStatus = 'loading' | 'loaded' | 'failed' | 'refused';

export interface ChunkEntry extends TimeChunk {
  readonly status: ChunkStatus;
  readonly jobOrders: readonly GanttJobOrder[];
  /** The error of a failed load, which tells a refused permission from a failure. */
  readonly error?: unknown;
}

export interface TimeChunksInput {
  /** The source's read, the same function while the source and the filter stay. */
  readonly load: LoadChunk;
  readonly zoom: ZoomLevel;
  readonly timeZone: string;
  /** The time buffer, or none while the time area has no width. */
  readonly buffer: TimeRange | undefined;
  /** The span in view, whose chunks load first. */
  readonly view: TimeRange | undefined;
  /** The job orders the view keeps, the focused one and those of the selected order. */
  readonly keep?: ReadonlySet<string>;
}

export interface TimeChunks {
  /** The chunks in the cache, in time order. */
  readonly chunks: readonly ChunkEntry[];
  /** The job orders of the loaded chunks, each once. */
  readonly jobOrders: readonly GanttJobOrder[];
  /** Loads failed chunks again, Try again's action. */
  readonly retry: (keys: readonly string[]) => void;
}

/** The cache of one source and filter at one chunk length and plant zone. */
interface ChunkCache {
  readonly load: LoadChunk;
  readonly unit: ChunkUnit;
  /** The plant's zone, whose plant dates the chunks are aligned to. */
  readonly timeZone: string;
  /** A new object per cache, so an answer lands only in the cache its load started in. */
  readonly generation: object;
  readonly entries: ReadonlyMap<string, ChunkEntry>;
  /**
   * The chunks a new source still has to load again: their entries keep the job orders of the
   * source before, so the blocks stay drawn until the fresh answer replaces them.
   */
  readonly stale: ReadonlySet<string>;
  /** The loaded chunks whose fresh answer is on its way. */
  readonly refreshing: ReadonlySet<string>;
  /**
   * The job orders of the chunk length before, drawn while the chunks of a new length load, so a
   * zoom keeps its blocks and the focus on them; gone once no chunk is loading.
   */
  readonly carried: readonly GanttJobOrder[];
}

const noKeys: ReadonlySet<string> = new Set();

function newCache(
  load: LoadChunk,
  unit: ChunkUnit,
  timeZone: string,
  entries: ReadonlyMap<string, ChunkEntry> = new Map(),
  carried: readonly GanttJobOrder[] = [],
): ChunkCache {
  const loaded = [...entries.values()].filter((entry) => entry.status === 'loaded');
  return {
    load,
    unit,
    timeZone,
    generation: {},
    entries: new Map(loaded.map((entry) => [entry.key, entry])),
    stale: new Set(loaded.map((entry) => entry.key)),
    refreshing: noKeys,
    carried,
  };
}

/** The job orders of a cache's loaded chunks and those it carries, each once. */
function drawnJobOrders(cache: ChunkCache): GanttJobOrder[] {
  const byId = new Map<string, GanttJobOrder>();
  for (const row of cache.carried) byId.set(row.id, row);
  for (const entry of cache.entries.values())
    for (const row of entry.jobOrders) byId.set(row.id, row);
  return [...byId.values()];
}

/** The cache with a chunk's answer set, if the cache is still the one the load started in. */
function answered(
  cache: ChunkCache,
  generation: object,
  key: string,
  update: (entry: ChunkEntry) => ChunkEntry,
): ChunkCache {
  const entry = cache.entries.get(key);
  if (cache.generation !== generation || entry === undefined) return cache;
  if (entry.status !== 'loading' && !cache.refreshing.has(key)) return cache;
  const entries = new Map(cache.entries);
  entries.set(key, update(entry));
  const refreshing = new Set(cache.refreshing);
  refreshing.delete(key);
  const loading = [...entries.values()].some((each) => each.status === 'loading');
  return { ...cache, entries, refreshing, carried: loading ? cache.carried : [] };
}

/** The time chunks of a view and the job orders they hold (ADR 0089, Loading by time chunk). */
export function useTimeChunks({
  load,
  zoom,
  timeZone,
  buffer,
  view,
  keep,
}: TimeChunksInput): TimeChunks {
  const unit = chunkUnitOf(zoom);
  const [stored, setCache] = useState<ChunkCache>(() => newCache(load, unit, timeZone));
  // A new plant zone starts an empty cache. A new chunk length starts one that draws the job orders
  // before until its chunks load, and a new source or filter one that loads its chunks again while
  // it draws the ones before, as React's rule for state from props says: a cached chunk is valid
  // only within its chunk length and the plant dates it is aligned to (ADR 0089).
  let cache = stored;
  if (cache.timeZone !== timeZone) {
    cache = newCache(load, unit, timeZone);
    setCache(cache);
  } else if (cache.unit !== unit) {
    cache = newCache(load, unit, timeZone, undefined, drawnJobOrders(cache));
    setCache(cache);
  } else if (cache.load !== load) {
    cache = newCache(load, unit, timeZone, cache.entries);
    setCache(cache);
  }

  const wanted = useMemo(
    () =>
      buffer === undefined || view === undefined
        ? []
        : wantedChunks({ view, buffer, zoom, timeZone }),
    [buffer, view, zoom, timeZone],
  );

  /** Starts the load of a chunk, whose answer lands only in the cache it started in. */
  const start = useCallback((from: ChunkCache, chunk: TimeChunk) => {
    const { load: read, generation } = from;
    read(new Date(chunk.fromMs).toISOString(), new Date(chunk.toMs).toISOString())
      .then(({ jobOrders }) =>
        setCache((current) =>
          answered(current, generation, chunk.key, (entry) => {
            const { error: _, ...rest } = entry;
            return { ...rest, status: 'loaded', jobOrders };
          }),
        ),
      )
      .catch((error: unknown) => {
        const status = isPlanningRefusal(error, 'planning.board.range_too_large')
          ? 'refused'
          : 'failed';
        setCache((current) =>
          answered(current, generation, chunk.key, (entry) => ({
            ...entry,
            status,
            jobOrders: [],
            error,
          })),
        );
      });
  }, []);

  // Each update changes only the chunks it names, so an answer queued meanwhile is kept.
  useEffect(() => {
    const missing = wanted.filter(
      (chunk) => !cache.entries.has(chunk.key) || cache.stale.has(chunk.key),
    );
    // A chunk the view wants is never far, also one ahead of a buffer shorter than a chunk.
    const wantedKeys = new Set(wanted.map((chunk) => chunk.key));
    const far =
      buffer === undefined
        ? []
        : [...cache.entries.values()].filter(
            (entry) =>
              !wantedKeys.has(entry.key) &&
              isFarChunk(entry, buffer) &&
              !entry.jobOrders.some((row) => keep?.has(row.id) === true),
          );
    if (missing.length === 0 && far.length === 0) {
      // Nothing is left to load at the new chunk length, so what it carried goes.
      const loading = [...cache.entries.values()].some((entry) => entry.status === 'loading');
      if (cache.carried.length > 0 && !loading) {
        const { generation } = cache;
        setCache((current) =>
          current.generation === generation ? { ...current, carried: [] } : current,
        );
      }
      return;
    }
    const { generation } = cache;
    setCache((current) => {
      if (current.generation !== generation) return current;
      const entries = new Map(current.entries);
      const stale = new Set(current.stale);
      const refreshing = new Set(current.refreshing);
      for (const entry of far) {
        entries.delete(entry.key);
        stale.delete(entry.key);
        refreshing.delete(entry.key);
      }
      for (const chunk of missing) {
        // A stale chunk keeps drawing its job orders until its fresh answer comes.
        if (stale.delete(chunk.key)) refreshing.add(chunk.key);
        else if (!entries.has(chunk.key)) {
          entries.set(chunk.key, { ...chunk, status: 'loading', jobOrders: [] });
        }
      }
      return { ...current, entries, stale, refreshing };
    });
    for (const chunk of missing) start(cache, chunk);
  }, [cache, wanted, buffer, keep, start]);

  const retry = useCallback(
    (keys: readonly string[]) => {
      const again = keys
        .map((key) => cache.entries.get(key))
        .filter((entry): entry is ChunkEntry => entry?.status === 'failed');
      if (again.length === 0) return;
      const { generation } = cache;
      setCache((current) => {
        if (current.generation !== generation) return current;
        const entries = new Map(current.entries);
        for (const entry of again) {
          if (entries.get(entry.key)?.status !== 'failed') continue;
          const { error: _, ...rest } = entry;
          entries.set(entry.key, { ...rest, status: 'loading', jobOrders: [] });
        }
        return { ...current, entries };
      });
      for (const entry of again) start(cache, entry);
    },
    [cache, start],
  );

  const chunks = useMemo(
    () => [...cache.entries.values()].sort((a, b) => a.fromMs - b.fromMs),
    [cache.entries],
  );
  const jobOrders = useMemo(() => {
    const byId = new Map<string, GanttJobOrder>();
    for (const row of cache.carried) byId.set(row.id, row);
    for (const entry of chunks) for (const row of entry.jobOrders) byId.set(row.id, row);
    return [...byId.values()];
  }, [chunks, cache.carried]);
  return { chunks, jobOrders, retry };
}
