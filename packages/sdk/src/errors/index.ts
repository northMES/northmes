// SPDX-License-Identifier: MIT
// Server-only: the error model every surface reports in (ADR 0012).
export {
  DomainError,
  type DomainErrorKind,
  type DomainErrorOptions,
  type FieldError,
} from './domain-error.ts';
export { DomainErrorFilter } from './exception-filter.ts';
export { toDomainError } from './to-domain-error.ts';
