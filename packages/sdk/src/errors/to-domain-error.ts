// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { HttpStatus } from '@nestjs/common';
import { DomainError } from './domain-error.ts';

/** The fields of a Postgres error that toDomainError reads, as node-postgres reports them. */
interface PostgresError {
  /** The SQLSTATE. */
  readonly code: string;
  /** The constraint or index the statement violated. */
  readonly constraint?: string;
}

function isPostgresError(error: unknown): error is PostgresError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^[0-9A-Z]{5}$/.test(error.code)
  );
}

const CODE_TAKEN = 'The code is already taken.';

/** Whether the error violates a code rule: a _code_key unique index or a _code_excl constraint. */
function isCodeClash({ code, constraint }: PostgresError): boolean {
  return (
    (code === '23505' && constraint?.endsWith('_code_key') === true) ||
    (code === '23P01' && constraint?.endsWith('_code_excl') === true)
  );
}

/**
 * Maps a database error to the DomainError a client reads, in one place for every path that
 * writes (ADR 0012). A unique violation (23505) of an index whose name ends in _code_key, and an
 * exclusion violation (23P01) of a constraint whose name ends in _code_excl, the per-scope code
 * rule of a register (ADR 0009), are core.code_taken with a fieldErrors entry on code. Its message
 * names no row, so a clash with a row the principal cannot read, such as another plant's,
 * reveals nothing about it. Any other error comes back as it is.
 */
export function toDomainError(error: unknown): unknown {
  if (!isPostgresError(error)) return error;
  if (isCodeClash(error)) {
    return new DomainError({
      code: 'core.code_taken',
      status: HttpStatus.CONFLICT,
      message: CODE_TAKEN,
      fieldErrors: [{ path: ['code'], message: CODE_TAKEN, code: 'core.code_taken' }],
    });
  }
  return error;
}
