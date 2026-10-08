// SPDX-License-Identifier: MIT
import { type ArgumentsHost, Catch } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { GqlContextType } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { DomainError, type DomainErrorKind } from './domain-error.ts';

/** The GraphQL extensions.code of each kind (ADR 0012). */
const graphqlCodes: Readonly<Record<DomainErrorKind, string>> = {
  validation: 'BAD_USER_INPUT',
  unauthenticated: 'UNAUTHENTICATED',
  not_found: 'NOT_FOUND',
  forbidden: 'FORBIDDEN',
  conflict: 'CONFLICT',
  precondition: 'PRECONDITION',
  unavailable: 'UNAVAILABLE',
};

/**
 * The one exception filter of the server. The host registers it once as APP_FILTER in its root
 * module, and modules and plugins register no filter of their own (ADR 0012). It catches every
 * exception. A DomainError thrown in a resolver becomes a GraphQL error whose extensions carry
 * code (from its kind), errorCode and details. Any other exception in a resolver passes on as it
 * was thrown. Outside GraphQL it leaves the answer to Nest's default filter, until REST routes
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
        code: graphqlCodes[exception.kind],
        errorCode: exception.code,
        details: exception.details,
      },
    });
  }
}
