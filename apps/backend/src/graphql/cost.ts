// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import {
  type DocumentNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type GraphQLField,
  type GraphQLNamedType,
  type GraphQLSchema,
  getNamedType,
  getNullableType,
  getOperationAST,
  isCompositeType,
  isInterfaceType,
  isListType,
  isObjectType,
  Kind,
  type SelectionSetNode,
  valueFromAST,
} from 'graphql';

/** The arguments that set how many items a list or connection field returns (ADR 0016). */
const slicingArguments = ['first', 'last'] as const;

/** The field of a connection that holds its items, sized by the connection's first or last. */
const sizedField = 'edges';

interface CostWalk {
  readonly schema: GraphQLSchema;
  readonly fragments: ReadonlyMap<string, FragmentDefinitionNode>;
  readonly variables: Readonly<Record<string, unknown>>;
  readonly defaultListSize: number;
}

/** The fields of an object or interface type, and none for a union. */
function fieldsOf(
  type: GraphQLNamedType | undefined,
): Record<string, GraphQLField<unknown, unknown>> {
  return isObjectType(type) || isInterfaceType(type) ? type.getFields() : {};
}

/**
 * The page size that `node` asks for with first or last: the argument's value, the variable it
 * names, or the argument's default in the schema. Undefined when the field has no such argument.
 */
function sliceOf(
  node: FieldNode,
  field: GraphQLField<unknown, unknown>,
  walk: CostWalk,
): number | undefined {
  for (const name of slicingArguments) {
    const definition = field.args.find((arg) => arg.name === name);
    if (!definition) continue;
    const given = node.arguments?.find((arg) => arg.name.value === name);
    const value = given
      ? valueFromAST(given.value, definition.type, walk.variables)
      : definition.defaultValue;
    if (typeof value === 'number') return Math.max(0, value);
  }
  return undefined;
}

/**
 * The cost of a selection set on `type`: each object costs 1, a scalar nothing, and a list the
 * cost of one item times its size. A connection's edges take the size of the connection field's
 * first or last (`slice`); any other list its own first or last, or the default list size.
 */
function costOf(
  selectionSet: SelectionSetNode | undefined,
  type: GraphQLNamedType | undefined,
  walk: CostWalk,
  slice: number | undefined,
  seen: ReadonlySet<string>,
): number {
  if (!selectionSet) return 0;
  let cost = 0;
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.INLINE_FRAGMENT) {
      const condition = selection.typeCondition?.name.value;
      const inner = condition ? walk.schema.getType(condition) : type;
      cost += costOf(selection.selectionSet, inner ?? undefined, walk, slice, seen);
      continue;
    }
    if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const name = selection.name.value;
      const fragment = walk.fragments.get(name);
      if (!fragment || seen.has(name)) continue;
      const inner = walk.schema.getType(fragment.typeCondition.name.value) ?? undefined;
      cost += costOf(fragment.selectionSet, inner, walk, slice, new Set([...seen, name]));
      continue;
    }
    const name = selection.name.value;
    const field = fieldsOf(type)[name];
    if (name.startsWith('__') || !field) continue;
    const named = getNamedType(field.type);
    if (!isCompositeType(named)) continue;
    const ownSlice = sliceOf(selection, field, walk);
    const item = 1 + costOf(selection.selectionSet, named, walk, ownSlice, seen);
    if (!isListType(getNullableType(field.type))) {
      cost += item;
      continue;
    }
    const size =
      name === sizedField && slice !== undefined ? slice : (ownSlice ?? walk.defaultListSize);
    cost += size * item;
  }
  return cost;
}

/**
 * The cost of the operation that `operationName` picks in `document`, with its variables, by the
 * model of plan 05 that Hive's demandControl used: an object costs 1, a scalar nothing, and a list
 * multiplies the cost of one item by the number it may return. 100 orders with 100 operations each
 * cost 1 + 100 × (3 + 100 × 2) = 20 301.
 */
export function operationCost(
  schema: GraphQLSchema,
  document: DocumentNode,
  options: {
    readonly operationName?: string | null | undefined;
    readonly variables?: Readonly<Record<string, unknown>> | null | undefined;
    readonly defaultListSize: number;
  },
): number {
  const operation = getOperationAST(document, options.operationName);
  if (!operation) return 0;
  const fragments = new Map(
    document.definitions
      .filter((definition) => definition.kind === Kind.FRAGMENT_DEFINITION)
      .map((fragment) => [fragment.name.value, fragment]),
  );
  const walk: CostWalk = {
    schema,
    fragments,
    variables: options.variables ?? {},
    defaultListSize: options.defaultListSize,
  };
  const root = schema.getRootType(operation.operation) ?? undefined;
  return costOf(operation.selectionSet, root, walk, undefined, new Set());
}
