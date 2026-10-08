// SPDX-License-Identifier: MIT

/** What went wrong, in the terms a client acts on. Each kind maps to one GraphQL code (ADR 0012). */
export type DomainErrorKind =
  | 'validation'
  | 'unauthenticated'
  | 'not_found'
  | 'forbidden'
  | 'conflict'
  | 'precondition'
  | 'unavailable';

/**
 * A problem with one field of a command's input, in the shape of a Zod issue: the path from the
 * input to the field, the message and the code, such as too_big or core.code_taken (ADR 0012).
 */
export interface FieldError {
  readonly path: readonly (string | number)[];
  readonly message: string;
  readonly code: string;
}

export interface DomainErrorOptions {
  /** Stable and module-scoped, such as core.command_rejected. Never renamed after a release. */
  readonly code: string;
  readonly kind: DomainErrorKind;
  /** The text the person who ran the operation reads. */
  readonly message: string;
  /** Values a client reads by code, such as rejectedBy of core.command_rejected. */
  readonly details?: Readonly<Record<string, unknown>>;
  /** The fields of the command input the error is about, which a form shows it on. */
  readonly fieldErrors?: readonly FieldError[];
}

/** The one error type of NorthMES, which every surface reports in the same shape (ADR 0012). */
export class DomainError extends Error {
  readonly code: string;
  readonly kind: DomainErrorKind;
  readonly details: Readonly<Record<string, unknown>> | undefined;
  readonly fieldErrors: readonly FieldError[] | undefined;

  constructor({ code, kind, message, details, fieldErrors }: DomainErrorOptions) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.kind = kind;
    this.details = details;
    this.fieldErrors = fieldErrors;
  }
}
