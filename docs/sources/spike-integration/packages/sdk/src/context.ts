// Sketch of what @northmes/sdk (MIT) would export for GraphQL context and auth.
// Module authors never build this object; the gateway transport does, once per
// subgraph request, from the principal the gateway resolved once per client request.

export interface Principal {
  userId: string;
  /** Plants this principal may act at (from plant_member). */
  plantIds: string[];
  /** Active plant chosen in the UI; every query is scoped to it. */
  activePlantId: string;
  /** Effective permissions at the active plant, e.g. "planning.productionOrder:read". */
  permissions: ReadonlySet<string>;
}

/** The context every subgraph resolver receives. */
export interface SubgraphContext {
  principal: Principal | null;
  requestId: string;
  /** Per-request cache for DataLoaders, keyed by loader name. Created fresh per gateway request. */
  loaders: Map<string, unknown>;
  /** Which subgraph this execution belongs to (useful in logs). */
  subgraph: string;
}

export function loaderFor<K, V>(
  ctx: SubgraphContext,
  name: string,
  create: () => { load(key: K): Promise<V> },
): { load(key: K): Promise<V> } {
  let loader = ctx.loaders.get(name) as { load(key: K): Promise<V> } | undefined;
  if (!loader) {
    loader = create();
    ctx.loaders.set(name, loader);
  }
  return loader;
}
