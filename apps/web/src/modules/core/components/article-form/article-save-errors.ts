// SPDX-License-Identifier: AGPL-3.0-or-later
import { CombinedGraphQLErrors } from '@apollo/client';
import { fieldErrorsOf } from '../../../../ui/lib/graphql-errors.ts';
import { setServerErrors, type ZodForm } from '../../../../ui/lib/use-zod-form.ts';
import type { ArticleFields, ArticleValues } from './article-form.tsx';

/**
 * The message of an archive or restore that failed: the API's own message when it refused the
 * command, such as a validator's reason, and a hint at the connection when no answer came.
 */
export function commandFailure(error: unknown, action: 'archive' | 'restore'): string {
  if (!CombinedGraphQLErrors.is(error)) {
    return `Could not ${action} the article. Check the connection, then try again.`;
  }
  const reasons = error.errors.map(({ message }) =>
    /[.!?]$/.test(message) ? message : `${message}.`,
  );
  return `Could not ${action} the article. ${reasons.join(' ')}`;
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
