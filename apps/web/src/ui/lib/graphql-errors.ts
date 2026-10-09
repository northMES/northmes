// SPDX-License-Identifier: AGPL-3.0-or-later
import { CombinedGraphQLErrors } from '@apollo/client';
import type { ServerFieldError } from './use-zod-form.ts';

/** Whether a value is one entry of extensions.fieldErrors (ADR 0017). */
function isFieldError(value: unknown): value is ServerFieldError {
  if (typeof value !== 'object' || value === null) return false;
  const { path, message } = value as Partial<Record<keyof ServerFieldError, unknown>>;
  return Array.isArray(path) && typeof message === 'string';
}

/** The fieldErrors of every GraphQL error of a failed command. */
export function fieldErrorsOf(error: unknown): ServerFieldError[] {
  if (!CombinedGraphQLErrors.is(error)) return [];
  return error.errors.flatMap(({ extensions }) => {
    const entries: unknown = extensions?.fieldErrors;
    return Array.isArray(entries) ? entries.filter(isFieldError) : [];
  });
}

/** Whether a failed command carries the errorCode of a DomainError, such as core.version_conflict. */
export function hasErrorCode(error: unknown, errorCode: string): boolean {
  return detailsOf(error, errorCode) !== undefined;
}

/**
 * The details of the first GraphQL error with this errorCode, an empty object when it has none,
 * or undefined when no error carries the code (ADR 0012).
 */
export function detailsOf(error: unknown, errorCode: string): Record<string, unknown> | undefined {
  if (!CombinedGraphQLErrors.is(error)) return undefined;
  const found = error.errors.find(({ extensions }) => extensions?.errorCode === errorCode);
  if (found === undefined) return undefined;
  const details: unknown = found.extensions?.details;
  return typeof details === 'object' && details !== null
    ? (details as Record<string, unknown>)
    : {};
}

/** Whether the API refused a read or a field with FORBIDDEN, as for a permission the user lacks. */
export function isForbidden(error: unknown): boolean {
  return (
    CombinedGraphQLErrors.is(error) &&
    error.errors.some(({ extensions }) => extensions?.code === 'FORBIDDEN')
  );
}
