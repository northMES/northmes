import type { Type } from "@nestjs/common";
import { Directive, Field, ID, ObjectType } from "@nestjs/graphql";

/**
 * Shared value type. Defined once in the SDK, emitted by every subgraph that
 * uses it, so it must be @shareable and identical everywhere.
 */
@ObjectType("PageInfo")
@Directive("@shareable")
export class PageInfo {
  @Field(() => Boolean) hasNextPage: boolean;
  @Field(() => Boolean) hasPreviousPage: boolean;
  @Field(() => String, { nullable: true }) startCursor: string | null;
  @Field(() => String, { nullable: true }) endCursor: string | null;
}

/**
 * A by-name reference to an entity owned by another subgraph. The plugin never
 * imports the owner's class; it only names the type and its key, which is the
 * federation contract. `external` lists owner fields this subgraph may @require.
 */
/** Entity stubs by owning Nest module thunk; added as orphanedTypes so code-first keeps them. */
export const entityRefs: { type: Type; registerIn: () => Type }[] = [];

export function entityRef(
  typeName: string,
  registerIn: () => Type,
  opts: { key?: string; external?: Record<string, { type: () => unknown; nullable?: boolean }> } = {},
): Type<{ id: string } & Record<string, unknown>> {
  const Ref = { [typeName]: class {} }[typeName] as Type<any>;
  Field(() => ID)(Ref.prototype, "id");
  for (const [field, def] of Object.entries(opts.external ?? {})) {
    // Must match the owner's type exactly, nullability included; composition checks it.
    Field(def.type as any, { nullable: def.nullable ?? false })(Ref.prototype, field);
    Directive("@external")(Ref.prototype, field);
  }
  Directive(`@key(fields: "${opts.key ?? "id"}")`)(Ref);
  ObjectType(typeName, { registerIn })(Ref);
  entityRefs.push({ type: Ref, registerIn });
  return Ref;
}

/** Relay connection for one node type, owned by the subgraph that owns the node. */
export function connectionOf<T>(node: Type<T>, nodeName: string, registerIn: () => Type) {
  const Edge = { [`${nodeName}Edge`]: class {} }[`${nodeName}Edge`] as Type<any>;
  Field(() => String)(Edge.prototype, "cursor");
  Field(() => node)(Edge.prototype, "node");
  ObjectType(`${nodeName}Edge`, { registerIn })(Edge);

  const Conn = { [`${nodeName}Connection`]: class {} }[`${nodeName}Connection`] as Type<any>;
  Field(() => [Edge])(Conn.prototype, "edges");
  Field(() => PageInfo)(Conn.prototype, "pageInfo");
  ObjectType(`${nodeName}Connection`, { registerIn })(Conn);
  return Conn as Type<{ edges: { cursor: string; node: T }[]; pageInfo: PageInfo }>;
}

export function toConnection<T extends { id: string }>(rows: T[], first: number) {
  const page = rows.slice(0, first);
  return {
    edges: page.map((node) => ({ cursor: node.id, node })),
    pageInfo: {
      hasNextPage: rows.length > first,
      hasPreviousPage: false,
      startCursor: page[0]?.id ?? null,
      endCursor: page.at(-1)?.id ?? null,
    },
  };
}
