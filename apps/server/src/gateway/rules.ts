// SPDX-License-Identifier: AGPL-3.0-or-later
import { Kind, parse } from 'graphql';

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
 * The NorthMES rules that composition runs before composeServices (ADR 0015). Returns every
 * problem, in subgraph order, and an empty list when the subgraphs keep every rule.
 */
export function checkRules(subgraphs: readonly SubgraphSdl[]): CompositionProblem[] {
  return subgraphs.flatMap(rootFieldPrefixProblems);
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
      if (prefixed.test(field.name.value)) continue;
      problems.push({
        code: 'NORTHMES_ROOT_FIELD_PREFIX',
        message: `${definition.name.value}.${field.name.value} of subgraph "${name}" must start with "${name}" and an upper-case letter`,
      });
    }
  }
  return problems;
}
