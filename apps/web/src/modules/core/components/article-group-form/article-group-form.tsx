// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { articleGroupFields } from '@northmes/core-contracts';
import type { z } from 'zod';
import { ConflictSummary } from '../../../../ui/components/conflict-summary/index.ts';
import { ErrorSummary } from '../../../../ui/components/error-summary/index.ts';
import { FormActions } from '../../../../ui/components/form-actions/index.ts';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { UnsavedChangesGuard } from '../../../../ui/components/unsaved-changes-guard/index.ts';
import { fieldErrorsOf, hasErrorCode } from '../../../../ui/lib/graphql-errors.ts';
import {
  fieldProps,
  setServerErrors,
  summaryErrors,
  type ZodForm,
} from '../../../../ui/lib/use-zod-form.ts';

/** The fields of the article group form: the code and the name that create and update share. */
export const articleGroupFormFields = articleGroupFields.pick({ code: true, name: true });

/** The values a save receives, trimmed. */
export type ArticleGroupValues = z.output<typeof articleGroupFormFields>;

export interface ArticleGroupFormProps {
  readonly form: ZodForm<typeof articleGroupFormFields>;
  /** Sends the values; a failure places its errors on the form before the promise settles. */
  readonly onSave: (values: ArticleGroupValues) => Promise<void>;
  /** Where Cancel leads: the list of article groups. */
  readonly cancelHref: string;
  /** Set while the last save was refused with core.version_conflict. */
  readonly conflict?: { readonly onReload: () => Promise<void> };
  /** False on an archived group, which cannot be changed until it is restored. */
  readonly editable?: boolean;
}

/**
 * Places the errors of a failed save on the group form: each fieldErrors entry on its field, with
 * core.code_taken as the rule and the fix for the typed code, core.forbidden as the permission the
 * change needs at the company, and any other failure as Could not save. The typed values stay.
 */
export function showGroupSaveError(
  form: ZodForm<typeof articleGroupFormFields>,
  error: unknown,
  values: ArticleGroupValues,
): void {
  const fieldErrors = fieldErrorsOf(error).map((entry) =>
    entry.code === 'core.code_taken' && entry.path.join('.') === 'code'
      ? { ...entry, message: `Code ${values.code} is already in use. Choose another code.` }
      : entry,
  );
  if (fieldErrors.length > 0) {
    setServerErrors(form, fieldErrors);
    return;
  }
  const message = hasErrorCode(error, 'core.forbidden')
    ? 'You do not have permission to change article groups. They belong to the company, so the change needs the permission there. Your entries are kept.'
    : 'Your entries are kept. Try again.';
  form.setError('root.server', { type: 'server', message });
}

/**
 * The article group form (design ui-222, the register's create form DE37): the error summary, the
 * Identity field group with Code and Name, then the sticky Save bar with Save article group and
 * Cancel. The summary takes focus after each failed save, the typed values stay, and leaving the
 * form with changes asks first.
 */
export function ArticleGroupForm({
  form,
  onSave,
  cancelHref,
  conflict,
  editable = true,
}: ArticleGroupFormProps) {
  const { isDirty, isSubmitting } = form.formState;
  const errors = summaryErrors(form.formState.errors);
  const fieldCount = errors.filter(({ name }) => name !== undefined).length;
  return (
    <form noValidate onSubmit={form.handleSubmit(onSave)} className="flex max-w-190 flex-col gap-4">
      {conflict === undefined ? (
        <ErrorSummary
          heading={
            fieldCount === 0
              ? 'Could not save the article group'
              : `Fix ${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'} to save the article group`
          }
          errors={errors}
          focusKey={form.formState.submitCount}
        />
      ) : (
        <ConflictSummary noun="article group" errors={errors} onReload={conflict.onReload} />
      )}
      <FormSection title="Identity">
        <TextField
          label="Code"
          autoComplete="off"
          className="max-w-xs"
          hint="1 to 32 characters, unique in the company."
          readOnly={!editable}
          {...fieldProps(form, 'code')}
        />
        <TextField
          label="Name"
          autoComplete="off"
          readOnly={!editable}
          {...fieldProps(form, 'name')}
        />
      </FormSection>
      {editable && (
        <FormActions
          saveLabel="Save article group"
          saving={isSubmitting}
          cancelHref={cancelHref}
          dirty={isDirty}
        />
      )}
      <UnsavedChangesGuard when={isDirty && !isSubmitting} />
    </form>
  );
}
