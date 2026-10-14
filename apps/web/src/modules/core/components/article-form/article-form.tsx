// SPDX-License-Identifier: AGPL-3.0-or-later

import { stockUnit, stockUnitCodes, unitOf } from '@northmes/contracts';
import {
  articleFields,
  articleGroupId,
  articleNote,
  articleTranslations,
} from '@northmes/core-contracts';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { ConflictSummary } from '../../../../ui/components/conflict-summary/index.ts';
import { ErrorSummary, ErrorSummaryAction } from '../../../../ui/components/error-summary/index.ts';
import { FormActions } from '../../../../ui/components/form-actions/index.ts';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { SelectField } from '../../../../ui/components/select-field/index.ts';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
import { UnsavedChangesGuard } from '../../../../ui/components/unsaved-changes-guard/index.ts';
import { fieldProps, summaryErrors, type ZodForm } from '../../../../ui/lib/use-zod-form.ts';
import { useArticleGroups } from '../../use-article-groups.ts';
import { plantsChoiceField } from '../article-plants-field/index.ts';
import { ArticleFormTranslations } from './article-form-translations.tsx';

/**
 * The fields of the article form: the identity fields that core.createArticle and
 * core.updateArticle share, the same for a new and an existing article (ADR 0017); the stock
 * unit, which the form requires although the commands default it, so nobody saves pieces without
 * choosing them (design ui-222, Copy), the note, which an empty field clears, and the name's
 * translations; and for a user who holds core.article:assign at the company the Plants field,
 * whose choice must name a plant or All plants (ADR 0073). One parse checks them all, so a failed
 * save lists every field to fix.
 */
export const articleFormFields = articleFields.extend({
  // The select starts on Choose a unit, the empty value, which the catalog refuses.
  stockUnit: z.string().pipe(stockUnit),
  note: articleNote,
  translations: articleTranslations,
  articleGroupId,
  plants: plantsChoiceField.optional(),
});

/** The schema of the article form. */
export type ArticleFields = typeof articleFormFields;

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
  /** Further field groups after Identity, such as Plants (ADR 0073). */
  readonly children?: ReactNode;
  /**
   * The group the article has, which the select offers also when it was archived since, so an
   * edit keeps it.
   */
  readonly currentGroup?: { readonly id: string; readonly name: string } | null;
}

/** The stock units as the Stock unit select offers them, in the catalog's order. */
const stockUnitOptions = stockUnitCodes.map((code) => ({ value: code, label: unitOf(code).label }));

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
 * Article number, Name and the name's translations, the Classification group with Article group,
 * Stock unit and Note, any further field groups, then the sticky Save bar with Save article and
 * Cancel. The summary takes focus after each failed save, and the typed values stay (WCAG 3.3.7);
 * after a version conflict it says so and offers Reload article (DE19), and for an archived article
 * it offers Restore article (DE31). Leaving the form with changes asks first.
 */
export function ArticleForm({
  form,
  onSave,
  cancelHref,
  conflict,
  archived,
  children,
  currentGroup,
}: ArticleFormProps) {
  const { isDirty, isSubmitting } = form.formState;
  // The company's active groups; while they load, or when they fail, the select offers the
  // article's own group alone, and the article saves as before.
  const { data } = useArticleGroups(false);
  const active = data?.coreArticleGroups.edges.map(({ node }) => node) ?? [];
  const groupOptions = [
    ...active.map(({ id, name }) => ({ value: id, label: name })),
    ...(currentGroup && !active.some(({ id }) => id === currentGroup.id)
      ? [{ value: currentGroup.id, label: currentGroup.name }]
      : []),
  ];
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
        <ArticleFormTranslations form={form} />
      </FormSection>
      <FormSection title="Classification">
        <SelectField
          label="Article group"
          optional
          placeholder="Choose a group"
          options={groupOptions}
          className="max-w-xs"
          {...fieldProps(form, 'articleGroupId')}
        />
        <SelectField
          label="Stock unit"
          placeholder="Choose a unit"
          hint="Quantities of this article are counted in this unit."
          options={stockUnitOptions}
          className="max-w-xs"
          {...fieldProps(form, 'stockUnit')}
        />
        <TextareaField label="Note" optional rows={3} {...fieldProps(form, 'note')} />
      </FormSection>
      {children}
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
