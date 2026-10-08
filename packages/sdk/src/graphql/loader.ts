// SPDX-License-Identifier: MIT
import DataLoader from 'dataloader';
import type { RequestContext } from './context.ts';

/** A per-request batch loader. */
export interface Loader<K, V> {
  load(key: K): Promise<V>;
  loadMany(keys: readonly K[]): Promise<(V | Error)[]>;
}

/**
 * Loads the values of many keys in one call. It returns one entry per key in the order of the
 * keys: the value, or an Error, such as a NOT_FOUND, that rejects that key alone.
 */
export type BatchLoad<K, R> = (keys: readonly K[]) => Promise<readonly R[]>;

/**
 * The request's loader named `name` (by convention `<module>.<entity>`), created with `batch` on
 * the first call in a request. Loads made in the same tick go to `batch` in one call. The loaded
 * value type leaves out the Error entries of the batch, so a batch of Article or GraphQLError
 * entries gives a loader of Article.
 */
export function loaderFor<K, R>(
  context: RequestContext,
  name: string,
  batch: BatchLoad<K, R>,
): Loader<K, Exclude<R, Error>> {
  type V = Exclude<R, Error>;
  const existing = context.loaders.get(name) as Loader<K, V> | undefined;
  if (existing) return existing;
  // R is V or an Error, which is the shape dataloader expects of a batch.
  const dataLoader = new DataLoader<K, V>(batch as BatchLoad<K, V | Error>);
  const loader: Loader<K, V> = {
    load: (key) => dataLoader.load(key),
    loadMany: (keys) => dataLoader.loadMany(keys),
  };
  context.loaders.set(name, loader);
  return loader;
}
