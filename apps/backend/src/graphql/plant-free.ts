// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import { DomainError, toGraphQLError } from '@northmes/sdk/errors';
import { PLANT_FREE } from '@northmes/sdk/graphql';
import {
  type DocumentNode,
  type FragmentDefinitionNode,
  type GraphQLObjectType,
  type GraphQLSchema,
  getOperationAST,
  Kind,
  type OperationDefinitionNode,
  type SelectionSetNode,
} from 'graphql';
import type { Plugin } from 'graphql-yoga';
import type { ServerContext } from './principal.ts';

/**
 * The refusal of an operation without x-northmes-plant that selects a root field that is not
 * plant-free: the code of a request for a plant the principal may not open (ADR 0066).
 */
export function noPlantForbidden(): DomainError {
  return new DomainError({
    code: 'core.plant_forbidden',
    status: HttpStatus.FORBIDDEN,
    message: 'The request names no plant. Choose one of your plants.',
  });
}

/** The names of the root fields a selection set selects, through its fragments. */
function rootFieldNames(
  selectionSet: SelectionSetNode,
  fragments: ReadonlyMap<string, FragmentDefinitionNode>,
  seen = new Set<string>(),
): string[] {
  return selectionSet.selections.flatMap((selection) => {
    if (selection.kind === Kind.FIELD) return [selection.name.value];
    if (selection.kind === Kind.INLINE_FRAGMENT) {
      return rootFieldNames(selection.selectionSet, fragments, seen);
    }
    const name = selection.name.value;
    const fragment = fragments.get(name);
    if (!fragment || seen.has(name)) return [];
    seen.add(name);
    return rootFieldNames(fragment.selectionSet, fragments, seen);
  });
}

/** The root type of an operation in the schema. */
function rootType(schema: GraphQLSchema, operation: OperationDefinitionNode) {
  return schema.getRootType(operation.operation) as GraphQLObjectType | undefined;
}

/**
 * True when every root field the operation selects is plant-free or an introspection field such as
 * __typename. A field the schema does not hold is left to validation, which has already refused it.
 */
export function onlyPlantFree(
  schema: GraphQLSchema,
  document: DocumentNode,
  operationName?: string | null,
): boolean {
  const operation = getOperationAST(document, operationName);
  if (!operation) return true;
  const type = rootType(schema, operation);
  const fields = type?.getFields() ?? {};
  const fragments = new Map(
    document.definitions
      .filter((definition) => definition.kind === Kind.FRAGMENT_DEFINITION)
      .map((fragment) => [fragment.name.value, fragment]),
  );
  return rootFieldNames(operation.selectionSet, fragments).every(
    (name) => name.startsWith('__') || fields[name]?.extensions[PLANT_FREE] === true,
  );
}

/**
 * The plant-free rule (ADR 0066): an operation of a principal whose request names no plant runs
 * only when every root field in it is plant-free. Any other fails as a request for a plant the
 * principal may not open does, with FORBIDDEN core.plant_forbidden and no data, and runs no field.
 * A request without a principal is left to the principal guard, which answers UNAUTHENTICATED.
 * Subscriptions are left out: each names its plant in its plantId argument, and its handshake
 * carries no header (ADR 0018).
 */
export const plantFreePlugin: Plugin<ServerContext> = {
  onExecute({ args, setResultAndStopExecution }) {
    const { principal } = args.contextValue as ServerContext;
    if (!principal || principal.plantId !== undefined) return;
    if (onlyPlantFree(args.schema, args.document, args.operationName)) return;
    const refusal = noPlantForbidden();
    setResultAndStopExecution({ errors: [toGraphQLError(refusal) ?? refusal] });
  },
};
