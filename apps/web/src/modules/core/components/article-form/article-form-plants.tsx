// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Controller } from 'react-hook-form';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import type { ZodForm } from '../../../../ui/lib/use-zod-form.ts';
import { ArticlePlantsField, type PlantOption } from '../article-plants-field/index.ts';
import type { ArticleFields } from './article-form.tsx';

interface ArticleFormPlantsProps {
  readonly form: ZodForm<ArticleFields>;
  /** The plants of the company that the field offers. */
  readonly options: readonly PlantOption[];
}

/**
 * The Plants section of the article form (ADR 0073): the plants whose lists and pickers show the
 * article, or All plants, for a user who holds core.article:assign at the company. New article and
 * Edit article both put it after Identity.
 */
export function ArticleFormPlants({ form, options }: ArticleFormPlantsProps) {
  return (
    <FormSection title="Plants" description="The plants whose lists and pickers show the article.">
      <Controller
        control={form.control}
        name="plants"
        render={({ field, fieldState }) => (
          <ArticlePlantsField
            options={options}
            value={field.value ?? { allPlants: false, plants: [] }}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
    </FormSection>
  );
}
