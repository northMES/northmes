// SPDX-License-Identifier: MIT
import DataLoader from 'dataloader';
import type { SubgraphContext } from './context.ts';

/** A per-request batch loader. */
export interface Loader<K, V> {
  load(key: K): Promise<V>;
  loadMany(keys: readonly K[]): Promise<(V | Error)[]>;
}

/**
 * Loads the values of many keys in one call. It returns one entry per key in the order of the
 * keys: the value, or an Error for that key alone.
 */
export type BatchLoad<K, V> = (keys: readonly K[]) => Promise<readonly (V | Error)[]>;

/**
 * The request's loader named `name` (by convention `<module>.<entity>`), created with `batch` on
 * the first call in a request. Loads made in the same tick go to `batch` in one call.
 */
export function loaderFor<K, V>(
  context: SubgraphContext,
  name: string,
  batch: BatchLoad<K, V>,
): Loader<K, V> {
  const existing = context.loaders.get(name) as Loader<K, V> | undefined;
  if (existing) return existing;
  const dataLoader = new DataLoader<K, V>(batch);
  const loader: Loader<K, V> = {
    load: (key) => dataLoader.load(key),
    loadMany: (keys) => dataLoader.loadMany(keys),
  };
  context.loaders.set(name, loader);
  return loader;
}
