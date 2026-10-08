// SPDX-License-Identifier: AGPL-3.0-or-later
import type { createArticle } from '@northmes/core-contracts';
import { Link } from '@tanstack/react-router';
import type { z } from 'zod';
import { Button } from '../../ui/button.tsx';
import { buttonVariants } from '../../ui/button-variants.ts';
import { ErrorSummary } from '../../ui/error-summary.tsx';
import { TextField } from '../../ui/text-field.tsx';
import { fieldProps, summaryErrors, type ZodForm } from '../../ui/use-zod-form.ts';

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
}

/** The summary's heading: the number of fields to fix, or that the save failed. */
function summaryHeading(fieldCount: number): string {
  if (fieldCount === 0) return 'Could not save the article';
  return `Fix ${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'} to save the article`;
}

/**
 * The article form (design ui-222, DE5 and DE7): the error summary, the Identity field group with
 * Article number and Name, then Save article and Cancel. The summary takes focus after each
 * failed save, and the typed values stay (WCAG 3.3.7).
 */
export function ArticleForm({ form, onSave, cancelHref }: ArticleFormProps) {
  const errors = summaryErrors(form.formState.errors);
  const fieldCount = errors.filter(({ name }) => name !== undefined).length;
  return (
    <form noValidate onSubmit={form.handleSubmit(onSave)} className="flex max-w-190 flex-col gap-4">
      <ErrorSummary
        heading={summaryHeading(fieldCount)}
        errors={errors}
        focusKey={form.formState.submitCount}
      />
      <section
        aria-labelledby="article-form-identity"
        className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 text-card-foreground"
      >
        <h2 id="article-form-identity" className="text-base font-semibold">
          Identity
        </h2>
        <TextField
          label="Article number"
          autoComplete="off"
          className="max-w-xs"
          {...fieldProps(form, 'code')}
        />
        <TextField label="Name" autoComplete="off" {...fieldProps(form, 'name')} />
      </section>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={form.formState.isSubmitting}>
          Save article
        </Button>
        <Link to={cancelHref} className={buttonVariants({ variant: 'outline' })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
