// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ToolsPreview, ToolsSnapshot, ToolsSource } from './tools-data.ts';
import { g1ToolsSource } from './tools-data-g1.ts';

const ToolsSourceContext = createContext<ToolsSource>(g1ToolsSource);

/**
 * Hands the tools pages another data source than the fixture G1, as a test does with a
 * changed snapshot; the app renders none and the pages read the fixture.
 */
export const ToolsSourceProvider = ToolsSourceContext.Provider;

/** What a tools page has of its data. */
export interface ToolsState {
  readonly snapshot: ToolsSnapshot | undefined;
  /** The error of a failed load, while no snapshot is shown. */
  readonly error: unknown;
  /** Loads again; the page's Try again, which stays busy until the load has settled. */
  readonly retry: () => Promise<void>;
}

/**
 * The snapshot a tools page reads: one load through the seam, with the page state the URL's
 * preview asks the mock source for. A change of the preview loads again.
 */
export function useTools(preview: ToolsPreview | undefined): ToolsState {
  const source = useContext(ToolsSourceContext);
  const [snapshot, setSnapshot] = useState<ToolsSnapshot | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [attempt, setAttempt] = useState(0);
  /** Settles the promise of Try again once the load it started has settled. */
  const retryDone = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    setSnapshot(undefined);
    setError(undefined);
    source
      .load({ preview })
      .then((loaded) => {
        if (!cancelled) setSnapshot(loaded);
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(failure ?? new Error('The tools could not be loaded'));
      })
      .finally(() => {
        if (cancelled) return;
        retryDone.current?.();
        retryDone.current = undefined;
      });
    return () => {
      cancelled = true;
    };
  }, [source, preview, attempt]);
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
