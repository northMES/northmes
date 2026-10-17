// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { SetMetadata, type Type } from '@nestjs/common';

/** The metadata key under which PublicApiOperation records a handler's operation. */
export const PUBLIC_API_OPERATION_METADATA = 'northmes:public-api-operation';

/** One operation of the public API as its route serves it (ADR 0064, ADR 0073). */
export interface PublicApiOperationMetadata {
  /** The OpenAPI operation id, which is also the GraphQL field that calls the same service method. */
  readonly operationId: string;
  /** The operation's contract name, such as core.getArticle. */
  readonly operation: string;
  /** The permission the operation checks, which the document lists as the required scope. */
  readonly permission: string;
  readonly method: 'GET' | 'POST';
  /** The full path in OpenAPI form, such as /api/v1/core/articles/{id}. */
  readonly path: string;
  /** The status of a success: 200, or 201 for an operation that may create. */
  readonly status: 200 | 201;
}

/**
 * Marks a route handler as one operation of the public API, with what the OpenAPI document builder
 * and the route inventory read back from PUBLIC_API_OPERATION_METADATA. toRestRoutes applies it to
 * every route it builds.
 */
export function PublicApiOperation(metadata: PublicApiOperationMetadata): MethodDecorator {
  return SetMetadata(PUBLIC_API_OPERATION_METADATA, metadata);
}

/** The public API operations of a controller's handlers, in the order the class declares them. */
export function publicApiOperationsOf(controller: Type): PublicApiOperationMetadata[] {
  const prototype = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype).flatMap((key) => {
    const handler = prototype[key];
    if (key === 'constructor' || typeof handler !== 'function') return [];
    const metadata = Reflect.getMetadata(PUBLIC_API_OPERATION_METADATA, handler) as
      | PublicApiOperationMetadata
      | undefined;
    return metadata ? [metadata] : [];
  });
}

function capitalize(name: string): string {
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/**
 * The operation id of a contract, which is the GraphQL root field that calls the same service
 * method (ADR 0073): the module prefix and the operation's name, as the command mutations already
 * are, so core.createArticle gives coreCreateArticle. A query's verb find or get drops, since
 * GraphQL names a query field after what it answers: core.findArticles gives coreArticles and
 * core.getArticle coreArticle.
 */
export function operationIdOf(contract: { readonly name: string; readonly kind?: string }): string {
  const [prefix = '', name = ''] = contract.name.split('.');
  const verb = /^(?:find|get)(?=[A-Z])/;
  const noun = contract.kind === 'query' ? name.replace(verb, '') : name;
  return `${prefix}${capitalize(noun)}`;
}
