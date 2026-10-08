// SPDX-License-Identifier: AGPL-3.0-or-later
import { isTypeDefinitionNode, Kind, parse } from 'graphql';

/** What the NorthMES rules read of a subgraph. */
export interface SubgraphSdl {
  /** The module's GraphQL name, which is also its root field prefix. */
  readonly name: string;
  /** The subgraph SDL, with its federation link. */
  readonly sdl: string;
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

/**
 * The NorthMES rules that composition runs before composeServices (ADR 0015). Returns every
 * problem, in subgraph order, and an empty list when the subgraphs keep every rule.
 */
export function checkRules(subgraphs: readonly SubgraphSdl[]): CompositionProblem[] {
  return [...subgraphs.flatMap(rootFieldPrefixProblems), ...typeOwnershipProblems(subgraphs)];
}

/** NORTHMES_TYPE_OWNERSHIP: a type is defined in one subgraph, the module that owns it. */
function typeOwnershipProblems(subgraphs: readonly SubgraphSdl[]): CompositionProblem[] {
  const owners = new Map<string, string>();
  const problems: CompositionProblem[] = [];
  for (const { name, sdl } of subgraphs) {
    for (const definition of parse(sdl).definitions) {
      if (!isTypeDefinitionNode(definition)) continue;
      const type = definition.name.value;
      if (rootTypes.has(type) || isFederationType(type) || sharedTypes.has(type)) continue;
      const owner = owners.get(type);
      if (owner === undefined) {
        owners.set(type, name);
        continue;
      }
      problems.push({
        code: 'NORTHMES_TYPE_OWNERSHIP',
        message: `${type} is defined in subgraphs "${owner}" and "${name}"; one module owns a type that is not an entity`,
      });
    }
  }
  return problems;
}

/**
 * NORTHMES_ROOT_FIELD_PREFIX: every Query, Mutation and Subscription field starts with the
 * subgraph's GraphQL name and an upper-case letter, as planningReleaseProductionOrder does.
 */
function rootFieldPrefixProblems({ name, sdl }: SubgraphSdl): CompositionProblem[] {
  const prefixed = new RegExp(`^${name}[A-Z]`);
  const problems: CompositionProblem[] = [];
  for (const definition of parse(sdl).definitions) {
    if (definition.kind !== Kind.OBJECT_TYPE_DEFINITION) continue;
    if (!rootTypes.has(definition.name.value)) continue;
    for (const field of definition.fields ?? []) {
      if (prefixed.test(field.name.value) || federationRootFields.has(field.name.value)) continue;
      problems.push({
        code: 'NORTHMES_ROOT_FIELD_PREFIX',
        message: `${definition.name.value}.${field.name.value} of subgraph "${name}" must start with "${name}" and an upper-case letter`,
      });
    }
  }
  return problems;
}
