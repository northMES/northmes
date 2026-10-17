// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { FieldError } from '../errors/domain-error.ts';
import type { OperationError } from '../operations/runner.ts';

/** The media type of a problem response (RFC 9457). */
export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/**
 * The base of a problem's `type` URI, which the error code completes (docs/plan/05, REST errors).
 * M-36 is open: this is the working default, and every problem builds its type from this constant
 * alone, so the maintainer's answer changes one line.
 */
export const PROBLEM_TYPE_BASE = 'https://docs.northmes.dev/errors/';

/** A REST error as the public API answers it, application/problem+json (RFC 9457, ADR 0064). */
export interface Problem {
  /** PROBLEM_TYPE_BASE followed by the code. */
  readonly type: string;
  /** The fixed title of the status, the same for every error of that status. */
  readonly title: string;
  readonly status: number;
  /** The error's message, which names no internals; a masked error says Unexpected error. */
  readonly detail: string;
  /** The request's path. */
  readonly instance: string;
  /** The module-scoped code, such as core.version_conflict, or core.internal for a masked error. */
  readonly code: string;
  /** The field errors of the input, in the shape GraphQL's fieldErrors use; empty for none. */
  readonly errors: readonly FieldError[];
  /** The values a client reads by code, such as details.permission of core.forbidden. */
  readonly details?: Readonly<Record<string, unknown>>;
  readonly correlationId: string;
}

/** The title of each status the error model knows (docs/plan/05, error model). */
const titles: Readonly<Record<number, string>> = {
  400: 'Invalid input',
  401: 'Not signed in',
  403: 'Not permitted',
  404: 'Not found',
  409: 'Conflict',
  412: 'Precondition failed',
  413: 'Request too large',
  415: 'Unsupported media type',
  429: 'Too many requests',
  503: 'Unavailable',
  500: 'Unexpected error',
};

/** The `type` URI of a problem with this code. */
export function problemType(code: string): string {
  return `${PROBLEM_TYPE_BASE}${code}`;
}

/** The problem response of an operation error, for a request to `instance`. */
export function problemOf(error: OperationError, instance: string): Problem {
  const { status, code, message, details, fieldErrors = [], correlationId } = error;
  return {
    type: problemType(code),
    title: titles[status] ?? titles[500] ?? 'Unexpected error',
    status,
    detail: message,
    instance,
    code,
    errors: fieldErrors,
    ...(details ? { details } : {}),
    correlationId,
  };
}
