// SPDX-License-Identifier: MIT
import { HttpException, type HttpStatus } from '@nestjs/common';

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
  /**
   * The HTTP status, from which the exception filter takes the GraphQL extensions.code:
   * 400 BAD_USER_INPUT, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 CONFLICT,
   * 412 PRECONDITION or 503 UNAVAILABLE.
   */
  readonly status: HttpStatus;
  /** The text the person who ran the operation reads. */
  readonly message: string;
  /** Values a client reads by code, such as rejectedBy of core.command_rejected. */
  readonly details?: Readonly<Record<string, unknown>>;
  /** The fields of the command input the error is about, which a form shows it on. */
  readonly fieldErrors?: readonly FieldError[];
}

/**
 * An HttpException with a NorthMES code that a client reads as extensions.errorCode, and the
 * details and fieldErrors that go with it (ADR 0012, as ADR 0070 changes it). Code that needs no
 * NorthMES code throws Nest's own exception instead, such as NotFoundException.
 */
export class DomainError extends HttpException {
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>> | undefined;
  readonly fieldErrors: readonly FieldError[] | undefined;

  constructor({ code, status, message, details, fieldErrors }: DomainErrorOptions) {
    super(message, status);
    this.code = code;
    this.details = details;
    this.fieldErrors = fieldErrors;
  }
}
