// SPDX-License-Identifier: MIT
// Server-only: the error model every surface reports in (ADR 0012).
export {
  DomainError,
  type DomainErrorOptions,
  type DomainErrorStatus,
  type FieldError,
} from './domain-error.ts';
export { DomainErrorFilter, toGraphQLError } from './exception-filter.ts';
export { toDomainError } from './to-domain-error.ts';
