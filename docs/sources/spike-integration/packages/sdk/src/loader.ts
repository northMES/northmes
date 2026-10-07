/** Minimal batching loader (stand-in for dataloader): one batch per tick per request. */
export function batchLoader<K, V>(batch: (keys: readonly K[]) => Promise<(V | null)[]>) {
  let queue: { key: K; resolve: (v: V | null) => void; reject: (e: unknown) => void }[] = [];
  const cache = new Map<K, Promise<V | null>>();
  return {
    load(key: K): Promise<V | null> {
      const hit = cache.get(key);
      if (hit) return hit;
      const p = new Promise<V | null>((resolve, reject) => {
        queue.push({ key, resolve, reject });
        if (queue.length === 1) {
          queueMicrotask(async () => {
            const current = queue;
            queue = [];
            try {
              const values = await batch(current.map((q) => q.key));
              current.forEach((q, i) => q.resolve(values[i] ?? null));
            } catch (e) {
              current.forEach((q) => q.reject(e));
            }
          });
        }
      });
      cache.set(key, p);
      return p;
    },
  };
}
