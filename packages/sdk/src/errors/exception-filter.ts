// SPDX-License-Identifier: MIT
import { type ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { GqlContextType } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { DomainError } from './domain-error.ts';

/** The GraphQL extensions.code of each HTTP status an error may carry (ADR 0012). */
const graphqlCodes: ReadonlyMap<number, string> = new Map([
  [HttpStatus.BAD_REQUEST, 'BAD_USER_INPUT'],
  [HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED'],
  [HttpStatus.FORBIDDEN, 'FORBIDDEN'],
  [HttpStatus.NOT_FOUND, 'NOT_FOUND'],
  [HttpStatus.CONFLICT, 'CONFLICT'],
  [HttpStatus.PRECONDITION_FAILED, 'PRECONDITION'],
  [HttpStatus.SERVICE_UNAVAILABLE, 'UNAVAILABLE'],
]);

/**
 * The one exception filter of the server. The host registers it once as APP_FILTER in its root
 * module, and modules and plugins register no filter of their own (ADR 0012). It catches every
 * exception. A DomainError thrown in a resolver becomes a GraphQL error whose extensions carry
 * code (from its kind), errorCode, details and fieldErrors, in the shape of a Zod failure's. Any
 * other exception in a resolver passes on as it was thrown. Outside GraphQL it leaves the answer to Nest's default filter, until REST routes
 * answer with problem details.
 */
@Catch()
export class DomainErrorFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): GraphQLError | undefined {
    if (host.getType<GqlContextType>() !== 'graphql') {
      super.catch(exception, host);
      return undefined;
    }
    if (!(exception instanceof DomainError)) throw exception;
    return new GraphQLError(exception.message, {
      extensions: {
        code: graphqlCodes.get(exception.getStatus()),
        errorCode: exception.code,
        details: exception.details,
        fieldErrors: exception.fieldErrors,
      },
    });
  }
}
