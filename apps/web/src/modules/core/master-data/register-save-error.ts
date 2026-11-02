// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// shared-candidate: #66
import { fieldErrorsOf, hasErrorCode } from '../../../ui/lib/graphql-errors.ts';
import { setServerErrors, type useZodForm, type ZodForm } from '../../../ui/lib/use-zod-form.ts';

/** The schema of a form that useZodForm binds. */
type FormSchema = Parameters<typeof useZodForm>[0];

/**
 * Places the errors of a register's failed create or update on its form (ADR 0022): each
 * fieldErrors entry on its field, with core.code_taken as the rule and the fix for the typed code,
 * which names no other plant (ADR 0009); core.forbidden as `forbidden`, the permission the change
 * needs; and any other failure as Could not save. The typed values stay. A core.version_conflict
 * is the page's to show, since only it can reload the row.
 */
export function showRegisterSaveError<Schema extends FormSchema>(
  form: ZodForm<Schema>,
  error: unknown,
  values: { readonly code: string },
  { forbidden }: { readonly forbidden: string },
): void {
  const fieldErrors = fieldErrorsOf(error).map((entry) =>
    entry.code === 'core.code_taken' && entry.path.join('.') === 'code'
      ? { ...entry, message: `Code ${values.code} is already in use here. Choose another code.` }
      : entry,
  );
  if (fieldErrors.length > 0) {
    setServerErrors(form, fieldErrors);
    return;
  }
  const message = hasErrorCode(error, 'core.forbidden')
    ? `${forbidden} Your entries are kept.`
    : 'Your entries are kept. Try again.';
  form.setError('root.server', { type: 'server', message });
}
