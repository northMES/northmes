import { composeServices, compositionHasErrors } from "@theguild/federation-composition";
import { parse } from "graphql";

export interface ComposeInput {
  name: string;
  sdl: string;
  url: string;
  refTypes?: string[];
}

/** SDK-owned value types that every subgraph may emit (all @shareable). */
const SDK_SHARED = new Set(["PageInfo"]);

export class SupergraphCompositionError extends Error {
  constructor(readonly details: { message: string; code?: string }[]) {
    super(
      `Supergraph composition failed (${details.length} error${details.length === 1 ? "" : "s"}):\n` +
        details.map((d) => `  - [${d.code ?? "?"}] ${d.message}`).join("\n"),
    );
    this.name = "SupergraphCompositionError";
  }
}

const ROOTS = ["Query", "Mutation", "Subscription"];
const FEDERATION_ROOT_FIELDS = new Set(["_service", "_entities"]);

/** NorthMES rule: every root field starts with its subgraph (module) name. */
export function rootFieldPrefixErrors(subgraphs: ComposeInput[]): { message: string; code: string }[] {
  const errors: { message: string; code: string }[] = [];
  for (const s of subgraphs) {
    for (const def of parse(s.sdl).definitions as any[]) {
      if (!("name" in def) || !ROOTS.includes(def.name?.value) || !def.fields) continue;
      for (const f of def.fields) {
        const n = f.name.value as string;
        if (FEDERATION_ROOT_FIELDS.has(n)) continue;
        if (!n.startsWith(s.name) || !/^[A-Z]/.test(n.slice(s.name.length))) {
          errors.push({ code: "NORTHMES_ROOT_FIELD_PREFIX", message: `[${s.name}] ${def.name.value}.${n} must start with "${s.name}" followed by an upper-case letter` });
        }
      }
    }
  }
  return errors;
}

/**
 * NorthMES ownership rules on top of federation:
 * - a non-entity type or enum name lives in one subgraph only (SDK value types aside);
 * - fields a subgraph adds to an entity it only references must be nullable.
 */
export function ownershipErrors(subgraphs: ComposeInput[]): { message: string; code: string }[] {
  const errors: { message: string; code: string }[] = [];
  const seen = new Map<string, string>();
  for (const s of subgraphs) {
    const doc = parse(s.sdl);
    for (const def of doc.definitions as any[]) {
      const kind = def.kind as string;
      const name = def.name?.value as string | undefined;
      if (!name || ROOTS.includes(name) || name.startsWith("_") || /^(link__|federation__)/.test(name)) continue;
      if (!["ObjectTypeDefinition", "EnumTypeDefinition", "InputObjectTypeDefinition", "UnionTypeDefinition", "InterfaceTypeDefinition"].includes(kind)) continue;
      const isEntity = (def.directives ?? []).some((d: any) => d.name.value === "key");
      if (!isEntity && !SDK_SHARED.has(name)) {
        const prev = seen.get(name);
        if (prev && prev !== s.name) errors.push({ code: "NORTHMES_TYPE_OWNERSHIP", message: `${name} is defined in "${prev}" and "${s.name}"; one module owns a type (entities excepted)` });
        seen.set(name, s.name);
      }
      if (isEntity && s.refTypes?.includes(name)) {
        for (const f of def.fields ?? []) {
          const external = (f.directives ?? []).some((d: any) => d.name.value === "external");
          if (f.name.value === "id" || external) continue;
          if (f.type.kind === "NonNullType") {
            errors.push({ code: "NORTHMES_CONTRIBUTED_FIELD_NULLABLE", message: `[${s.name}] ${name}.${f.name.value} is added to an entity owned elsewhere and must be nullable` });
          }
        }
      }
    }
  }
  return errors;
}

/** Compose subgraph SDLs into a supergraph SDL, or throw one readable error. */
export function composeSupergraph(subgraphs: ComposeInput[]): string {
  const errors: { message: string; code?: string }[] = [...rootFieldPrefixErrors(subgraphs), ...ownershipErrors(subgraphs)];
  const result = composeServices(
    subgraphs.map((s) => ({ name: s.name, typeDefs: parse(s.sdl), url: s.url })),
  );
  if (compositionHasErrors(result)) {
    errors.push(...result.errors.map((e: any) => ({ message: e.message, code: e.extensions?.code })));
  }
  if (errors.length || compositionHasErrors(result)) throw new SupergraphCompositionError(errors);
  return result.supergraphSdl;
}
