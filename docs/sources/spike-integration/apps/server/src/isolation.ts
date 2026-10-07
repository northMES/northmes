import type { INestApplication, Type } from "@nestjs/common";
import { ModulesContainer } from "@nestjs/core";
import type { LoadedCatalog } from "./tokens.js";

const RESOLVER_TYPE_METADATA = "graphql:resolver_type"; // @nestjs/graphql 14 constant, by value

/**
 * @nestjs/graphql builds a subgraph from its `include` module plus everything that module imports,
 * transitively. A module that imports another module's resolver-bearing Nest module would pull those
 * resolvers into its own subgraph. Name the import instead of failing later with a schema error.
 */
export function resolverIsolationProblems(app: INestApplication, catalog: LoadedCatalog): string[] {
  const container = app.get(ModulesContainer);
  const moduleOf = new Map<Type, string>([...catalog.serverModules].map(([id, cls]) => [cls, id]));
  const refs = [...container.values()];
  const hasResolvers = (ref: (typeof refs)[number]) =>
    [...ref.providers.values()].some((w) => w.metatype && Reflect.getMetadata(RESOLVER_TYPE_METADATA, w.metatype as object));
  const problems: string[] = [];
  for (const [cls, id] of moduleOf) {
    const root = refs.find((r) => r.metatype === cls);
    if (!root) continue;
    const seen = new Set<typeof root>();
    const walk = (ref: typeof root, path: string[]) => {
      if (seen.has(ref)) return;
      seen.add(ref);
      for (const imp of ref.imports) {
        const owner = moduleOf.get(imp.metatype as Type);
        const name = (imp.metatype as Type)?.name ?? "?";
        if (imp.isGlobal) {
          if (hasResolvers(imp)) problems.push(`global module ${name} holds resolvers; they would join every subgraph`);
          continue;
        }
        if (owner && owner !== id && hasResolvers(imp)) {
          problems.push(`${id} imports ${[...path, name].join(" -> ")} from ${owner}, which holds resolvers; import ${owner}'s API module instead`);
        }
        walk(imp, [...path, name]);
      }
    };
    walk(root, []);
  }
  return [...new Set(problems)];
}
