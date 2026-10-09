// SPDX-License-Identifier: AGPL-3.0-or-later
import { CombinedGraphQLErrors } from '@apollo/client';
import {
  type ServerFieldError,
  setServerErrors,
  type ZodForm,
} from '../../../../ui/lib/use-zod-form.ts';
import type { ArticleFields, ArticleValues } from './article-form.tsx';

/** Whether a value is one entry of extensions.fieldErrors (ADR 0017). */
function isFieldError(value: unknown): value is ServerFieldError {
  if (typeof value !== 'object' || value === null) return false;
  const { path, message } = value as Partial<Record<keyof ServerFieldError, unknown>>;
  return Array.isArray(path) && typeof message === 'string';
}

/** The fieldErrors of every GraphQL error of a failed save. */
function fieldErrorsOf(error: unknown): ServerFieldError[] {
  if (!CombinedGraphQLErrors.is(error)) return [];
  return error.errors.flatMap(({ extensions }) => {
    const entries: unknown = extensions?.fieldErrors;
    return Array.isArray(entries) ? entries.filter(isFieldError) : [];
  });
}

/** Whether a failed save carries the errorCode of a DomainError, such as core.version_conflict. */
export function hasErrorCode(error: unknown, errorCode: string): boolean {
  return (
    CombinedGraphQLErrors.is(error) &&
    error.errors.some(({ extensions }) => extensions?.errorCode === errorCode)
  );
}

/**
 * Places the errors of a failed save on the article form: each fieldErrors entry on its field,
 * with core.code_taken worded as the rule and the fix for the typed number (design ui-222, Copy),
 * and any other failure as Could not save the article. The typed values stay (WCAG 3.3.7).
 */
export function showSaveError(
  form: ZodForm<ArticleFields>,
  error: unknown,
  values: ArticleValues,
): void {
  const fieldErrors = fieldErrorsOf(error).map((entry) =>
    entry.code === 'core.code_taken' && entry.path.join('.') === 'code'
      ? {
          ...entry,
          message: `Article number ${values.code} is already in use. Choose another number.`,
        }
      : entry,
  );
  if (fieldErrors.length > 0) {
    setServerErrors(form, fieldErrors);
    return;
  }
  form.setError('root.server', { type: 'server', message: 'Your entries are kept. Try again.' });
}
