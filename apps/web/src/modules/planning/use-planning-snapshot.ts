// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useEffect, useRef, useState } from 'react';
import type { GanttSnapshot } from './gantt-data.ts';
import { useGanttSource } from './gantt-source-context.ts';

/** What a planning page that shows records, not a range, has of the plan. */
export interface PlanningSnapshotState {
  readonly snapshot: GanttSnapshot | undefined;
  /** The error of a failed load, while no snapshot is shown. */
  readonly error: unknown;
  /** Loads again; the page's Try again, which stays busy until the load has settled. */
  readonly retry: () => Promise<void>;
}

const day = 86_400_000;

/**
 * The snapshot a record page reads (the production order page, the lists): one load through the
 * data seam over the weeks around today, which covers the fixture's week and every placement the
 * mock source lays over its calendar. A server source answers the records a page asks for; the
 * range is the mock source's way of answering everything at once.
 */
export function usePlanningSnapshot(): PlanningSnapshotState {
  const source = useGanttSource();
  const [snapshot, setSnapshot] = useState<GanttSnapshot | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [attempt, setAttempt] = useState(0);
  /** Settles the promise of Try again once the load it started has settled. */
  const retryDone = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    setError(undefined);
    const now = Date.now();
    source
      .load({
        from: new Date(now - 28 * day).toISOString(),
        to: new Date(now + 56 * day).toISOString(),
        filter: {},
      })
      .then((loaded) => {
        if (!cancelled) setSnapshot(loaded);
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(failure ?? new Error('The plan could not be loaded'));
      })
      .finally(() => {
        if (cancelled) return;
        retryDone.current?.();
        retryDone.current = undefined;
      });
    return () => {
      cancelled = true;
    };
  }, [source, attempt]);
  return {
    snapshot,
    error,
    retry: () =>
      new Promise<void>((resolve) => {
        retryDone.current = resolve;
        setAttempt((count) => count + 1);
      }),
  };
}
