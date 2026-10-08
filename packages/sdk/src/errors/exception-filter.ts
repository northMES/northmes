// SPDX-License-Identifier: MIT
import { type ArgumentsHost, Catch } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { GqlContextType } from '@nestjs/graphql';

/**
 * The one exception filter of the server. The host registers it once as APP_FILTER in its root
 * module, and modules and plugins register no filter of their own (ADR 0012). It catches every
 * exception. Outside GraphQL it leaves the answer to Nest's default filter, until REST routes answer
 * with problem details.
 */
@Catch()
export class DomainErrorFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType<GqlContextType>() === 'graphql') throw exception;
    super.catch(exception, host);
  }
}
