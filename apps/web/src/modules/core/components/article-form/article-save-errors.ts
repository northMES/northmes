// SPDX-License-Identifier: AGPL-3.0-or-later
import { fieldErrorsOf, hasErrorCode, refusalMessage } from '../../../../ui/lib/graphql-errors.ts';
import { setServerErrors, type ZodForm } from '../../../../ui/lib/use-zod-form.ts';
import { permissionPhrase } from '../../no-access.tsx';
import type { ArticleFields, ArticleValues } from './article-form.tsx';

/**
 * Why a change that the principal's plant role allows elsewhere is refused (ADR 0073): a Plant
 * admin changes an article that only their plant uses, and the company the others.
 */
const companyRule =
  'An article that more than one plant uses, or All plants, needs the permission at the company.';

/**
 * The message of an archive or restore that failed: core.forbidden says the user may not do it
 * here, another refusal shows the API's own message, such as a validator's reason, and no answer
 * gives a hint at the connection.
 */
export function commandFailure(error: unknown, action: 'archive' | 'restore'): string {
  if (hasErrorCode(error, 'core.forbidden')) {
    return `You do not have permission to ${action} this article here. ${companyRule}`;
  }
  const reasons = refusalMessage(error);
  if (reasons === undefined) {
    return `Could not ${action} the article. Check the connection, then try again.`;
  }
  return `Could not ${action} the article. ${reasons}`;
}

/**
 * Places the errors of a failed save on the article form: each fieldErrors entry on its field,
 * with core.code_taken worded as the rule and the fix for the typed number (design ui-222, Copy),
 * core.forbidden as the permission the change needs, and any other failure as Could not save the
 * article. The typed values stay (WCAG 3.3.7).
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
  if (hasErrorCode(error, 'core.forbidden')) {
    form.setError('root.server', {
      type: 'server',
      message: `You do not have permission to change this article here. ${companyRule} Your entries are kept.`,
    });
    return;
  }
  form.setError('root.server', { type: 'server', message: 'Your entries are kept. Try again.' });
}

/**
 * Places the failure of a plants change on the article form, after the rest of the article saved:
 * core.forbidden names core.article:assign at the company, as design core-304 names a refused
 * permission and its place, and any other failure goes as showSaveError places it. The typed
 * values stay (WCAG 3.3.7).
 */
export function showPlantsSaveError(
  form: ZodForm<ArticleFields>,
  error: unknown,
  values: ArticleValues,
  company: string,
): void {
  if (hasErrorCode(error, 'core.forbidden')) {
    form.setError('root.server', {
      type: 'server',
      message: `You do not have permission to change the plants of this article. This needs ${permissionPhrase('core.article:assign')} at ${company}. Your entries are kept.`,
    });
    return;
  }
  showSaveError(form, error, values);
}
