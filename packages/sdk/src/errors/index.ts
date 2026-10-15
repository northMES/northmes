// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Server-only: the error model every surface reports in (ADR 0012).
export {
  DomainError,
  type DomainErrorOptions,
  type DomainErrorStatus,
  type FieldError,
} from './domain-error.ts';
export { DomainErrorFilter, toGraphQLError } from './exception-filter.ts';
export { toDomainError } from './to-domain-error.ts';
