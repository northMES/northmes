// SPDX-License-Identifier: MIT
import { Catch, type ExceptionFilter } from '@nestjs/common';

/**
 * The one exception filter of the server. The host registers it once as APP_FILTER in its root
 * module, and modules and plugins register no filter of their own (ADR 0012).
 */
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  catch(exception: unknown): never {
    throw exception;
  }
}
