// SPDX-License-Identifier: MIT
import { type ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { GqlContextType } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { DomainError, type DomainErrorStatus } from './domain-error.ts';

/** The GraphQL extensions.code of each HTTP status an error may carry (ADR 0012). */
const graphqlCodes: Readonly<Record<DomainErrorStatus, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_USER_INPUT',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PRECONDITION_FAILED]: 'PRECONDITION',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'UNAVAILABLE',
};

/** The GraphQL extensions.code of an HTTP status, or undefined for a status the filter masks. */
function graphqlCodeOf(status: number): string | undefined {
  return Object.hasOwn(graphqlCodes, status)
    ? graphqlCodes[status as DomainErrorStatus]
    : undefined;
}

/**
 * The GraphQL error of an HttpException (ADR 0012): its message and the extensions.code of its
 * status, and for a DomainError also errorCode, details and fieldErrors, in the shape of a Zod
 * failure's. Any other exception, and an HttpException of a status without a GraphQL code, has
 * none, so GraphQL Yoga masks it. The server also answers a refusal raised outside a resolver with
 * it, such as a request's plant that its principal may not open.
 */
export function toGraphQLError(exception: unknown): GraphQLError | undefined {
  if (!(exception instanceof HttpException)) return undefined;
  const code = graphqlCodeOf(exception.getStatus());
  if (!code) return undefined;
  if (!(exception instanceof DomainError)) {
    return new GraphQLError(exception.message, { extensions: { code } });
  }
  return new GraphQLError(exception.message, {
    extensions: {
      code,
      errorCode: exception.code,
      details: exception.details,
      fieldErrors: exception.fieldErrors,
    },
  });
}

/**
 * The one exception filter of the server. The host registers it once as APP_FILTER in its root
 * module, and modules and plugins register no filter of their own (ADR 0012). It catches every
 * exception. An HttpException thrown in a resolver, such as Nest's NotFoundException, becomes a
 * GraphQL error with its message and the extensions.code of its status (toGraphQLError). Any other
 * exception in a resolver, and an HttpException of a status without a GraphQL code, passes on as it
 * was thrown, so GraphQL Yoga masks it. Outside GraphQL it leaves the answer to Nest's default
 * filter, until REST routes answer with problem details.
 */
@Catch()
export class DomainErrorFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): GraphQLError | undefined {
    if (host.getType<GqlContextType>() !== 'graphql') {
      super.catch(exception, host);
      return undefined;
    }
    const error = toGraphQLError(exception);
    if (!error) throw exception;
    return error;
  }
}
