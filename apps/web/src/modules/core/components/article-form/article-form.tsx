// SPDX-License-Identifier: AGPL-3.0-or-later
import type { createArticle } from '@northmes/core-contracts';
import type { z } from 'zod';
import { ConflictSummary } from '../../../../ui/components/conflict-summary/index.ts';
import { ErrorSummary, ErrorSummaryAction } from '../../../../ui/components/error-summary/index.ts';
import { FormActions } from '../../../../ui/components/form-actions/index.ts';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { UnsavedChangesGuard } from '../../../../ui/components/unsaved-changes-guard/index.ts';
import { fieldProps, summaryErrors, type ZodForm } from '../../../../ui/lib/use-zod-form.ts';

/** The fields of the article form, the same for a new and an existing article (ADR 0017). */
export type ArticleFields = typeof createArticle.fields;

/** The values a save receives: the article fields as the contract parses them, trimmed. */
export type ArticleValues = z.output<ArticleFields>;

export interface ArticleFormProps {
  readonly form: ZodForm<ArticleFields>;
  /** Sends the values; a failure places its errors on the form before the promise settles. */
  readonly onSave: (values: ArticleValues) => Promise<void>;
  /** Where Cancel leads: the list for a new article, the article's page for an edit. */
  readonly cancelHref: string;
  /**
   * Set while the last save was refused with core.version_conflict: Reload article reads the saved
   * article and fills the form with it.
   */
  readonly conflict?: { readonly onReload: () => Promise<void> };
  /**
   * Set while the article is archived, as a save refused with core.archived shows: Restore article
   * restores it, and the typed values stay for the next save (DE31).
   */
  readonly archived?: { readonly onRestore: () => Promise<void> };
}

/** The summary's heading: the number of fields to fix, or that the save failed. */
function summaryHeading(fieldCount: number): string {
  if (fieldCount === 0) return 'Could not save the article';
  return `Fix ${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'} to save the article`;
}

/** The error summary: the archived notice, the version conflict, or the errors of the save. */
function Summary({
  form,
  conflict,
  archived,
}: Pick<ArticleFormProps, 'form' | 'conflict' | 'archived'>) {
  const errors = summaryErrors(form.formState.errors);
  if (archived !== undefined) {
    return (
      <ErrorSummary heading="This article is archived" errors={errors}>
        <p>Archived articles cannot be changed until they are restored. Your entries are kept.</p>
        <ErrorSummaryAction label="Restore article" onAction={archived.onRestore} />
      </ErrorSummary>
    );
  }
  if (conflict !== undefined) {
    return <ConflictSummary noun="article" errors={errors} onReload={conflict.onReload} />;
  }
  const fieldCount = errors.filter(({ name }) => name !== undefined).length;
  return (
    <ErrorSummary
      heading={summaryHeading(fieldCount)}
      errors={errors}
      focusKey={form.formState.submitCount}
    />
  );
}

/**
 * The article form (design ui-222, DE5 and DE7): the error summary, the Identity field group with
 * Article number and Name, then the sticky Save bar with Save article and Cancel. The summary takes
 * focus after each failed save, and the typed values stay (WCAG 3.3.7); after a version conflict it
 * says so and offers Reload article (DE19), and for an archived article it offers Restore article
 * (DE31). Leaving the form with changes asks first.
 */
export function ArticleForm({ form, onSave, cancelHref, conflict, archived }: ArticleFormProps) {
  const { isDirty, isSubmitting } = form.formState;
  return (
    <form noValidate onSubmit={form.handleSubmit(onSave)} className="flex max-w-190 flex-col gap-4">
      <Summary form={form} conflict={conflict} archived={archived} />
      <FormSection title="Identity">
        <TextField
          label="Article number"
          autoComplete="off"
          className="max-w-xs"
          {...fieldProps(form, 'code')}
        />
        <TextField label="Name" autoComplete="off" {...fieldProps(form, 'name')} />
      </FormSection>
      <FormActions
        saveLabel="Save article"
        saving={isSubmitting}
        cancelHref={cancelHref}
        dirty={isDirty}
      />
      <UnsavedChangesGuard when={isDirty && !isSubmitting} />
    </form>
  );
}
