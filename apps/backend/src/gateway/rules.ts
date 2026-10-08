// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  type ConstDirectiveNode,
  isTypeDefinitionNode,
  Kind,
  type ObjectTypeDefinitionNode,
  parse,
  type TypeDefinitionNode,
} from 'graphql';

/** What the NorthMES rules read of a subgraph. */
export interface SubgraphSdl {
  /** The module's GraphQL name, which is also its root field prefix. */
  readonly name: string;
  /** The subgraph SDL, with its federation link. */
  readonly sdl: string;
  /** The entities of other modules that the module references through entityRef. */
  readonly entityRefs: readonly string[];
}

/** One broken rule: its rule id and a message that names the field or type and the subgraphs. */
export interface CompositionProblem {
  readonly code: string;
  readonly message: string;
}

const rootTypes = new Set(['Query', 'Mutation', 'Subscription']);

/**
 * The SDK shared types, which every subgraph may define (ADR 0015). A new shared type enters only
 * through @northmes/sdk.
 */
const sharedTypes = new Set(['PageInfo']);

/** The fields federation adds to the Query type of every subgraph. */
const federationRootFields = new Set(['_service', '_entities']);

/** The types federation adds to every subgraph: its own and those of the specs it links. */
function isFederationType(type: string): boolean {
  return ['_Service', '_Any', '_Entity'].includes(type) || /^(link|federation)__/.test(type);
}

/** A subgraph with the type definitions of its SDL, which every rule reads. */
interface ParsedSubgraph {
  readonly name: string;
  readonly entityRefs: readonly string[];
  readonly types: readonly TypeDefinitionNode[];
}

/**
 * The NorthMES rules that composition runs before composeServices (ADR 0015). Returns every
 * problem, rule by rule and in subgraph order, and an empty list when the subgraphs keep every
 * rule.
 */
export function checkRules(subgraphs: readonly SubgraphSdl[]): CompositionProblem[] {
  const parsed = subgraphs.map(({ name, sdl, entityRefs }) => ({
    name,
    entityRefs,
    types: parse(sdl).definitions.filter(isTypeDefinitionNode),
  }));
  const ownership = typeOwners(parsed);
  return [
    ...parsed.flatMap(rootFieldPrefixProblems),
    ...ownership.problems,
    ...contributedFieldProblems(parsed, ownership.owners),
  ];
}

/**
 * NORTHMES_ROOT_FIELD_PREFIX: every Query, Mutation and Subscription field starts with the
 * subgraph's GraphQL name and an upper-case letter, as planningReleaseProductionOrder does.
 */
function rootFieldPrefixProblems({ name, types }: ParsedSubgraph): CompositionProblem[] {
  const prefixed = new RegExp(`^${name}[A-Z]`);
  const problems: CompositionProblem[] = [];
  for (const type of types) {
    if (type.kind !== Kind.OBJECT_TYPE_DEFINITION || !rootTypes.has(type.name.value)) continue;
    for (const field of type.fields ?? []) {
      if (prefixed.test(field.name.value) || federationRootFields.has(field.name.value)) continue;
      problems.push({
        code: 'NORTHMES_ROOT_FIELD_PREFIX',
        message: `${type.name.value}.${field.name.value} of subgraph "${name}" must start with "${name}" and an upper-case letter`,
      });
    }
  }
  return problems;
}

/** The subgraph that owns a type, and whether it defines the type as an entity. */
interface TypeOwner {
  readonly subgraph: string;
  readonly entity: boolean;
}

/**
 * NORTHMES_TYPE_OWNERSHIP: one module owns each type, and the first subgraph that defines a type
 * without listing it in entityRefs is its owner. A type that is not an entity is defined in its
 * owner only. An entity is defined in its owner and in every module that references it through
 * entityRef. Every later subgraph that defines a type without listing it in entityRefs claims the
 * type too: a plain @key on another module's entity, or on another module's value type, is no way
 * around the rule. Root types, federation's types and the SDK shared types have no owner.
 */
function typeOwners(subgraphs: readonly ParsedSubgraph[]): {
  readonly owners: ReadonlyMap<string, TypeOwner>;
  readonly problems: CompositionProblem[];
} {
  const owners = new Map<string, TypeOwner>();
  const problems: CompositionProblem[] = [];
  for (const { name, types, entityRefs } of subgraphs) {
    for (const type of types) {
      const typeName = type.name.value;
      if (rootTypes.has(typeName) || isFederationType(typeName) || sharedTypes.has(typeName)) {
        continue;
      }
      if (entityRefs.includes(typeName)) continue;
      const entity = hasDirective(type, 'key');
      const owner = owners.get(typeName);
      if (owner === undefined) {
        owners.set(typeName, { subgraph: name, entity });
        continue;
      }
      problems.push({
        code: 'NORTHMES_TYPE_OWNERSHIP',
        message:
          owner.entity && entity
            ? `${typeName} is defined as an entity in subgraphs "${owner.subgraph}" and "${name}"; one module owns an entity and other modules reference it through entityRef`
            : `${typeName} is defined in subgraphs "${owner.subgraph}" and "${name}"; one module owns a type that is not an entity`,
      });
    }
  }
  return { owners, problems };
}

/**
 * NORTHMES_CONTRIBUTED_FIELD_NULLABLE: a field that a module adds to an entity it references is
 * nullable, so a caller who may not read the field still gets the entity. The key fields are the
 * reference itself, and an @external field repeats the owner's field for @requires; neither is a
 * contribution.
 */
function contributedFieldProblems(
  subgraphs: readonly ParsedSubgraph[],
  owners: ReadonlyMap<string, TypeOwner>,
): CompositionProblem[] {
  const problems: CompositionProblem[] = [];
  for (const { name, types, entityRefs } of subgraphs) {
    for (const type of types) {
      if (type.kind !== Kind.OBJECT_TYPE_DEFINITION || !entityRefs.includes(type.name.value)) {
        continue;
      }
      const keyFields = keyFieldsOf(type);
      const owner = owners.get(type.name.value);
      const ownedBy = owner === undefined ? 'another module' : `subgraph "${owner.subgraph}"`;
      for (const field of type.fields ?? []) {
        if (keyFields.has(field.name.value) || hasDirective(field, 'external')) continue;
        if (field.type.kind !== Kind.NON_NULL_TYPE) continue;
        problems.push({
          code: 'NORTHMES_CONTRIBUTED_FIELD_NULLABLE',
          message: `${type.name.value}.${field.name.value} must be nullable: subgraph "${name}" adds it to an entity that ${ownedBy} owns`,
        });
      }
    }
  }
  return problems;
}

/**
 * Whether a type or field carries the directive. @key makes a type an entity, and @external marks
 * a field that the entity's owner resolves.
 */
function hasDirective(
  node: { readonly directives?: readonly ConstDirectiveNode[] },
  directive: 'key' | 'external',
): boolean {
  return (node.directives ?? []).some((candidate) => candidate.name.value === directive);
}

/** The top-level fields of every @key of an entity, such as id for @key(fields: "id"). */
function keyFieldsOf(entity: ObjectTypeDefinitionNode): Set<string> {
  const fields = new Set<string>();
  for (const directive of entity.directives ?? []) {
    if (directive.name.value !== 'key') continue;
    const fieldSet = directive.arguments?.find((argument) => argument.name.value === 'fields');
    if (fieldSet?.value.kind !== Kind.STRING) continue;
    const [selection] = parse(`{ ${fieldSet.value.value} }`).definitions;
    if (selection?.kind !== Kind.OPERATION_DEFINITION) continue;
    for (const field of selection.selectionSet.selections) {
      if (field.kind === Kind.FIELD) fields.add(field.name.value);
    }
  }
  return fields;
}
