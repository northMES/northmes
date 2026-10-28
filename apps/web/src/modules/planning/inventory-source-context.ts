// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { InventoryPreview, InventorySnapshot, InventorySource } from './inventory-data.ts';
import { g1InventorySource } from './inventory-data-g1.ts';

const InventorySourceContext = createContext<InventorySource>(g1InventorySource);

/**
 * Hands the stock pages another data source than the fixture G1, as a test does with a
 * changed snapshot; the app renders none and the pages read the fixture.
 */
export const InventorySourceProvider = InventorySourceContext.Provider;

/** What a stock page has of its data. */
export interface InventoryState {
  readonly snapshot: InventorySnapshot | undefined;
  /** The error of a failed load, while no snapshot is shown. */
  readonly error: unknown;
  /** Loads again; the page's Try again, which stays busy until the load has settled. */
  readonly retry: () => Promise<void>;
}

/**
 * The snapshot a stock page reads: one load through the seam, with the page state the URL's
 * preview asks the mock source for. A change of the preview loads again.
 */
export function useInventory(preview: InventoryPreview | undefined): InventoryState {
  const source = useContext(InventorySourceContext);
  const [snapshot, setSnapshot] = useState<InventorySnapshot | undefined>(undefined);
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
        if (!cancelled) setError(failure ?? new Error('The stock could not be loaded'));
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
